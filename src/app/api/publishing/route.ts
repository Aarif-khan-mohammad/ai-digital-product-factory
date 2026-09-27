import { NextRequest, NextResponse } from 'next/server'
import { getEnabledChannels } from '@/lib/publishing/engine'
import { query } from '@/lib/db/client'

export async function GET() {
  try {
    const [channels, published] = await Promise.all([
      query(`SELECT * FROM publishing_channels ORDER BY name`),
      query<{
        pp_id: string; product_id: string; channel_name: string; channel_type: string
        product_url: string; publication_status: string; price: string
        published_at: string; last_sync_at: string; sync_status: string; title: string
      }>(
        `SELECT pp.id as pp_id, pp.product_id, pc.name as channel_name, pc.channel_type,
                pp.product_url, pp.publication_status, pp.price, pp.published_at,
                pp.last_sync_at, pp.sync_status, p.title
         FROM published_products pp
         JOIN publishing_channels pc ON pc.id = pp.channel_id
         JOIN products p ON p.id = pp.product_id
         ORDER BY pp.published_at DESC NULLS LAST`
      ),
    ])

    return NextResponse.json({
      success: true,
      data: {
        channels: channels.rows,
        published: published.rows.map((r) => ({ ...r, id: r.pp_id })),
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

// PATCH /api/publishing — update channel config/enabled state
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: string; enabled?: boolean; config?: Record<string, unknown> }
    if (!body.id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })

    const updates: string[] = []
    const values: unknown[] = []
    let i = 1

    if (body.enabled !== undefined) { updates.push(`enabled = $${i++}`); values.push(body.enabled) }
    if (body.config !== undefined)  { updates.push(`config = $${i++}`);  values.push(JSON.stringify(body.config)) }

    if (updates.length === 0) return NextResponse.json({ success: false, error: 'Nothing to update' }, { status: 400 })

    values.push(body.id)
    await query(`UPDATE publishing_channels SET ${updates.join(', ')} WHERE id = $${i}`, values)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
