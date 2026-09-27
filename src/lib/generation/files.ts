// ============================================================
// FILE GENERATION ENGINE — PDF, ZIP, Assets
// ============================================================

import { createHash } from 'crypto'
import { join } from 'path'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib'
import AdmZip from 'adm-zip'
import { query } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import type { Product } from '@/types'
import type { ProductContent, SectionContent } from './engine'

const STORAGE_BASE = process.env.STORAGE_LOCAL_PATH || './products'

// ── DIRECTORY SETUP ───────────────────────────────────────────
export async function ensureProductDir(productId: string): Promise<string> {
  const dir = join(STORAGE_BASE, productId)
  const subdirs = ['content', 'assets', 'marketing', 'exports']
  await mkdir(dir, { recursive: true })
  for (const sub of subdirs) {
    await mkdir(join(dir, sub), { recursive: true })
  }
  return dir
}

// ── SHA256 HASH ───────────────────────────────────────────────
function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

// ── STORE FILE RECORD ─────────────────────────────────────────
async function storeFileRecord(params: {
  product_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  sha256_hash: string
  is_primary?: boolean
}): Promise<void> {
  try {
    // Remove duplicate entry if regenerating
    await query(
      `DELETE FROM product_files WHERE product_id = $1 AND file_name = $2`,
      [params.product_id, params.file_name]
    )
    await query(
      `INSERT INTO product_files
        (product_id, file_name, file_path, file_type, file_size, sha256_hash, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        params.product_id,
        params.file_name,
        params.file_path,
        params.file_type,
        params.file_size,
        params.sha256_hash,
        params.is_primary ?? false,
      ]
    )
  } catch (err) {
    logger.warn('files', 'Failed to store file record (non-fatal)', {
      file: params.file_name,
      error: String(err),
    })
  }
}

// Sanitize text to WinAnsi-safe characters (pdf-lib standard fonts only support Latin-1)
function safeText(text: string): string {
  return (text || '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/[^\x00-\xFF]/g, '')
}

// ── SAFE TEXT DRAW — wraps long lines & guards Y bounds ───────
function drawTextBlock(
  page: PDFPage,
  text: string,
  opts: { x: number; startY: number; maxWidth: number; size: number; font: PDFFont; lineHeight?: number; color?: ReturnType<typeof rgb> }
): number {
  const { x, startY, maxWidth, size, font, lineHeight = size + 4, color = rgb(0.1, 0.1, 0.1) } = opts
  const words = safeText(text).split(' ')
  let currentLine = ''
  let y = startY

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(candidate, size)
    if (width > maxWidth && currentLine) {
      if (y < 40) break
      page.drawText(currentLine, { x, y, size, font, color })
      y -= lineHeight
      currentLine = word
    } else {
      currentLine = candidate
    }
  }
  if (currentLine && y >= 40) {
    page.drawText(currentLine, { x, y, size, font, color })
    y -= lineHeight
  }
  return y
}

// ── PDF GENERATION ────────────────────────────────────────────

// Helper: add a new page with the standard header bar, returns starting Y
function addSectionPage(
  pdfDoc: PDFDocument,
  title: string,
  sectionNum: number,
  totalSections: number,
  font: PDFFont,
  bold: PDFFont,
  W: number, H: number, MARGIN: number
): { page: PDFPage; y: number } {
  const page = pdfDoc.addPage([W, H])
  // Dark header bar
  page.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: rgb(0.05, 0.1, 0.2) })
  page.drawText(safeText(title).slice(0, 65), { x: MARGIN, y: H - 38, size: 16, font: bold, color: rgb(1, 1, 1) })
  // Page number badge
  page.drawText(`${sectionNum} / ${totalSections}`, {
    x: W - MARGIN - 36, y: H - 38, size: 9, font, color: rgb(0.5, 0.65, 0.85),
  })
  return { page, y: H - 80 }
}

// Helper: draw a labelled group header (e.g. "KEY POINTS")
function drawGroupLabel(page: PDFPage, label: string, y: number, MARGIN: number, bold: PDFFont): number {
  page.drawText(label, { x: MARGIN, y, size: 8, font: bold, color: rgb(0.3, 0.5, 0.8) })
  return y - 14
}

// Helper: draw bullet list, returns new y
function drawBullets(
  page: PDFPage, items: string[], startY: number,
  MARGIN: number, TEXT_W: number, font: PDFFont, bold: PDFFont
): number {
  let y = startY
  for (const item of items) {
    if (y < 70) break
    page.drawText('•', { x: MARGIN, y, size: 11, font: bold, color: rgb(0.2, 0.45, 0.75) })
    y = drawTextBlock(page, item, { x: MARGIN + 14, startY: y, maxWidth: TEXT_W - 14, size: 11, font, lineHeight: 16, color: rgb(0.12, 0.12, 0.12) })
    y -= 4
  }
  return y
}

// Helper: draw numbered steps, returns new y
function drawNumberedSteps(
  page: PDFPage, steps: string[], startY: number,
  MARGIN: number, TEXT_W: number, font: PDFFont, bold: PDFFont
): number {
  let y = startY
  steps.forEach((step, i) => {
    if (y < 70) return
    page.drawText(`${i + 1}.`, { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.3, 0.6) })
    y = drawTextBlock(page, step, { x: MARGIN + 20, startY: y, maxWidth: TEXT_W - 20, size: 11, font, lineHeight: 16, color: rgb(0.12, 0.12, 0.12) })
    y -= 6
  })
  return y
}

// Helper: draw callout box (exercise / takeaway)
function drawCallout(
  page: PDFPage, label: string, text: string, y: number,
  MARGIN: number, TEXT_W: number, font: PDFFont, bold: PDFFont,
  bgColor: ReturnType<typeof rgb>, borderColor: ReturnType<typeof rgb>
): number {
  const boxH = Math.min(110, 24 + Math.ceil(text.length / 60) * 16)
  if (y - boxH < 50) return y
  page.drawRectangle({ x: MARGIN - 4, y: y - boxH + 12, width: TEXT_W + 8, height: boxH, color: bgColor })
  page.drawRectangle({ x: MARGIN - 4, y: y - boxH + 12, width: 3, height: boxH, color: borderColor })
  page.drawText(label, { x: MARGIN + 4, y: y - 2, size: 9, font: bold, color: borderColor })
  const textY = drawTextBlock(page, text, { x: MARGIN + 4, startY: y - 16, maxWidth: TEXT_W - 8, size: 10, font, lineHeight: 15, color: rgb(0.1, 0.1, 0.1) })
  return textY - 16
}

export async function generatePDF(
  product: Product,
  content: Partial<ProductContent>
): Promise<string> {
  const dir    = await ensureProductDir(product.id)
  const pdfDoc = await PDFDocument.create()
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const W      = 612
  const H      = 792
  const MARGIN = 50
  const TEXT_W = W - MARGIN * 2

  // ── Cover page ──────────────────────────────────────────────
  const cover = pdfDoc.addPage([W, H])
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.05, 0.1, 0.2) })
  cover.drawRectangle({ x: MARGIN, y: 80, width: TEXT_W, height: H - 160, color: rgb(0.08, 0.14, 0.28) })

  let titleY = 560
  let titleLine = ''
  for (const w of safeText(product.title).split(' ')) {
    const candidate = titleLine ? `${titleLine} ${w}` : w
    if (bold.widthOfTextAtSize(candidate, 26) > TEXT_W - 20 && titleLine) {
      cover.drawText(titleLine, { x: MARGIN + 10, y: titleY, size: 26, font: bold, color: rgb(1, 1, 1) })
      titleY -= 36; titleLine = w
    } else { titleLine = candidate }
  }
  if (titleLine) cover.drawText(titleLine, { x: MARGIN + 10, y: titleY, size: 26, font: bold, color: rgb(1, 1, 1) })
  cover.drawText(safeText(product.subtitle || product.niche).slice(0, 70), { x: MARGIN + 10, y: titleY - 40, size: 14, font, color: rgb(0.6, 0.75, 0.9) })
  cover.drawText(`For: ${safeText(product.target_customer).slice(0, 65)}`, { x: MARGIN + 10, y: titleY - 64, size: 12, font, color: rgb(0.5, 0.65, 0.8) })
  cover.drawText(`$${product.price} ${product.currency}`,           { x: MARGIN + 10, y: 120, size: 14, font: bold, color: rgb(0.3, 0.8, 0.4) })

  // ── Table of Contents page ───────────────────────────────────
  const outline = (content.outline || []).slice(0, 12)
  if (outline.length > 0) {
    const tocPage = pdfDoc.addPage([W, H])
    tocPage.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: rgb(0.05, 0.1, 0.2) })
    tocPage.drawText('Contents', { x: MARGIN, y: H - 38, size: 18, font: bold, color: rgb(1, 1, 1) })
    let tocY = H - 100
    outline.forEach((section, i) => {
      if (tocY < 60) return
      tocPage.drawText(`${i + 1}`, { x: MARGIN, y: tocY, size: 12, font: bold, color: rgb(0.3, 0.5, 0.8) })
      tocPage.drawText(safeText(section), { x: MARGIN + 24, y: tocY, size: 12, font, color: rgb(0.1, 0.1, 0.1) })
      tocPage.drawLine({ start: { x: MARGIN + 24, y: tocY - 3 }, end: { x: W - MARGIN, y: tocY - 3 }, thickness: 0.3, color: rgb(0.88, 0.88, 0.88) })
      tocY -= 30
    })
  }

  // ── Quick Start page ────────────────────────────────────────
  if (content.quick_start) {
    const qsPage = pdfDoc.addPage([W, H])
    qsPage.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: rgb(0.12, 0.22, 0.42) })
    qsPage.drawText('Quick Start', { x: MARGIN, y: H - 38, size: 18, font: bold, color: rgb(1, 1, 1) })
    let y = H - 84
    y = drawTextBlock(qsPage, content.quick_start, { x: MARGIN, startY: y, maxWidth: TEXT_W, size: 12, font, lineHeight: 18, color: rgb(0.1, 0.1, 0.1) })
    if (content.usage_guide && y > 120) {
      y -= 20
      y = drawGroupLabel(qsPage, 'HOW TO USE THIS GUIDE', y, MARGIN, bold)
      drawTextBlock(qsPage, content.usage_guide, { x: MARGIN, startY: y, maxWidth: TEXT_W, size: 11, font, lineHeight: 16, color: rgb(0.25, 0.25, 0.25) })
    }
  }

  // ── Section pages ────────────────────────────────────────────
  // Normalize lookup key so we match even if LLM used slightly different casing
  const sectionsMap = content.sections || {}
  const normalizeKey = (k: string) => k.toLowerCase().trim()
  const sectionsLookup: Record<string, SectionContent> = {}
  for (const [k, v] of Object.entries(sectionsMap)) {
    sectionsLookup[normalizeKey(k)] = v
  }

  for (let i = 0; i < outline.length; i++) {
    const sectionTitle = outline[i]
    const sec: SectionContent = sectionsMap[sectionTitle]
      || sectionsLookup[normalizeKey(sectionTitle)]
      || { intro: '', key_points: [], steps: [], exercise: '', takeaway: '' }

    const { page, y: startY } = addSectionPage(pdfDoc, sectionTitle, i + 1, outline.length, font, bold, W, H, MARGIN)
    let y = startY

    // Intro paragraph
    if (sec.intro) {
      y = drawTextBlock(page, sec.intro, { x: MARGIN, startY: y, maxWidth: TEXT_W, size: 11, font, lineHeight: 17, color: rgb(0.12, 0.12, 0.12) })
      y -= 16
    }

    // Key points
    if (sec.key_points?.length > 0 && y > 100) {
      y = drawGroupLabel(page, 'KEY POINTS', y, MARGIN, bold)
      y = drawBullets(page, sec.key_points, y, MARGIN, TEXT_W, font, bold)
      y -= 14
    }

    // Action steps
    if (sec.steps?.length > 0 && y > 100) {
      y = drawGroupLabel(page, 'ACTION STEPS', y, MARGIN, bold)
      y = drawNumberedSteps(page, sec.steps, y, MARGIN, TEXT_W, font, bold)
      y -= 14
    }

    // Exercise callout box
    if (sec.exercise && y > 100) {
      y = drawCallout(page, 'EXERCISE', sec.exercise, y, MARGIN, TEXT_W, font, bold,
        rgb(0.94, 0.97, 1.0), rgb(0.2, 0.45, 0.75))
    }

    // Takeaway callout box
    if (sec.takeaway && y > 80) {
      y = drawCallout(page, 'KEY TAKEAWAY', sec.takeaway, y, MARGIN, TEXT_W, font, bold,
        rgb(0.96, 1.0, 0.95), rgb(0.15, 0.6, 0.3))
    }
  }

  // ── Instructions page ────────────────────────────────────────
  // Guard: older pipeline versions stored instructions as string[], not string
  const instructionsText = Array.isArray(content.instructions)
    ? (content.instructions as string[]).join('\n')
    : (content.instructions || '')
  if (instructionsText) {
    const instrPage = pdfDoc.addPage([W, H])
    instrPage.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: rgb(0.05, 0.1, 0.2) })
    instrPage.drawText('How to Use This Guide', { x: MARGIN, y: H - 38, size: 18, font: bold, color: rgb(1, 1, 1) })
    let instrY = H - 80
    for (const line of instructionsText.split('\n')) {
      if (instrY < 60) break
      instrY = drawTextBlock(instrPage, line, { x: MARGIN, startY: instrY, maxWidth: TEXT_W, size: 11, font, lineHeight: 17 })
      instrY -= 6
    }
  }

  // ── FAQ page ─────────────────────────────────────────────────
  const faqs = (content.faq || []).slice(0, 10)
  if (faqs.length > 0) {
    const faqPage = pdfDoc.addPage([W, H])
    faqPage.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: rgb(0.05, 0.1, 0.2) })
    faqPage.drawText('Frequently Asked Questions', { x: MARGIN, y: H - 38, size: 18, font: bold, color: rgb(1, 1, 1) })
    let faqY = H - 86
    for (const item of faqs) {
      if (faqY < 80) break
      faqPage.drawText(`Q: ${safeText(item.q).slice(0, 80)}`, { x: MARGIN, y: faqY, size: 12, font: bold, color: rgb(0.1, 0.1, 0.3) })
      faqY -= 18
      faqY = drawTextBlock(faqPage, `A: ${item.a}`, { x: MARGIN + 10, startY: faqY, maxWidth: TEXT_W - 10, size: 11, font, lineHeight: 15, color: rgb(0.2, 0.2, 0.2) })
      faqY -= 16
    }
  }

  const pdfBytes = await pdfDoc.save()
  const buffer   = Buffer.from(pdfBytes)
  const fileName = 'product.pdf'
  const filePath = join(dir, 'content', fileName)

  await writeFile(filePath, buffer)
  await storeFileRecord({
    product_id:  product.id,
    file_name:   fileName,
    file_path:   filePath,
    file_type:   'application/pdf',
    file_size:   buffer.length,
    sha256_hash: sha256(buffer),
    is_primary:  true,
  })

  logger.info('files', 'Generated PDF', { product_id: product.id, size: buffer.length, pages: pdfDoc.getPageCount() })
  return filePath
}

// ── README ────────────────────────────────────────────────────
export async function generateReadme(product: Product): Promise<string> {
  const dir = await ensureProductDir(product.id)
  const content = `# ${product.title}

${product.subtitle || ''}

## About This Product

${product.description || 'A premium digital product designed to help you achieve your goals.'}

## Who This Is For

${product.target_customer}

## Problem Solved

${product.problem_solved}

## Files Included

- product.pdf — Main product (printable / digital)
- cover.svg   — Cover image
- sales-description.md — Marketing copy
- keywords.json — SEO keywords and tags
- product.json — Product metadata

## License

Personal use license. You may use this product for personal or business purposes.
You may NOT resell, redistribute, or claim authorship of this product.

## Support

Contact the seller through the marketplace where you purchased this product.

---
Generated by AI Digital Product Factory
`

  const buffer   = Buffer.from(content)
  const filePath = join(dir, 'README.txt')
  await writeFile(filePath, buffer)
  await storeFileRecord({
    product_id:  product.id,
    file_name:   'README.txt',
    file_path:   filePath,
    file_type:   'text/plain',
    file_size:   buffer.length,
    sha256_hash: sha256(buffer),
  })
  return filePath
}

// ── SALES DESCRIPTION ─────────────────────────────────────────
export async function generateSalesDescriptionFile(
  product: Product,
  copy: { sales_description?: string; bullet_points?: string[]; subtitle?: string }
): Promise<string> {
  const dir = await ensureProductDir(product.id)
  const content = `# ${product.title}

## ${copy.subtitle || product.subtitle || product.niche}

${copy.sales_description || product.description || ''}

## What You Get

${(copy.bullet_points || []).map((b) => `- ${b}`).join('\n')}

---
Price: $${product.price} ${product.currency}
`

  const buffer   = Buffer.from(content)
  const filePath = join(dir, 'marketing', 'sales-description.md')
  await writeFile(filePath, buffer)
  await storeFileRecord({
    product_id:  product.id,
    file_name:   'sales-description.md',
    file_path:   filePath,
    file_type:   'text/markdown',
    file_size:   buffer.length,
    sha256_hash: sha256(buffer),
  })
  return filePath
}

// ── KEYWORDS ──────────────────────────────────────────────────
export async function generateKeywordsFile(
  product: Product,
  copy: { tags?: string[]; keywords?: string[] }
): Promise<string> {
  const dir  = await ensureProductDir(product.id)
  const data = { tags: copy.tags || [], keywords: copy.keywords || [] }
  const buffer   = Buffer.from(JSON.stringify(data, null, 2))
  const filePath = join(dir, 'marketing', 'keywords.json')
  await writeFile(filePath, buffer)
  await storeFileRecord({
    product_id:  product.id,
    file_name:   'keywords.json',
    file_path:   filePath,
    file_type:   'application/json',
    file_size:   buffer.length,
    sha256_hash: sha256(buffer),
  })
  return filePath
}

// ── PRODUCT METADATA ──────────────────────────────────────────
export async function generateProductMetadata(product: Product): Promise<string> {
  const dir = await ensureProductDir(product.id)
  const metadata = {
    id:              product.id,
    title:           product.title,
    subtitle:        product.subtitle,
    description:     product.description,
    product_type:    product.product_type,
    niche:           product.niche,
    target_customer: product.target_customer,
    problem_solved:  product.problem_solved,
    price:           product.price,
    currency:        product.currency,
    tags:            product.tags,
    keywords:        product.keywords,
    generated_at:    new Date().toISOString(),
  }

  const buffer   = Buffer.from(JSON.stringify(metadata, null, 2))
  const filePath = join(dir, 'product.json')
  await writeFile(filePath, buffer)
  await storeFileRecord({
    product_id:  product.id,
    file_name:   'product.json',
    file_path:   filePath,
    file_type:   'application/json',
    file_size:   buffer.length,
    sha256_hash: sha256(buffer),
  })
  return filePath
}

// ── PLACEHOLDER COVER (SVG — zero external deps) ──────────────
// Escape text for safe SVG embedding
function svgText(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x20-\x7E]/g, '') // strip non-printable / non-ASCII
}

// Pick a colour palette based on product type
function paletteFor(productType: string): { bg1: string; bg2: string; accent1: string; accent2: string; badge: string } {
  const palettes: Record<string, { bg1: string; bg2: string; accent1: string; accent2: string; badge: string }> = {
    EBOOK:               { bg1: '#0f172a', bg2: '#1e3a5f', accent1: '#0ea5e9', accent2: '#6366f1', badge: '#0ea5e9' },
    WORKBOOK:            { bg1: '#0f1f0f', bg2: '#14532d', accent1: '#22c55e', accent2: '#16a34a', badge: '#22c55e' },
    CHECKLIST:           { bg1: '#1a0f2e', bg2: '#3b0764', accent1: '#a855f7', accent2: '#7c3aed', badge: '#a855f7' },
    TEMPLATE:            { bg1: '#1c1208', bg2: '#431407', accent1: '#f97316', accent2: '#ea580c', badge: '#f97316' },
    SPREADSHEET_TEMPLATE:{ bg1: '#031f14', bg2: '#064e3b', accent1: '#10b981', accent2: '#059669', badge: '#10b981' },
    PROMPT_PACK:         { bg1: '#0c0a1e', bg2: '#1e1b4b', accent1: '#818cf8', accent2: '#6366f1', badge: '#818cf8' },
    FINANCIAL_TRACKER:   { bg1: '#0a1628', bg2: '#0c2a2a', accent1: '#14b8a6', accent2: '#0d9488', badge: '#14b8a6' },
    CONTENT_CALENDAR:    { bg1: '#1a0a0a', bg2: '#450a0a', accent1: '#ef4444', accent2: '#dc2626', badge: '#ef4444' },
    RESOURCE_LIBRARY:    { bg1: '#111827', bg2: '#1f2937', accent1: '#f59e0b', accent2: '#d97706', badge: '#f59e0b' },
  }
  return palettes[productType] ?? palettes['EBOOK']
}

// Icon glyph for each product type (simple ASCII/Latin-1 safe)
function iconFor(productType: string): string {
  const icons: Record<string, string> = {
    EBOOK:                '[E]',
    WORKBOOK:             '[W]',
    CHECKLIST:            '[C]',
    TEMPLATE:             '[T]',
    SPREADSHEET_TEMPLATE: '[S]',
    PROMPT_PACK:          '[P]',
    FINANCIAL_TRACKER:    '[$]',
    CONTENT_CALENDAR:     '[D]',
    RESOURCE_LIBRARY:     '[R]',
  }
  return icons[productType] ?? '[D]'
}

// Wrap a string into lines of maxChars each
function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line.trim())
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line.trim())
  return lines
}

// ── COVER IMAGE  800×1000 ─────────────────────────────────────
export async function generateCover(product: Product): Promise<string> {
  const dir = await ensureProductDir(product.id)
  const p   = paletteFor(product.product_type)

  const titleLines  = wrapLines(svgText(product.title.slice(0, 60)), 22)
  const nicheLabel  = svgText(product.niche.slice(0, 32).toUpperCase())
  const typeLabel   = svgText(product.product_type.replace(/_/g, ' '))
  const targetLabel = svgText(product.target_customer.slice(0, 55))
  const priceLabel  = `$${Number(product.price).toFixed(2)}`
  const icon        = iconFor(product.product_type)

  // Build dynamic title text elements (centred, stacked)
  const titleBaseY  = titleLines.length > 2 ? 390 : titleLines.length === 2 ? 410 : 430
  const titleElems  = titleLines.map((line, i) =>
    `<text x="400" y="${titleBaseY + i * 58}" font-family="Arial,Helvetica,sans-serif" font-size="46" font-weight="bold" fill="#ffffff" text-anchor="middle">${line}</text>`
  ).join('\n  ')

  const svg = `<svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bg1}"/>
      <stop offset="100%" stop-color="${p.bg2}"/>
    </linearGradient>
    <linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${p.accent1}"/>
      <stop offset="100%" stop-color="${p.accent2}"/>
    </linearGradient>
    <linearGradient id="fade" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="1000" fill="url(#bg)"/>
  <!-- Subtle top sheen -->
  <rect width="800" height="500" fill="url(#fade)"/>

  <!-- Accent top bar -->
  <rect x="0" y="0" width="800" height="8" fill="url(#acc)"/>

  <!-- Inner border card -->
  <rect x="32" y="32" width="736" height="936" rx="16" fill="none" stroke="${p.accent1}" stroke-width="1.5" stroke-opacity="0.35"/>

  <!-- Niche badge -->
  <rect x="56" y="56" width="${Math.min(nicheLabel.length * 11 + 32, 400)}" height="34" rx="17" fill="${p.badge}" fill-opacity="0.18"/>
  <text x="72" y="78" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="bold" fill="${p.badge}" letter-spacing="1.5">${nicheLabel}</text>

  <!-- Large icon area -->
  <rect x="300" y="140" width="200" height="200" rx="28" fill="${p.accent1}" fill-opacity="0.12"/>
  <rect x="300" y="140" width="200" height="200" rx="28" fill="none" stroke="${p.accent1}" stroke-width="1.5" stroke-opacity="0.3"/>
  <text x="400" y="263" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="bold" fill="${p.accent1}" text-anchor="middle" dominant-baseline="middle">${icon}</text>

  <!-- Title -->
  ${titleElems}

  <!-- Divider -->
  <rect x="160" y="${titleBaseY + titleLines.length * 58 + 18}" width="480" height="2" rx="1" fill="url(#acc)" opacity="0.5"/>

  <!-- Target customer -->
  <text x="400" y="${titleBaseY + titleLines.length * 58 + 62}" font-family="Arial,Helvetica,sans-serif" font-size="17" fill="#94a3b8" text-anchor="middle">For: ${targetLabel}</text>

  <!-- Bottom bar -->
  <rect x="0" y="920" width="800" height="80" fill="${p.accent1}" fill-opacity="0.08"/>
  <rect x="0" y="920" width="800" height="1.5" fill="url(#acc)" opacity="0.4"/>
  <text x="72" y="968" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="bold" fill="#ffffff" dominant-baseline="middle">${priceLabel}</text>
  <text x="400" y="968" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#64748b" text-anchor="middle" dominant-baseline="middle">${typeLabel}</text>
  <text x="728" y="968" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#64748b" text-anchor="end" dominant-baseline="middle">Digital Product</text>
</svg>`

  const buffer   = Buffer.from(svg)
  const filePath = join(dir, 'assets', 'cover.svg')
  await writeFile(filePath, buffer)

  try {
    await query(
      `INSERT INTO product_assets (product_id, asset_type, file_name, file_path, width, height)
       VALUES ($1, 'COVER', 'cover.svg', $2, 800, 1000)
       ON CONFLICT (product_id, asset_type) DO UPDATE
         SET file_path = EXCLUDED.file_path, file_name = EXCLUDED.file_name, width = 800, height = 1000`,
      [product.id, filePath]
    )
  } catch (err) {
    logger.warn('files', 'Failed to store cover asset record (non-fatal)', { error: String(err) })
  }

  logger.info('files', 'Generated cover image', { product_id: product.id })
  return filePath
}

// ── THUMBNAIL IMAGE  400×400 ──────────────────────────────────
export async function generateThumbnail(product: Product): Promise<string> {
  const dir = await ensureProductDir(product.id)
  const p   = paletteFor(product.product_type)

  const titleLines = wrapLines(svgText(product.title.slice(0, 40)), 18)
  const niche      = svgText(product.niche.slice(0, 28).toUpperCase())
  const price      = `$${Number(product.price).toFixed(2)}`
  const icon       = iconFor(product.product_type)

  const titleBaseY = titleLines.length > 1 ? 242 : 252
  const titleElems = titleLines.map((line, i) =>
    `<text x="200" y="${titleBaseY + i * 34}" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">${line}</text>`
  ).join('\n  ')

  const svg = `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bg1}"/>
      <stop offset="100%" stop-color="${p.bg2}"/>
    </linearGradient>
    <linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${p.accent1}"/>
      <stop offset="100%" stop-color="${p.accent2}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="400" height="400" fill="url(#bg)"/>
  <!-- Top accent bar -->
  <rect x="0" y="0" width="400" height="5" fill="url(#acc)"/>
  <!-- Border -->
  <rect x="10" y="10" width="380" height="380" rx="10" fill="none" stroke="${p.accent1}" stroke-width="1" stroke-opacity="0.3"/>

  <!-- Icon circle -->
  <circle cx="200" cy="110" r="52" fill="${p.accent1}" fill-opacity="0.14"/>
  <circle cx="200" cy="110" r="52" fill="none" stroke="${p.accent1}" stroke-width="1.5" stroke-opacity="0.35"/>
  <text x="200" y="110" font-family="Arial,Helvetica,sans-serif" font-size="36" font-weight="bold" fill="${p.accent1}" text-anchor="middle" dominant-baseline="middle">${icon}</text>

  <!-- Niche badge -->
  <rect x="20" y="175" width="${Math.min(niche.length * 9 + 24, 360)}" height="24" rx="12" fill="${p.badge}" fill-opacity="0.2"/>
  <text x="32" y="191" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="bold" fill="${p.badge}" letter-spacing="1.2">${niche}</text>

  <!-- Title -->
  ${titleElems}

  <!-- Bottom strip -->
  <rect x="0" y="356" width="400" height="44" fill="${p.accent1}" fill-opacity="0.1"/>
  <rect x="0" y="356" width="400" height="1.5" fill="url(#acc)" opacity="0.5"/>
  <text x="20" y="384" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="bold" fill="#ffffff" dominant-baseline="middle">${price}</text>
  <text x="380" y="384" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#64748b" text-anchor="end" dominant-baseline="middle">Digital Product</text>
</svg>`

  const buffer   = Buffer.from(svg)
  const filePath = join(dir, 'assets', 'thumbnail.svg')
  await writeFile(filePath, buffer)

  try {
    await query(
      `INSERT INTO product_assets (product_id, asset_type, file_name, file_path, width, height)
       VALUES ($1, 'THUMBNAIL', 'thumbnail.svg', $2, 400, 400)
       ON CONFLICT (product_id, asset_type) DO UPDATE
         SET file_path = EXCLUDED.file_path, file_name = EXCLUDED.file_name, width = 400, height = 400`,
      [product.id, filePath]
    )
  } catch (err) {
    logger.warn('files', 'Failed to store thumbnail asset record (non-fatal)', { error: String(err) })
  }

  logger.info('files', 'Generated thumbnail image', { product_id: product.id })
  return filePath
}

// Keep old name as alias so existing callers still compile
export const generatePlaceholderCover = generateCover

// ── ZIP PACKAGE ───────────────────────────────────────────────
export async function createZipPackage(product: Product): Promise<string> {
  const dir     = await ensureProductDir(product.id)
  const zipName = `${product.title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 60)}.zip`
  const zipPath = join(dir, 'exports', zipName)

  const zip = new AdmZip()

  // Add product files
  const files = await query<{ file_path: string; file_name: string }>(
    `SELECT file_path, file_name FROM product_files WHERE product_id = $1`,
    [product.id]
  )
  for (const file of files.rows) {
    try {
      if (existsSync(file.file_path)) {
        zip.addFile(file.file_name, await readFile(file.file_path))
      }
    } catch (err) {
      logger.warn('files', 'Skipping file in ZIP', { file: file.file_name, error: String(err) })
    }
  }

  // Add assets
  const assets = await query<{ file_path: string; file_name: string }>(
    `SELECT file_path, file_name FROM product_assets WHERE product_id = $1`,
    [product.id]
  )
  for (const asset of assets.rows) {
    try {
      if (existsSync(asset.file_path)) {
        zip.addFile(`assets/${asset.file_name}`, await readFile(asset.file_path))
      }
    } catch (err) {
      logger.warn('files', 'Skipping asset in ZIP', { file: asset.file_name, error: String(err) })
    }
  }

  // Guard: if zip is empty (all files missing), add a placeholder
  if (zip.getEntries().length === 0) {
    zip.addFile('README.txt', Buffer.from(`${product.title}\n\nFiles are being generated. Please regenerate.`))
  }

  zip.writeZip(zipPath)

  try {
    const zipBuffer = await readFile(zipPath)
    await storeFileRecord({
      product_id:  product.id,
      file_name:   zipName,
      file_path:   zipPath,
      file_type:   'application/zip',
      file_size:   zipBuffer.length,
      sha256_hash: sha256(zipBuffer),
    })
  } catch (err) {
    logger.warn('files', 'Failed to store ZIP record (non-fatal)', { error: String(err) })
  }

  logger.info('files', 'Created ZIP package', { product_id: product.id, path: zipPath })
  return zipPath
}
