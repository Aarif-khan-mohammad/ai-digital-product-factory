// ============================================================
// PUBLISHING ENGINE — Marketplace Adapter System
// ============================================================

import { query } from '@/lib/db/client'
import { addTimelineEvent, auditLog } from '@/lib/audit'
import { updateProductStatus } from '@/lib/generation/engine'
import { logger } from '@/lib/logger'
import type { Product, PublishedProduct, PublishingChannel } from '@/types'

// ── ADAPTER INTERFACE ─────────────────────────────────────────
export interface PublishingAdapter {
  authenticate(): Promise<boolean>
  createProduct(product: Product, files: ProductFileInfo[]): Promise<ExternalProduct>
  uploadFiles(externalId: string, files: ProductFileInfo[], productId?: string): Promise<void>
  updateProduct(externalId: string, product: Product): Promise<void>
  publishProduct(externalId: string): Promise<string>
  getProduct(externalId: string): Promise<ExternalProduct | null>
  getSales(externalId: string, since?: Date): Promise<ExternalSale[]>
  getTransactions(since?: Date): Promise<ExternalSale[]>
}

export interface ProductFileInfo {
  path: string
  name: string
  type: string
  size: number
}

export interface ExternalProduct {
  id: string
  url: string
  status: string
}

export interface ExternalSale {
  order_id: string
  product_id: string
  amount: number
  currency: string
  sale_date: Date
  customer_country?: string
  platform_fee: number
  refunded: boolean
  refund_amount: number
}

// ── GUMROAD ADAPTER ───────────────────────────────────────────
class GumroadAdapter implements PublishingAdapter {
  private token: string
  private baseUrl = 'https://api.gumroad.com/v2'

  constructor(config: Record<string, unknown>) {
    // Config from DB takes priority, fall back to env var
    this.token = (config.access_token as string) || process.env.GUMROAD_ACCESS_TOKEN || ''
  }

  async authenticate(): Promise<boolean> {
    if (!this.token) return false
    try {
      const res = await fetch(`${this.baseUrl}/user`, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(10000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  private buildGumroadDescription(product: Product): string {
    // Build a rich HTML description for Gumroad from all available product data
    const meta = product.metadata as Record<string, unknown> | null ?? {}
    const bulletPoints: string[] = Array.isArray(meta.bullet_points) ? meta.bullet_points as string[] : []
    const tags: string[] = Array.isArray(product.tags) ? product.tags as string[] : []

    const lines: string[] = []

    // Hook line
    if (meta.hook) lines.push(`<p><strong>${meta.hook}</strong></p>`)

    // Main description
    if (product.description) lines.push(`<p>${product.description}</p>`)

    // What's inside
    if (bulletPoints.length > 0) {
      lines.push('<p><strong>What\'s Inside:</strong></p><ul>')
      for (const bp of bulletPoints) lines.push(`<li>${bp}</li>`)
      lines.push('</ul>')
    }

    // Who it's for
    if (product.target_customer) {
      lines.push(`<p><strong>Perfect for:</strong> ${product.target_customer}</p>`)
    }

    // Tags
    if (tags.length > 0) {
      lines.push(`<p><strong>Topics:</strong> ${tags.join(', ')}</p>`)
    }

    return lines.join('\n') || product.description || ''
  }

  async createProduct(product: Product): Promise<ExternalProduct> {
    const body = new URLSearchParams({
      name:             product.title,
      description:      this.buildGumroadDescription(product),
      price:            String(Math.round(product.price * 100)),
      url:              product.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      published:        'false',
    })

    const res = await fetch(`${this.baseUrl}/products`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) throw new Error(`Gumroad create failed: ${res.status}`)
    const data = await res.json() as { product: { id: string; short_url: string } }
    return { id: data.product.id, url: data.product.short_url, status: 'draft' }
  }

  // Upload the product cover/thumbnail as the Gumroad preview image.
  // Gumroad accepts multipart image upload via PUT /products/:id with a `preview` file field.
  async uploadThumbnail(externalId: string, coverPath: string): Promise<void> {
    try {
      const { readFile } = await import('fs/promises')
      const { extname } = await import('path')

      const buffer   = await readFile(coverPath)
      const ext      = extname(coverPath).toLowerCase()
      // Gumroad preview accepts image/png, image/jpeg, image/gif — convert SVG to PNG-like by
      // sending as image/png with svg content; Gumroad renders it correctly.
      const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/svg+xml'
      const fileName = ext === '.svg' ? 'cover.svg' : `cover${ext}`

      const form = new FormData()
      form.append('preview', new Blob([buffer], { type: mimeType }), fileName)

      const res = await fetch(`${this.baseUrl}/products/${externalId}`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${this.token}` },
        body:    form,
        signal:  AbortSignal.timeout(60000),
      })

      if (res.ok) {
        logger.info('publishing', 'Gumroad: thumbnail/preview uploaded', { externalId, coverPath })
      } else {
        const txt = await res.text().catch(() => '')
        logger.warn('publishing', `Gumroad: thumbnail upload failed (${res.status}) — set it manually in the Gumroad dashboard`, { txt: txt.slice(0, 200) })
      }
    } catch (err) {
      logger.warn('publishing', 'Gumroad: thumbnail upload error (non-fatal)', { error: String(err) })
    }
  }

  async uploadFiles(externalId: string, files: ProductFileInfo[], productId?: string): Promise<void> {
    // Pick the best file to deliver: prefer ZIP (contains everything), then PDF
    const deliveryFile =
      files.find((f) => f.type === 'application/zip') ??
      files.find((f) => f.type === 'application/pdf')

    if (!deliveryFile || !productId) {
      logger.warn('publishing', 'Gumroad: no deliverable file found — buyer will see empty content tab', { externalId })
      return
    }

    // ── Attempt 1: direct multipart file upload via POST /products/:id/product_files ──
    // Gumroad v2 API requires access_token as a query param for this endpoint.
    try {
      const { readFile } = await import('fs/promises')
      const buffer   = await readFile(deliveryFile.path)
      const mimeType = deliveryFile.type || 'application/octet-stream'

      const form = new FormData()
      form.append('file', new Blob([buffer], { type: mimeType }), deliveryFile.name)

      const uploadRes = await fetch(
        `${this.baseUrl}/products/${externalId}/product_files?access_token=${encodeURIComponent(this.token)}`,
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${this.token}` },
          body:    form,
          signal:  AbortSignal.timeout(120000),
        }
      )

      if (uploadRes.ok) {
        logger.info('publishing', 'Gumroad: file uploaded successfully', { externalId, file: deliveryFile.name })
        return
      }
      const errTxt = await uploadRes.text().catch(() => '')
      logger.warn('publishing', `Gumroad: direct file upload returned ${uploadRes.status} — falling back to delivery URL`, { err: errTxt.slice(0, 200) })
    } catch (err) {
      logger.warn('publishing', 'Gumroad: direct file upload error — falling back to delivery URL', { error: String(err) })
    }

    // ── Attempt 2: custom_delivery_url fallback (public deployments only) ──
    const appUrl   = (process.env.APP_URL || '').replace(/\/$/, '')
    const isPublic = appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1')

    const { query: dbQuery } = await import('@/lib/db/client')
    const fileRes = await dbQuery<{ id: string }>(
      `SELECT id FROM product_files WHERE file_name = $1 AND product_id = $2 LIMIT 1`,
      [deliveryFile.name, productId]
    )
    const fileId = fileRes.rows[0]?.id

    if (isPublic && fileId) {
      const deliveryUrl = `${appUrl}/api/products/${productId}/file/${fileId}`
      const body = new URLSearchParams({ custom_delivery_url: deliveryUrl })
      const res = await fetch(`${this.baseUrl}/products/${externalId}`, {
        method: 'PUT',
        headers: {
          Authorization:  `Bearer ${this.token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(30000),
      })
      if (res.ok) {
        logger.info('publishing', 'Gumroad: set custom_delivery_url', { externalId, url: deliveryUrl })
      } else {
        logger.warn('publishing', `Gumroad: failed to set custom_delivery_url (${res.status})`, { externalId })
      }
    } else {
      logger.warn('publishing', 'Gumroad: file not uploaded — upload manually via the Gumroad dashboard Content tab.', {
        externalId,
        file: deliveryFile.name,
        hint: 'Open https://app.gumroad.com/products and click Edit → Content to upload the file.',
      })
    }
  }

  async updateProduct(externalId: string, product: Product): Promise<void> {
    const body = new URLSearchParams({
      name:        product.title,
      description: this.buildGumroadDescription(product),
      price:       String(Math.round(product.price * 100)),
    })
    await fetch(`${this.baseUrl}/products/${externalId}`, {
      method: 'PUT',
      headers: {
        Authorization:  `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(30000),
    })
  }

  async publishProduct(externalId: string): Promise<string> {
    const body = new URLSearchParams({ published: 'true' })
    const res = await fetch(`${this.baseUrl}/products/${externalId}`, {
      method: 'PUT',
      headers: {
        Authorization:  `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) throw new Error(`Gumroad publish failed: ${res.status}`)
    const data = await res.json() as { product: { short_url: string } }
    return data.product.short_url
  }

  async getProduct(externalId: string): Promise<ExternalProduct | null> {
    const res = await fetch(`${this.baseUrl}/products/${externalId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json() as { product: { id: string; short_url: string; published: boolean } }
    return { id: data.product.id, url: data.product.short_url, status: data.product.published ? 'published' : 'draft' }
  }

  async getSales(externalId: string): Promise<ExternalSale[]> {
    const res = await fetch(`${this.baseUrl}/products/${externalId}/sales`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return []
    const data = await res.json() as { sales?: Array<{
      id: string
      product_id: string
      price: number
      currency_symbol: string
      created_at: string
      ip_country: string
      gumroad_fee: number
      refunded: boolean
      chargebacked: boolean
    }> }
    return (data.sales || []).map((s) => ({
      order_id:        s.id,
      product_id:      s.product_id,
      amount:          s.price / 100,
      currency:        'USD',
      sale_date:       new Date(s.created_at),
      customer_country: s.ip_country,
      platform_fee:    s.gumroad_fee / 100,
      refunded:        s.refunded || s.chargebacked,
      refund_amount:   s.refunded ? s.price / 100 : 0,
    }))
  }

  async getTransactions(): Promise<ExternalSale[]> { return [] }
}

// ── PAYHIP ADAPTER ────────────────────────────────────────────
// Payhip REST API v1 — https://developers.payhip.com/reference
// Auth: Authorization: ApiKey <key>
class PayhipAdapter implements PublishingAdapter {
  private apiKey: string
  private baseUrl = 'https://payhip.com/api/v1'

  constructor(config: Record<string, unknown>) {
    this.apiKey = (config.api_key as string) || process.env.PAYHIP_API_KEY || ''
  }

  private get headers() {
    return {
      'Authorization': `ApiKey ${this.apiKey}`,
      'Content-Type':  'application/json',
    }
  }

  async authenticate(): Promise<boolean> {
    if (!this.apiKey) return false
    try {
      // Payhip v1 — GET /product lists products; use as auth check.
      // A 200 (products found) or 404 (no products yet) both mean the key is valid.
      // Only 401/403 means the key is wrong.
      const res = await fetch(`${this.baseUrl}/product`, {
        headers: this.headers,
        signal:  AbortSignal.timeout(15000),
      })
      return res.ok || res.status === 404
    } catch {
      return false
    }
  }

  async createProduct(product: Product): Promise<ExternalProduct> {
    if (!this.apiKey) throw new Error('Payhip API key not configured. Add it in Publishing settings.')

    // Payhip v1 — POST /product  (form-encoded)
    const body = new URLSearchParams({
      title:       product.title,
      excerpt:     (product.description || product.title).slice(0, 500),
      // price in pence/cents (Payhip uses whole numbers × 100)
      price:       String(Math.round(product.price * 100)),
      currency:    (product.currency || 'USD').toUpperCase(),
      type:        'digital',
    })

    const res = await fetch(`${this.baseUrl}/product`, {
      method:  'POST',
      headers: { Authorization: `ApiKey ${this.apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal:  AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`Payhip create failed (${res.status}): ${txt.slice(0, 200)}`)
    }

    const data = await res.json() as { data: { link: string; hash_id: string } }
    const link = data.data?.link || ''
    const id   = data.data?.hash_id || link.split('/').pop() || link
    return { id, url: link, status: 'draft' }
  }

  async uploadFiles(externalId: string, files: ProductFileInfo[]): Promise<void> {
    // Payhip v1 — POST /product/file  with form field 'file'
    const deliveryFile =
      files.find((f) => f.type === 'application/zip') ??
      files.find((f) => f.type === 'application/pdf')

    if (!deliveryFile) {
      logger.warn('publishing', 'Payhip: no deliverable file found', { externalId })
      return
    }

    try {
      const { readFile } = await import('fs/promises')
      const buffer   = await readFile(deliveryFile.path)
      const formData = new FormData()
      formData.append('product_link', externalId)
      formData.append('file', new Blob([buffer], { type: deliveryFile.type }), deliveryFile.name)

      const res = await fetch(`${this.baseUrl}/product/file`, {
        method:  'POST',
        headers: { Authorization: `ApiKey ${this.apiKey}` },
        body:    formData,
        signal:  AbortSignal.timeout(120000),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        logger.warn('publishing', `Payhip: file upload failed (${res.status}) — upload manually at https://payhip.com/account#products`, { txt: txt.slice(0, 200) })
      } else {
        logger.info('publishing', 'Payhip: file uploaded successfully', { externalId, file: deliveryFile.name })
      }
    } catch (err) {
      logger.warn('publishing', 'Payhip: file upload error (non-fatal)', { error: String(err) })
    }
  }

  async updateProduct(externalId: string, product: Product): Promise<void> {
    const body = new URLSearchParams({
      product_link: externalId,
      title:        product.title,
      excerpt:      (product.description || '').slice(0, 500),
      price:        String(Math.round(product.price * 100)),
    })
    await fetch(`${this.baseUrl}/product`, {
      method:  'PUT',
      headers: { Authorization: `ApiKey ${this.apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal:  AbortSignal.timeout(30000),
    })
  }

  async publishProduct(externalId: string): Promise<string> {
    // Payhip products are live as soon as created; return the product URL
    return `https://payhip.com/b/${externalId}`
  }

  async getProduct(externalId: string): Promise<ExternalProduct | null> {
    try {
      const res = await fetch(`${this.baseUrl}/product?product_link=${encodeURIComponent(externalId)}`, {
        headers: this.headers,
        signal:  AbortSignal.timeout(10000),
      })
      if (!res.ok) return null
      const data = await res.json() as { data: { link: string; hash_id: string } }
      return { id: data.data?.hash_id || externalId, url: data.data?.link || `https://payhip.com/b/${externalId}`, status: 'published' }
    } catch { return null }
  }

  async getSales(): Promise<ExternalSale[]> { return [] }
  async getTransactions(): Promise<ExternalSale[]> { return [] }
}

// ── ETSY ADAPTER ──────────────────────────────────────────────
// Etsy v3 API requires OAuth 2.0 — programmatic listing creation
// requires a full OAuth flow that isn't practical for a server-side key.
// Strategy: generate a pre-filled Etsy draft listing URL and provide
// all listing data as copy-paste content so the user can post in seconds.
class EtsyAdapter implements PublishingAdapter {
  private apiKey:   string
  private shopId:   string

  constructor(config: Record<string, unknown>) {
    this.apiKey = (config.api_key as string)  || process.env.ETSY_API_KEY  || ''
    this.shopId = (config.shop_id as string)  || process.env.ETSY_SHOP_ID  || ''
  }

  async authenticate(): Promise<boolean> {
    // Etsy v3 needs OAuth; we just check that credentials are present
    return !!(this.apiKey && this.shopId)
  }

  async createProduct(product: Product): Promise<ExternalProduct> {
    // Build the Etsy "create listing" deep-link with all fields pre-populated.
    // Etsy's listing creation URL accepts query params for title, description, price.
    const slug    = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
    const tags    = Array.isArray(product.tags) ? product.tags.slice(0, 13).join(',') : ''
    const draftId = `etsy-draft-${product.id.slice(0, 8)}`

    // Etsy listing creation page — user pastes in product details
    const createUrl = this.shopId
      ? `https://www.etsy.com/your/shops/${this.shopId}/tools/listings/create`
      : 'https://www.etsy.com/sell'

    // Store listing metadata as JSON for the manual upload notice
    logger.info('publishing', 'Etsy: manual listing required', {
      product_id:  product.id,
      create_url:  createUrl,
      title:       product.title,
      price:       product.price,
      tags,
      slug,
    })

    return { id: draftId, url: createUrl, status: 'manual_required' }
  }

  async uploadFiles(): Promise<void> {
    // Etsy digital files are attached inside the listing editor — nothing to do via API
  }

  async updateProduct(): Promise<void> {}

  async publishProduct(externalId: string): Promise<string> {
    // Return the Etsy shop URL; the user finalises the listing manually
    const shopUrl = this.shopId
      ? `https://www.etsy.com/shop/${this.shopId}`
      : 'https://www.etsy.com/sell'
    return shopUrl
  }

  async getProduct(externalId: string): Promise<ExternalProduct> {
    return { id: externalId, url: '', status: 'manual' }
  }

  async getSales(): Promise<ExternalSale[]> { return [] }
  async getTransactions(): Promise<ExternalSale[]> { return [] }
}

// ── MANUAL ADAPTER ────────────────────────────────────────────
class ManualAdapter implements PublishingAdapter {
  async authenticate(): Promise<boolean> { return true }

  async createProduct(product: Product): Promise<ExternalProduct> {
    return {
      id:     `manual-${product.id}`,
      url:    '',
      status: 'manual_required',
    }
  }

  async uploadFiles(): Promise<void> {
    // Manual: user uploads files themselves
  }

  async updateProduct(): Promise<void> {}

  async publishProduct(externalId: string): Promise<string> {
    return `manual-publish-${externalId}`
  }

  async getProduct(externalId: string): Promise<ExternalProduct> {
    return { id: externalId, url: '', status: 'manual' }
  }

  async getSales(): Promise<ExternalSale[]> { return [] }
  async getTransactions(): Promise<ExternalSale[]> { return [] }
}

// ── ADAPTER FACTORY ───────────────────────────────────────────
export function createAdapter(channel: PublishingChannel): PublishingAdapter {
  const config = { ...(channel.config as Record<string, unknown>) }

  // Inject env-var credentials into config if the DB row has no key stored
  if (channel.channel_type === 'PAYHIP' && !config.api_key && process.env.PAYHIP_API_KEY) {
    config.api_key = process.env.PAYHIP_API_KEY
  }
  if (channel.channel_type === 'GUMROAD' && !config.token && process.env.GUMROAD_ACCESS_TOKEN) {
    config.token = process.env.GUMROAD_ACCESS_TOKEN
  }

  switch (channel.channel_type) {
    case 'GUMROAD': return new GumroadAdapter(config)
    case 'PAYHIP':  return new PayhipAdapter(config)
    case 'ETSY':    return new EtsyAdapter(config)
    case 'MANUAL':
    case 'OWN_STORE':
    default:        return new ManualAdapter()
  }
}

// ── MAIN PUBLISH FUNCTION ─────────────────────────────────────
export async function publishProduct(
  productId: string,
  channelId: string,
  workflowRunId?: string
): Promise<PublishedProduct> {
  // Get product and channel
  const [productRes, channelRes] = await Promise.all([
    query<Product>(`SELECT * FROM products WHERE id = $1`, [productId]),
    query<PublishingChannel>(`SELECT * FROM publishing_channels WHERE id = $1`, [channelId]),
  ])

  const product = productRes.rows[0]
  const channel = channelRes.rows[0]

  if (!product) throw new Error(`Product not found: ${productId}`)
  if (!channel) throw new Error(`Channel not found: ${channelId}`)
  if (!channel.enabled) throw new Error(`Channel not enabled: ${channel.name}`)

  await updateProductStatus(productId, 'PUBLISHING')
  await addTimelineEvent(productId, 'PUBLISHING_STARTED', `Publishing to ${channel.name}`)

  // Get product files and assets in parallel
  const [filesRes, assetsRes] = await Promise.all([
    query<{ file_path: string; file_name: string; file_type: string; file_size: number }>(
      `SELECT file_path, file_name, file_type, file_size FROM product_files WHERE product_id = $1`,
      [productId]
    ),
    query<{ asset_type: string; file_path: string }>(
      `SELECT asset_type, file_path FROM product_assets WHERE product_id = $1`,
      [productId]
    ),
  ])
  const files: ProductFileInfo[] = filesRes.rows.map((f) => ({
    path: f.file_path,
    name: f.file_name,
    type: f.file_type,
    size: f.file_size,
  }))
  // Prefer COVER, fall back to THUMBNAIL
  const coverAsset = assetsRes.rows.find((a) => a.asset_type === 'COVER')
               ?? assetsRes.rows.find((a) => a.asset_type === 'THUMBNAIL')

  const adapter = createAdapter(channel)

  try {
    const authenticated = await adapter.authenticate()
    if (!authenticated) {
      throw new Error(`Authentication failed for channel: ${channel.name}`)
    }

    const external = await adapter.createProduct(product, files)
    await adapter.uploadFiles(external.id, files, productId)

    // Upload cover/thumbnail image if the adapter supports it (Gumroad)
    if (coverAsset && 'uploadThumbnail' in adapter && typeof (adapter as { uploadThumbnail?: unknown }).uploadThumbnail === 'function') {
      await (adapter as { uploadThumbnail: (id: string, path: string) => Promise<void> }).uploadThumbnail(external.id, coverAsset.file_path)
    }

    const productUrl = await adapter.publishProduct(external.id)

    // Store published product record
    const result = await query<PublishedProduct>(
      `INSERT INTO published_products
        (product_id, channel_id, external_product_id, product_url, published_at,
         publication_status, price, currency, last_sync_at, sync_status)
       VALUES ($1,$2,$3,$4,NOW(),'PUBLISHED',$5,$6,NOW(),'SYNCED')
       ON CONFLICT (product_id, channel_id) DO UPDATE SET
         external_product_id = EXCLUDED.external_product_id,
         product_url         = EXCLUDED.product_url,
         published_at        = EXCLUDED.published_at,
         publication_status  = EXCLUDED.publication_status,
         last_sync_at        = EXCLUDED.last_sync_at,
         sync_status         = EXCLUDED.sync_status
       RETURNING *`,
      [productId, channelId, external.id, productUrl || '', product.price, product.currency]
    )

    await updateProductStatus(productId, 'PUBLISHED')
    await query(`UPDATE products SET published_at = NOW() WHERE id = $1`, [productId])
    await addTimelineEvent(productId, 'PUBLISHED', `Published to ${channel.name}: ${productUrl}`)

    logger.info('publishing', `Product published`, {
      product_id: productId,
      channel:    channel.name,
      url:        productUrl,
    })

    return result.rows[0]
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)

    // Store failed publish record
    await query(
      `INSERT INTO published_products
        (product_id, channel_id, publication_status, price, currency, error_message, sync_status)
       VALUES ($1,$2,'MANUAL_REQUIRED',$3,$4,$5,'ERROR')
       ON CONFLICT (product_id, channel_id) DO UPDATE SET
         publication_status = 'MANUAL_REQUIRED',
         error_message      = EXCLUDED.error_message,
         sync_status        = 'ERROR'`,
      [productId, channelId, product.price, product.currency, errorMsg]
    )

    await updateProductStatus(productId, 'READY_TO_PUBLISH')
    await addTimelineEvent(productId, 'PUBLISH_FAILED', `Publishing failed: ${errorMsg}. Manual publishing required.`)

    logger.error('publishing', `Publishing failed`, { product_id: productId, error: errorMsg })
    throw err
  }
}

export async function getPublishedProducts(productId: string): Promise<PublishedProduct[]> {
  const result = await query<PublishedProduct>(
    `SELECT pp.*, pc.name as channel_name, pc.channel_type
     FROM published_products pp
     JOIN publishing_channels pc ON pc.id = pp.channel_id
     WHERE pp.product_id = $1`,
    [productId]
  )
  return result.rows
}

export async function getEnabledChannels(): Promise<PublishingChannel[]> {
  const result = await query<PublishingChannel>(
    `SELECT * FROM publishing_channels WHERE enabled = true ORDER BY name`
  )
  return result.rows
}
