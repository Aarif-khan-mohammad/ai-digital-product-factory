// ============================================================
// DASHBOARD SERVICE — Aggregates all KPIs and status data
// ============================================================

import { query } from '@/lib/db/client'
import { getFinancialSummary, getDailyRevenue } from '@/lib/financials/engine'
import { checkOllamaHealth } from '@/lib/ai/provider'
import type { DashboardKPIs, AutomationStatus, ResourceUsage } from '@/types'

export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const [productsRes, financials] = await Promise.all([
    query<{ total: string; in_production: string; published: string }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status NOT IN ('PUBLISHED','ARCHIVED','FAILED')) as in_production,
         COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published
       FROM products`
    ),
    getFinancialSummary({}),
  ])

  const p = productsRes.rows[0]
  return {
    total_products:         parseInt(p.total          || '0'),
    products_in_production: parseInt(p.in_production  || '0'),
    published_products:     parseInt(p.published      || '0'),
    total_units_sold:       financials.units_sold,
    gross_revenue:          financials.gross_revenue,
    net_revenue:            financials.net_revenue,
    total_expenses:         financials.total_expenses,
    net_profit:             financials.net_profit,
    profit_margin:          financials.profit_margin,
  }
}

export async function getPipelineData() {
  const result = await query<{
    id: string; title: string; product_type: string; niche: string
    status: string; qa_score: string; price: string
    created_at: Date; updated_at: Date; opportunity_score: string; revision_count: number
  }>(
    `SELECT id, title, product_type, niche, status, qa_score, price,
            created_at, updated_at, opportunity_score, revision_count
     FROM products WHERE status NOT IN ('ARCHIVED')
     ORDER BY updated_at DESC LIMIT 100`
  )

  const columns: Record<string, typeof result.rows> = {
    IDEAS: [], RESEARCH: [], APPROVED: [], CREATING: [],
    QA: [], READY: [], PUBLISHING: [], PUBLISHED: [], FAILED: [],
  }

  const statusMap: Record<string, string> = {
    IDEA_DISCOVERED:       'IDEAS',
    RESEARCHING:           'RESEARCH',
    OPPORTUNITY_SCORED:    'RESEARCH',
    APPROVED_FOR_CREATION: 'APPROVED',
    CREATING:              'CREATING',
    CONTENT_GENERATED:     'CREATING',
    ASSETS_GENERATED:      'CREATING',
    QA_IN_PROGRESS:        'QA',
    QA_FAILED:             'QA',
    REVISION_REQUIRED:     'QA',
    READY_TO_PUBLISH:      'READY',
    PUBLISHING:            'PUBLISHING',
    PUBLISHED:             'PUBLISHED',
    SALES_TRACKING:        'PUBLISHED',
    PAUSED:                'READY',
    FAILED:                'FAILED',
  }

  for (const product of result.rows) {
    const col = statusMap[product.status] || 'IDEAS'
    columns[col].push(product)
  }

  return columns
}

export async function getAutomationStatus(): Promise<AutomationStatus> {
  const today = new Date().toISOString().split('T')[0]
  const result = await query<{ workflow_name: string; status: string }>(
    `SELECT DISTINCT ON (workflow_name) workflow_name, status
     FROM workflow_runs WHERE started_at::date = $1
     ORDER BY workflow_name, started_at DESC`,
    [today]
  )

  const statusMap: Record<string, string> = {}
  for (const row of result.rows) statusMap[row.workflow_name] = row.status

  const toStatus = (wf: string): AutomationStatus[keyof AutomationStatus] => {
    const s = statusMap[wf]
    if (s === 'RUNNING')   return 'RUNNING'
    if (s === 'COMPLETED') return 'IDLE'
    if (s === 'FAILED')    return 'ERROR'
    return 'IDLE'
  }

  return {
    research:   toStatus('DAILY_MARKET_RESEARCH'),
    creation:   toStatus('PRODUCT_CREATION'),
    qa:         toStatus('PRODUCT_QA'),
    publishing: toStatus('MARKETPLACE_PUBLISHING'),
    sales_sync: toStatus('SALES_SYNCHRONIZATION'),
  }
}

export async function getResourceUsage(): Promise<ResourceUsage> {
  const today = new Date().toISOString().split('T')[0]
  const [aiRes, storageRes, apiRes] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) as count FROM ai_usage WHERE created_at::date = $1`, [today]),
    query<{ total_bytes: string }>(`SELECT COALESCE(SUM(file_size),0) as total_bytes FROM product_files`),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM workflow_runs WHERE started_at::date = $1`, [today]),
  ])

  return {
    ai_requests_used:   parseInt(aiRes.rows[0]?.count      || '0'),
    ai_requests_limit:  parseInt(process.env.MAX_DAILY_AI_REQUESTS || '200'),
    storage_used_gb:    Math.round((parseFloat(storageRes.rows[0]?.total_bytes || '0') / 1_073_741_824) * 1000) / 1000,
    storage_limit_gb:   parseFloat(process.env.MAX_STORAGE_GB || '10'),
    api_requests_used:  parseInt(apiRes.rows[0]?.count     || '0'),
    api_requests_limit: parseInt(process.env.MAX_API_REQUESTS || '1000'),
  }
}

export async function getProductTimeline(productId: string) {
  const result = await query(
    `SELECT event_type, description, metadata, created_at
     FROM product_timeline_events WHERE product_id = $1 ORDER BY created_at ASC`,
    [productId]
  )
  return result.rows
}

export async function getFullDashboard() {
  const [kpis, pipeline, automationStatus, resourceUsage, revenueChart, ollamaHealth] =
    await Promise.all([
      getDashboardKPIs(),
      getPipelineData(),
      getAutomationStatus(),
      getResourceUsage(),
      getDailyRevenue(30),
      checkOllamaHealth(),
    ])
  return { kpis, pipeline, automationStatus, resourceUsage, revenueChart, ollamaHealth }
}
