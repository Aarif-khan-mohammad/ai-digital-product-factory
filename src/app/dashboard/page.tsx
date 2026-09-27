'use client'

import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { KPICard, StatusBadge, AutomationDot, ResourceBar, Spinner, EmptyState } from '@/components/ui'

interface DashboardData {
  kpis: {
    total_products: number; products_in_production: number; published_products: number
    total_units_sold: number; gross_revenue: number; net_revenue: number
    total_expenses: number; net_profit: number; profit_margin: number
  }
  pipeline: Record<string, Array<{ id: string; title: string; status: string; product_type: string; niche: string }>>
  automationStatus: { research: string; creation: string; qa: string; publishing: string; sales_sync: string }
  resourceUsage: { ai_requests_used: number; ai_requests_limit: number; storage_used_gb: number; storage_limit_gb: number; api_requests_used: number; api_requests_limit: number }
  revenueChart: Array<{ date: string; gross_revenue: number; net_revenue: number; units_sold: number }>
  ollamaHealth: { available: boolean; models: string[] }
}

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const ct = r.headers.get('content-type') || ''
        if (!ct.includes('application/json')) throw new Error('Server not ready')
        return r.json()
      })
      .then((r) => {
        if (r.success) setData(r.data)
        else setError(r.error)
        setLoading(false)
      })
      .catch(() => {
        setTimeout(() =>
          fetch('/api/dashboard')
            .then((r) => r.json())
            .then((r) => { if (r.success) setData(r.data); else setError(String(r.error)) })
            .catch((e) => setError(String(e)))
            .finally(() => setLoading(false))
        , 2000)
      })
  }, [])

  if (loading) return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-48 bg-surface-border rounded" />
          <div className="h-3 w-64 bg-surface-border rounded" />
        </div>
        <div className="h-4 w-32 bg-surface-border rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card h-24" />
        ))}
      </div>
      <div className="card h-56" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card h-40" />
        <div className="card h-40" />
        <div className="card h-40" />
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="card border-red-800 bg-red-950/30">
        <div className="text-red-400 font-medium mb-1">Dashboard Error</div>
        <div className="text-red-300 text-sm">{error}</div>
        <div className="text-slate-500 text-xs mt-2">Check your database connection and environment variables.</div>
      </div>
    </div>
  )

  if (!data) return null

  const { kpis, pipeline, automationStatus, resourceUsage, revenueChart, ollamaHealth } = data

  const PIPELINE_COLS = ['IDEAS','RESEARCH','APPROVED','CREATING','QA','READY','PUBLISHING','PUBLISHED','FAILED']

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Digital Product Factory</h1>
          <p className="text-slate-400 text-sm">Automated product creation & sales platform</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${ollamaHealth.available ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-xs text-slate-400">
            {ollamaHealth.available ? `Ollama: ${ollamaHealth.models[0] || 'connected'}` : 'Ollama offline'}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Total Products"    value={kpis.total_products}                      color="blue" />
        <KPICard title="In Production"     value={kpis.products_in_production}              color="purple" />
        <KPICard title="Published"         value={kpis.published_products}                  color="green" />
        <KPICard title="Units Sold"        value={kpis.total_units_sold}                    color="yellow" />
        <KPICard title="Gross Revenue"     value={fmt(kpis.gross_revenue)}                  color="green" />
        <KPICard title="Net Revenue"       value={fmt(kpis.net_revenue)}                    color="green" />
        <KPICard title="Total Expenses"    value={fmt(kpis.total_expenses)}                 color="red" />
        <KPICard title="Net Profit"        value={fmt(kpis.net_profit)}                     color="green" />
        <KPICard title="Profit Margin"     value={`${kpis.profit_margin.toFixed(1)}%`}      color="blue" />
      </div>

      {/* Revenue Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Revenue — Last 30 Days</h2>
        </div>
        {revenueChart.length === 0 ? (
          <EmptyState title="No revenue data yet" description="Import transactions to see revenue charts" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="gross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="gross_revenue" stroke="#0ea5e9" fill="url(#gross)" name="Gross" />
              <Area type="monotone" dataKey="net_revenue"   stroke="#10b981" fill="url(#net)"   name="Net" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Automation Status */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Automation Status</h2>
          <div className="space-y-3">
            {Object.entries(automationStatus).map(([key, status]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AutomationDot status={status} />
                  <span className="text-sm text-slate-300 capitalize">{key.replace('_', ' ')}</span>
                </div>
                <span className="text-xs text-slate-500">{status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Free Resource Usage */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Free Resource Usage</h2>
          <div className="space-y-4">
            <ResourceBar
              label="AI Requests"
              used={resourceUsage.ai_requests_used}
              limit={resourceUsage.ai_requests_limit}
            />
            <ResourceBar
              label="Storage"
              used={resourceUsage.storage_used_gb}
              limit={resourceUsage.storage_limit_gb}
              unit=" GB"
            />
            <ResourceBar
              label="API Calls"
              used={resourceUsage.api_requests_used}
              limit={resourceUsage.api_requests_limit}
            />
          </div>
        </div>

        {/* Pipeline Summary */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Pipeline Summary</h2>
          <div className="space-y-2">
            {PIPELINE_COLS.map((col) => {
              const count = pipeline[col]?.length || 0
              if (count === 0) return null
              return (
                <div key={col} className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">{col}</span>
                  <span className="text-sm font-medium text-slate-200">{count}</span>
                </div>
              )
            })}
            {PIPELINE_COLS.every((c) => !pipeline[c]?.length) && (
              <div className="text-slate-500 text-sm">No products in pipeline</div>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Kanban Preview */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">Production Pipeline</h2>
          <a href="/dashboard/pipeline" className="text-xs text-brand-400 hover:text-brand-300">View full pipeline →</a>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PIPELINE_COLS.map((col) => (
            <div key={col} className="min-w-[160px] flex-shrink-0">
              <div className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
                {col} <span className="text-slate-600">({pipeline[col]?.length || 0})</span>
              </div>
              <div className="space-y-2">
                {(pipeline[col] || []).slice(0, 3).map((p) => (
                  <a key={p.id} href={`/dashboard/products/${p.id}`}
                    className="block bg-surface-border/50 rounded-lg p-2 hover:bg-surface-border transition-colors">
                    <div className="text-xs font-medium text-slate-200 truncate">{p.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.niche}</div>
                  </a>
                ))}
                {(pipeline[col]?.length || 0) > 3 && (
                  <div className="text-xs text-slate-600 text-center">+{(pipeline[col]?.length || 0) - 3} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
