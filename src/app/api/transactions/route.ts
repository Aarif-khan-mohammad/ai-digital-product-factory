import { NextRequest, NextResponse } from 'next/server'
import { importTransaction } from '@/lib/financials/engine'
import { query } from '@/lib/db/client'
import { createNotification } from '@/lib/notifications/engine'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const result = await query(
      `SELECT t.*, p.title as product_title, pc.name as channel_name
       FROM transactions t
       JOIN products p ON p.id = t.product_id
       JOIN publishing_channels pc ON pc.id = t.channel_id
       ORDER BY t.sale_date DESC LIMIT $1`,
      [limit]
    )
    return NextResponse.json({ success: true, data: result.rows })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tx = await importTransaction({
      product_id:             body.product_id,
      channel_id:             body.channel_id,
      external_order_id:      body.external_order_id || null,
      customer_country:       body.customer_country  || null,
      sale_date:              new Date(body.sale_date),
      quantity:               body.quantity           || 1,
      gross_amount:           body.gross_amount       || 0,
      discount:               body.discount           || 0,
      refund_amount:          body.refund_amount      || 0,
      platform_fee:           body.platform_fee       || 0,
      payment_processing_fee: body.payment_processing_fee || 0,
      other_fee:              body.other_fee          || 0,
      net_revenue:            body.net_revenue        || 0,
      currency:               body.currency           || 'USD',
    })

    await createNotification({
      event:      'sale.received',
      title:      'Sale Received',
      message:    `New sale: $${tx.gross_amount} ${tx.currency}`,
      product_id: tx.product_id,
    })

    return NextResponse.json({ success: true, data: tx }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
