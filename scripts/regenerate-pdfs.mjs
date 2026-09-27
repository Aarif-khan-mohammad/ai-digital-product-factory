// Regenerate missing PDFs for products that have content_snapshot but no product.pdf
import pg from 'pg'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:8978022426@localhost:5432/digital_factory' })

const STORAGE_BASE = './products'

// Sanitize text to WinAnsi-safe characters (Helvetica/pdf-lib standard fonts)
function safe(text) {
  return String(text || '')
    .replace(/[\r\n\t]/g, ' ')                // newlines/tabs → space
    .replace(/[\u2010-\u2015\u2212]/g, '-')   // various hyphens/dashes → hyphen
    .replace(/[\u2018\u2019]/g, "'")           // smart single quotes
    .replace(/[\u201C\u201D]/g, '"')           // smart double quotes
    .replace(/[\u2026]/g, '...')               // ellipsis
    .replace(/[\u2013]/g, '-')                 // en dash
    .replace(/[\u2014]/g, '--')                // em dash
    .replace(/[^\x20-\xFF]/g, '')             // drop any remaining non-printable/non-latin1
    .replace(/\s+/g, ' ')                     // collapse multiple spaces
    .trim()
}
const W = 612, H = 792, MARGIN = 50
const TEXT_W = W - MARGIN * 2

function drawTextBlock(page, text, { x, startY, maxWidth, size, font, lineHeight = size + 4, color }) {
  const words = safe(text).split(' ')
  let currentLine = '', y = startY
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && currentLine) {
      if (y < 40) break
      page.drawText(currentLine, { x, y, size, font, color })
      y -= lineHeight; currentLine = word
    } else { currentLine = candidate }
  }
  if (currentLine && y >= 40) { page.drawText(currentLine, { x, y, size, font, color }); y -= lineHeight }
  return y
}

async function generatePDF(product, content) {
  const dir = join(STORAGE_BASE, product.id)
  await mkdir(join(dir, 'content'), { recursive: true })

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const darkBlue = rgb(0.05, 0.1, 0.2)
  const white = rgb(1,1,1)

  // Cover
  const cover = pdfDoc.addPage([W, H])
  cover.drawRectangle({ x: 0, y: 0, width: W, height: H, color: darkBlue })
  cover.drawRectangle({ x: MARGIN, y: 80, width: TEXT_W, height: H - 160, color: rgb(0.08, 0.14, 0.28) })
  let titleY = 560, titleLine = ''
  for (const w of safe(product.title).split(' ')) {
    const candidate = titleLine ? `${titleLine} ${w}` : w
    if (bold.widthOfTextAtSize(candidate, 26) > TEXT_W - 20 && titleLine) {
      cover.drawText(titleLine, { x: MARGIN + 10, y: titleY, size: 26, font: bold, color: white })
      titleY -= 36; titleLine = w
    } else { titleLine = candidate }
  }
  if (titleLine) cover.drawText(titleLine, { x: MARGIN + 10, y: titleY, size: 26, font: bold, color: white })
  cover.drawText(safe(product.subtitle || product.niche || '').slice(0, 70), { x: MARGIN + 10, y: titleY - 40, size: 14, font, color: rgb(0.6, 0.75, 0.9) })
  cover.drawText(`For: ${safe(product.target_customer || '').slice(0, 65)}`, { x: MARGIN + 10, y: titleY - 64, size: 12, font, color: rgb(0.5, 0.65, 0.8) })
  cover.drawText(`$${product.price} ${product.currency}`, { x: MARGIN + 10, y: 120, size: 14, font: bold, color: rgb(0.3, 0.8, 0.4) })

  const outline = (content.outline || []).slice(0, 12)

  // ToC
  if (outline.length > 0) {
    const toc = pdfDoc.addPage([W, H])
    toc.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: darkBlue })
    toc.drawText('Contents', { x: MARGIN, y: H - 38, size: 18, font: bold, color: white })
    let tocY = H - 100
    outline.forEach((s, i) => {
      if (tocY < 60) return
      toc.drawText(`${i + 1}`, { x: MARGIN, y: tocY, size: 12, font: bold, color: rgb(0.3, 0.5, 0.8) })
      toc.drawText(safe(s), { x: MARGIN + 24, y: tocY, size: 12, font, color: rgb(0.1, 0.1, 0.1) })
      tocY -= 30
    })
  }

  // Quick start
  if (content.quick_start) {
    const qs = pdfDoc.addPage([W, H])
    qs.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: rgb(0.12, 0.22, 0.42) })
    qs.drawText('Quick Start', { x: MARGIN, y: H - 38, size: 18, font: bold, color: white })
    drawTextBlock(qs, content.quick_start, { x: MARGIN, startY: H - 84, maxWidth: TEXT_W, size: 12, font, lineHeight: 18, color: rgb(0.1, 0.1, 0.1) })
  }

  // Sections
  const sectionsMap = content.sections || {}
  for (let i = 0; i < outline.length; i++) {
    const title = outline[i]
    const sec = sectionsMap[title] || {}
    const page = pdfDoc.addPage([W, H])
    page.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: darkBlue })
    page.drawText(safe(title).slice(0, 65), { x: MARGIN, y: H - 38, size: 16, font: bold, color: white })
    page.drawText(`${i+1}/${outline.length}`, { x: W - MARGIN - 36, y: H - 38, size: 9, font, color: rgb(0.5, 0.65, 0.85) })
    let y = H - 80

    if (sec.intro) {
      y = drawTextBlock(page, sec.intro, { x: MARGIN, startY: y, maxWidth: TEXT_W, size: 11, font, lineHeight: 17, color: rgb(0.12, 0.12, 0.12) })
      y -= 16
    }
    if (sec.key_points?.length) {
      page.drawText('KEY POINTS', { x: MARGIN, y, size: 8, font: bold, color: rgb(0.3, 0.5, 0.8) }); y -= 14
      for (const kp of sec.key_points) {
        if (y < 70) break
        page.drawText('•', { x: MARGIN, y, size: 11, font: bold, color: rgb(0.2, 0.45, 0.75) })
        y = drawTextBlock(page, kp, { x: MARGIN + 14, startY: y, maxWidth: TEXT_W - 14, size: 11, font, lineHeight: 16, color: rgb(0.12, 0.12, 0.12) })
        y -= 4
      }
      y -= 10
    }
    if (sec.steps?.length) {
      page.drawText('ACTION STEPS', { x: MARGIN, y, size: 8, font: bold, color: rgb(0.3, 0.5, 0.8) }); y -= 14
      sec.steps.forEach((step, n) => {
        if (y < 70) return
        page.drawText(`${n+1}.`, { x: MARGIN, y, size: 11, font: bold, color: rgb(0.1, 0.3, 0.6) })
        y = drawTextBlock(page, step, { x: MARGIN + 20, startY: y, maxWidth: TEXT_W - 20, size: 11, font, lineHeight: 16, color: rgb(0.12, 0.12, 0.12) })
        y -= 6
      })
      y -= 10
    }
    if (sec.exercise && y > 100) {
      const boxH = Math.min(90, 24 + Math.ceil(sec.exercise.length / 60) * 16)
      if (y - boxH > 50) {
        page.drawRectangle({ x: MARGIN - 4, y: y - boxH + 12, width: TEXT_W + 8, height: boxH, color: rgb(0.94, 0.97, 1.0) })
        page.drawRectangle({ x: MARGIN - 4, y: y - boxH + 12, width: 3, height: boxH, color: rgb(0.2, 0.45, 0.75) })
        page.drawText('EXERCISE', { x: MARGIN + 4, y: y - 2, size: 9, font: bold, color: rgb(0.2, 0.45, 0.75) })
        y = drawTextBlock(page, sec.exercise, { x: MARGIN + 4, startY: y - 16, maxWidth: TEXT_W - 8, size: 10, font, lineHeight: 15, color: rgb(0.1, 0.1, 0.1) })
        y -= 16
      }
    }
    if (sec.takeaway && y > 80) {
      const boxH = Math.min(60, 24 + Math.ceil(sec.takeaway.length / 60) * 16)
      if (y - boxH > 50) {
        page.drawRectangle({ x: MARGIN - 4, y: y - boxH + 12, width: TEXT_W + 8, height: boxH, color: rgb(0.96, 1.0, 0.95) })
        page.drawRectangle({ x: MARGIN - 4, y: y - boxH + 12, width: 3, height: boxH, color: rgb(0.15, 0.6, 0.3) })
        page.drawText('KEY TAKEAWAY', { x: MARGIN + 4, y: y - 2, size: 9, font: bold, color: rgb(0.15, 0.6, 0.3) })
        drawTextBlock(page, sec.takeaway, { x: MARGIN + 4, startY: y - 16, maxWidth: TEXT_W - 8, size: 10, font, lineHeight: 15, color: rgb(0.1, 0.1, 0.1) })
      }
    }
  }

  // Instructions
  const instrRaw = content.instructions
  const instrText = Array.isArray(instrRaw) ? instrRaw.join('\n') : (instrRaw || '')
  if (instrText) {
    const instrPage = pdfDoc.addPage([W, H])
    instrPage.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: darkBlue })
    instrPage.drawText('How to Use This Guide', { x: MARGIN, y: H - 38, size: 18, font: bold, color: white })
    let iy = H - 80
    for (const line of instrText.split('\n')) {
      if (iy < 60) break
      iy = drawTextBlock(instrPage, line, { x: MARGIN, startY: iy, maxWidth: TEXT_W, size: 11, font, lineHeight: 17, color: rgb(0.12, 0.12, 0.12) })
      iy -= 6
    }
  }

  // FAQ
  const faqs = (content.faq || []).slice(0, 10)
  if (faqs.length) {
    const faqPage = pdfDoc.addPage([W, H])
    faqPage.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: darkBlue })
    faqPage.drawText('Frequently Asked Questions', { x: MARGIN, y: H - 38, size: 18, font: bold, color: white })
    let fy = H - 86
    for (const item of faqs) {
      if (fy < 80) break
      faqPage.drawText(`Q: ${safe(item.q).slice(0, 80)}`, { x: MARGIN, y: fy, size: 12, font: bold, color: rgb(0.1, 0.1, 0.3) })
      fy -= 18
      fy = drawTextBlock(faqPage, `A: ${item.a}`, { x: MARGIN + 10, startY: fy, maxWidth: TEXT_W - 10, size: 11, font, lineHeight: 15, color: rgb(0.2, 0.2, 0.2) })
      fy -= 16
    }
  }

  const bytes = await pdfDoc.save()
  const buffer = Buffer.from(bytes)
  const filePath = join(dir, 'content', 'product.pdf')
  await writeFile(filePath, buffer)

  const hash = createHash('sha256').update(buffer).digest('hex')

  // Upsert into product_files
  await pool.query(
    `INSERT INTO product_files (product_id, file_name, file_path, file_type, file_size, sha256_hash, is_primary)
     VALUES ($1, $2, $3, 'application/pdf', $4, $5, true)
     ON CONFLICT (product_id, file_name) DO UPDATE SET
       file_path = EXCLUDED.file_path, file_size = EXCLUDED.file_size, sha256_hash = EXCLUDED.sha256_hash`,
    [product.id, 'product.pdf', filePath, buffer.length, hash]
  )

  console.log(`✅ ${product.title} — ${pdfDoc.getPageCount()} pages, ${buffer.length} bytes → ${filePath}`)
}

// Find products with content_snapshot but no product.pdf in product_files
const { rows: products } = await pool.query(`
  SELECT p.id, p.title, p.subtitle, p.niche, p.price, p.currency, p.target_customer,
         pv.content_snapshot
  FROM products p
  JOIN product_versions pv ON pv.product_id = p.id
  WHERE NOT EXISTS (
    SELECT 1 FROM product_files pf
    WHERE pf.product_id = p.id AND pf.file_name = 'product.pdf'
  )
  ORDER BY p.created_at DESC
`)

if (products.length === 0) {
  console.log('All products already have PDFs.')
  process.exit(0)
}

console.log(`Regenerating PDFs for ${products.length} product(s)...`)
for (const row of products) {
  const content = typeof row.content_snapshot === 'string'
    ? JSON.parse(row.content_snapshot)
    : row.content_snapshot
  await generatePDF(row, content)
}

await pool.end()
console.log('Done.')
