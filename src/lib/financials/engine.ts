// ============================================================
// FINANCIAL ENGINE — Revenue, Fees, Profit Calculations
// ============================================================

import { query } from '@/lib/db/client'
import type { FinancialSummary, Transaction, Expense } from '@/types'

export async function importTransaction(data: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
  const net_revenue = data.net_revenue ||
    data.gross_amount - data.discount - data.refund_amount - data.platform_fee - data.payment_processing_fee - data.other_fee

  const result = await query<Transaction>(
    `INSERT INTO transactions
      (product_id, channel_id, external_order_id, customer_country, sale_date, quantity,
       gross_amount, discount, refund_amount, platform_fee, payment_processing_fee,
       other_fee, net_revenue, currency)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      data.product_id, data.channel_id, data.external_order_id || null,
      data.customer_country || null, data.sale_date, data.quantity,
      data.gross_amount, data.discount, data.refund_amount, data.platform_fee,
      data.payment_processing_fee, data.other_fee, net_revenue, data.currency,
    ]
  )
  await updateDailyMetrics(data.sale_date)
  return result.rows[0]
}

export async function getFinancialSummary(params: {
  product_id?: string
  channel_id?: string
  from?: Date
  to?: Date
}): Promise<FinancialSummary> {
  const conditions: string[] = []
  const values: unknown[] = []
  let i = 1

  if (params.product_id) { conditions.push(`product_id = $${i++}`); values.push(params.product_id) }
  if (params.channel_id) { conditions.push(`channel_id = $${i++}`); values.push(params.channel_id) }
  if (params.from)       { conditions.push(`sale_date >= $${i++}`); values.push(params.from) }
  if (params.to)         { conditions.push(`sale_date <= $${i++}`); values.push(params.to) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const txResult = await query<{
    gross_revenue: string; total_discounts: string; total_refunds: string
    total_platform_fees: string; total_payment_fees: string; net_revenue: string
    units_sold: string; total_orders: string; refund_count: string
  }>(
    `SELECT
       SUM(gross_amount)           as gross_revenue,
       SUM(discount)               as total_discounts,
       SUM(refund_amount)          as total_refunds,
       SUM(platform_fee)           as total_platform_fees,
       SUM(payment_processing_fee) as total_payment_fees,
       SUM(net_revenue)            as net_revenue,
       SUM(quantity)               as units_sold,
       COUNT(*)                    as total_orders,
       COUNT(*) FILTER (WHERE refund_amount > 0) as refund_count
     FROM transactions ${where}`,
    values
  )

  const tx = txResult.rows[0]

  const expConditions: string[] = []
  const expValues: unknown[] = []
  let j = 1
  if (params.product_id) { expConditions.push(`product_id = $${j++}`); expValues.push(params.product_id) }
  if (params.from)       { expConditions.push(`expense_date >= $${j++}`); expValues.push(params.from) }
  if (params.to)         { expConditions.push(`expense_date <= $${j++}`); expValues.push(params.to) }

  const expWhere = expConditions.length ? `WHERE ${expConditions.join(' AND ')}` : ''
  const expResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM expenses ${expWhere}`, expValues
  )

  const gross_revenue       = parseFloat(tx.gross_revenue       || '0')
  const total_discounts     = parseFloat(tx.total_discounts     || '0')
  const total_refunds       = parseFloat(tx.total_refunds       || '0')
  const total_platform_fees = parseFloat(tx.total_platform_fees || '0')
  const total_payment_fees  = parseFloat(tx.total_payment_fees  || '0')
  const net_revenue         = parseFloat(tx.net_revenue         || '0')
  const total_expenses      = parseFloat(expResult.rows[0]?.total || '0')
  const units_sold          = parseInt(tx.units_sold            || '0')
  const total_orders        = parseInt(tx.total_orders          || '0')
  const refund_count        = parseInt(tx.refund_count          || '0')
  const net_profit          = net_revenue - total_expenses
  const profit_margin       = net_revenue > 0 ? (net_profit / net_revenue) * 100 : 0

  return {
    gross_revenue, total_discounts, total_refunds, total_platform_fees,
    total_payment_fees, net_revenue, total_expenses, net_profit,
    profit_margin:       Math.round(profit_margin * 100) / 100,
    units_sold,
    average_order_value: total_orders > 0 ? Math.round((gross_revenue / total_orders) * 100) / 100 : 0,
    refund_rate:         total_orders > 0 ? Math.round((refund_count / total_orders) * 10000) / 100 : 0,
  }
}

export async function getProductPerformance(limit = 20) {
  const result = await query<{
    product_id: string; title: string; product_type: string
    units_sold: string; gross_revenue: string; net_revenue: string
    total_expenses: string; refund_count: string; total_orders: string
  }>(
    `SELECT
       t.product_id, p.title, p.product_type,
       SUM(t.quantity)     as units_sold,
       SUM(t.gross_amount) as gross_revenue,
       SUM(t.net_revenue)  as net_revenue,
       COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.product_id = t.product_id), 0) as total_expenses,
       COUNT(*) FILTER (WHERE t.refund_amount > 0) as refund_count,
       COUNT(*) as total_orders
     FROM transactions t
     JOIN products p ON p.id = t.product_id
     GROUP BY t.product_id, p.title, p.product_type
     ORDER BY gross_revenue DESC LIMIT $1`,
    [limit]
  )

  return result.rows.map((row) => {
    const net_revenue    = parseFloat(row.net_revenue    || '0')
    const total_expenses = parseFloat(row.total_expenses || '0')
    const net_profit     = net_revenue - total_expenses
    const total_orders   = parseInt(row.total_orders || '0')
    return {
      product_id: row.product_id, title: row.title, product_type: row.product_type,
      units_sold:    parseInt(row.units_sold    || '0'),
      gross_revenue: parseFloat(row.gross_revenue || '0'),
      net_revenue, net_profit,
      profit_margin: net_revenue > 0 ? Math.round((net_profit / net_revenue) * 10000) / 100 : 0,
      refund_rate:   total_orders > 0 ? Math.round((parseInt(row.refund_count || '0') / total_orders) * 10000) / 100 : 0,
    }
  })
}

export async function getChannelPerformance() {
  const result = await query<{
    channel_id: string; channel_name: string; products: string
    units_sold: string; gross_revenue: string; total_fees: string; net_revenue: string
  }>(
    `SELECT
       t.channel_id, pc.name as channel_name,
       COUNT(DISTINCT t.product_id) as products,
       SUM(t.quantity)   as units_sold,
       SUM(t.gross_amount) as gross_revenue,
       SUM(t.platform_fee + t.payment_processing_fee + t.other_fee) as total_fees,
       SUM(t.net_revenue)  as net_revenue
     FROM transactions t
     JOIN publishing_channels pc ON pc.id = t.channel_id
     GROUP BY t.channel_id, pc.name ORDER BY gross_revenue DESC`
  )
  return result.rows.map((row) => ({
    channel_id:    row.channel_id,
    channel_name:  row.channel_name,
    products:      parseInt(row.products      || '0'),
    units_sold:    parseInt(row.units_sold    || '0'),
    gross_revenue: parseFloat(row.gross_revenue || '0'),
    total_fees:    parseFloat(row.total_fees    || '0'),
    net_revenue:   parseFloat(row.net_revenue   || '0'),
  }))
}

export async function getDailyRevenue(days = 30) {
  const result = await query<{
    date: string; gross_revenue: string; net_revenue: string; units_sold: string
  }>(
    `SELECT
       sale_date::date as date,
       SUM(gross_amount) as gross_revenue,
       SUM(net_revenue)  as net_revenue,
       SUM(quantity)     as units_sold
     FROM transactions
     WHERE sale_date >= NOW() - INTERVAL '${days} days'
     GROUP BY sale_date::date ORDER BY date ASC`
  )
  return result.rows.map((row) => ({
    date:          row.date,
    gross_revenue: parseFloat(row.gross_revenue || '0'),
    net_revenue:   parseFloat(row.net_revenue   || '0'),
    units_sold:    parseInt(row.units_sold       || '0'),
  }))
}

async function updateDailyMetrics(date: Date) {
  const dateStr = date.toISOString().split('T')[0]
  const txResult = await query<{ units_sold: string; gross_revenue: string; net_revenue: string }>(
    `SELECT SUM(quantity) as units_sold, SUM(gross_amount) as gross_revenue, SUM(net_revenue) as net_revenue
     FROM transactions WHERE sale_date::date = $1`,
    [dateStr]
  )
  const tx = txResult.rows[0]
  await query(
    `INSERT INTO daily_metrics (date, units_sold, gross_revenue, net_revenue)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (date) DO UPDATE SET
       units_sold    = EXCLUDED.units_sold,
       gross_revenue = EXCLUDED.gross_revenue,
       net_revenue   = EXCLUDED.net_revenue`,
    [dateStr, parseInt(tx.units_sold || '0'), parseFloat(tx.gross_revenue || '0'), parseFloat(tx.net_revenue || '0')]
  )
}

export async function addExpense(data: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> {
  const result = await query<Expense>(
    `INSERT INTO expenses (product_id, category, description, amount, currency, expense_date)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.product_id || null, data.category, data.description, data.amount, data.currency, data.expense_date]
  )
  return result.rows[0]
}
