import { NextRequest, NextResponse } from 'next/server'
import { addExpense } from '@/lib/financials/engine'
import { query } from '@/lib/db/client'

export async function GET() {
  try {
    const result = await query(
      `SELECT e.*, p.title as product_title
       FROM expenses e
       LEFT JOIN products p ON p.id = e.product_id
       ORDER BY e.expense_date DESC LIMIT 100`
    )
    return NextResponse.json({ success: true, data: result.rows })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const expense = await addExpense({
      product_id:   body.product_id   || null,
      category:     body.category     || 'OTHER',
      description:  body.description,
      amount:       parseFloat(body.amount),
      currency:     body.currency     || 'USD',
      expense_date: new Date(body.expense_date),
    })
    return NextResponse.json({ success: true, data: expense }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
