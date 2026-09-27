import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await query(`
      SELECT
        p.id, p.title, p.subtitle, p.description, p.product_type,
        p.niche, p.price, p.currency, p.tags, p.keywords,
        p.published_at,
        LOWER(REGEXP_REPLACE(p.title, '[^a-zA-Z0-9]+', '-', 'g')) as slug,
        (
          SELECT pp.product_url
          FROM published_products pp
          JOIN publishing_channels pc ON pc.id = pp.channel_id
          WHERE pp.product_id = p.id
            AND pp.publication_status = 'PUBLISHED'
            AND pc.channel_type IN ('GUMROAD','PAYHIP')
          ORDER BY pp.published_at DESC
          LIMIT 1
        ) as purchase_url
      FROM products p
      WHERE p.status IN ('PUBLISHED', 'SALES_TRACKING')
      ORDER BY p.published_at DESC
    `)
    return NextResponse.json({ success: true, data: result.rows })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
