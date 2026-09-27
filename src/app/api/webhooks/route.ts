import { NextRequest, NextResponse } from 'next/server'
import { importTransaction } from '@/lib/financials/engine'
import { createNotification } from '@/lib/notifications/engine'
import { query } from '@/lib/db/client'
import { logger } from '@/lib/logger'

// ============================================================
// WEBHOOK RECEIVER
// Handles incoming events from Gumroad, Payhip, and future channels.
//
// Payhip webhook URL to register:  {APP_URL}/api/webhooks
// Payhip events to select: paid, refunded, subscription.created, subscription.deleted
//
// The endpoint accepts both JSON and form-encoded bodies (Payhip sends form-encoded).
// ============================================================

async function parseBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text   = await req.text()
    const params = new URLSearchParams(text)
    const obj: Record<string, unknown> = {}
    for (const [k, v] of params.entries()) obj[k] = v
    return obj
  }
  return req.json()
}

async function lookupProduct(externalId?: string, productLink?: string) {
  if (!externalId && !productLink) return null
  const res = await query<{ product_id: string; channel_id: string }>(
    `SELECT product_id, channel_id
     FROM published_products
     WHERE external_product_id = $1 OR external_product_id = $2
     LIMIT 1`,
    [externalId || '', productLink || '']
  )
  return res.rows[0] ?? null
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req)

    // ── Identify source from headers / body fields ──────────
    // Payhip sends: event (e.g. "paid"), product_link, buyer_email, pay_amount, currency
    // Gumroad / n8n send: event (e.g. "sale.received"), data { ... }
    const rawEvent = String(body.event || body.type || '')

    logger.info('webhooks', `Received webhook: ${rawEvent}`, { body_keys: Object.keys(body) })

    // ── PAYHIP events ────────────────────────────────────────
    if (['paid', 'refunded', 'subscription.created', 'subscription.deleted'].includes(rawEvent)) {
      const productLink = String(body.product_link || '')
      const pub         = await lookupProduct(productLink, productLink)

      switch (rawEvent) {

        case 'paid': {
          // Payhip "paid" — customer purchased a product
          const gross    = parseFloat(String(body.pay_amount    || body.amount || 0))
          const fee      = parseFloat(String(body.payhip_fee    || 0))
          const net      = parseFloat(String(body.payout_amount || gross - fee))
          const currency = String(body.currency || 'USD').toUpperCase()
          const country  = String(body.buyer_country || body.country || '')
          const orderId  = String(body.order_id || body.purchase_key || '')

          if (pub) {
            await importTransaction({
              product_id:             pub.product_id,
              channel_id:             pub.channel_id,
              external_order_id:      orderId,
              customer_country:       country,
              sale_date:              new Date(),
              quantity:               1,
              gross_amount:           gross,
              discount:               0,
              refund_amount:          0,
              platform_fee:           fee || (gross - net),
              payment_processing_fee: 0,
              other_fee:              0,
              net_revenue:            net,
              currency,
            })
          }

          await createNotification({
            event:      'sale.received',
            title:      'Payhip Sale',
            message:    `New sale: ${currency} ${gross.toFixed(2)}${pub ? '' : ' (product not matched)'}`,
            product_id: pub?.product_id ?? null,
          })
          break
        }

        case 'refunded': {
          const amount   = parseFloat(String(body.refund_amount || body.amount || 0))
          const currency = String(body.currency || 'USD').toUpperCase()
          const orderId  = String(body.order_id || body.purchase_key || '')

          // Mark transaction as refunded if we can find it
          if (orderId) {
            await query(
              `UPDATE transactions SET refund_amount = $1, updated_at = NOW()
               WHERE external_order_id = $2`,
              [amount, orderId]
            ).catch(() => {}) // non-fatal if not found
          }

          await createNotification({
            event:      'refund.received',
            title:      'Payhip Refund',
            message:    `Refund processed: ${currency} ${amount.toFixed(2)}`,
            product_id: pub?.product_id ?? null,
          })
          break
        }

        case 'subscription.created': {
          const email = String(body.buyer_email || body.email || 'unknown')
          await createNotification({
            event:      'sale.received',
            title:      'Payhip Subscription Started',
            message:    `New subscription from ${email}`,
            product_id: pub?.product_id ?? null,
          })
          break
        }

        case 'subscription.deleted': {
          const email = String(body.buyer_email || body.email || 'unknown')
          await createNotification({
            event:      'refund.received',
            title:      'Payhip Subscription Cancelled',
            message:    `Subscription cancelled by ${email}`,
            product_id: pub?.product_id ?? null,
          })
          break
        }
      }

      return NextResponse.json({ success: true })
    }

    // ── LEGACY / n8n / Gumroad events ────────────────────────
    const data = (body.data || body) as Record<string, unknown>

    switch (rawEvent) {
      case 'sale.received': {
        const pub = await lookupProduct(String(data.external_product_id || ''))
        if (pub) {
          const gross = parseFloat(String(data.amount || 0))
          const fee   = parseFloat(String(data.platform_fee || 0))
          await importTransaction({
            product_id:             pub.product_id,
            channel_id:             pub.channel_id,
            external_order_id:      String(data.order_id || ''),
            customer_country:       String(data.country  || ''),
            sale_date:              new Date(String(data.sale_date || new Date())),
            quantity:               1,
            gross_amount:           gross,
            discount:               0,
            refund_amount:          0,
            platform_fee:           fee,
            payment_processing_fee: 0,
            other_fee:              0,
            net_revenue:            gross - fee,
            currency:               String(data.currency || 'USD'),
          })
          await createNotification({
            event:      'sale.received',
            title:      'New Sale',
            message:    `Sale received: $${gross}`,
            product_id: pub.product_id,
          })
        }
        break
      }

      case 'refund.received': {
        await createNotification({
          event:   'refund.received',
          title:   'Refund Received',
          message: `Refund processed: $${data.amount}`,
        })
        break
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('webhooks', 'Webhook handler error', { error: String(err) })
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
