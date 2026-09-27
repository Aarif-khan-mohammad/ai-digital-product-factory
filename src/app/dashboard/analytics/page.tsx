'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Spinner, EmptyState } from '@/components/ui'

interface AnalyticsData {
  summary: {
    gross_revenue: number; net_revenue: number; net_profit: number
    units_sold: number; profit_margin: number; refund_rate: number
    average_order_value: number; total_expenses: number
  }
  products: Array<{
    product_id: string; title: string; units_sold: number
    gross_revenue: number; net_revenue: number; net_profit: number
    profit_margin: number; refund_rate: number
  }>
  channels: Array<{
    channel_name: string; products: number; units_sold: number
    gross_revenue: number; total_fees: number; net_revenue: number
  }>
  daily: Array<{ date: string; gross_revenue: number; net_revenue: number; units_sold: number }>
}

const fmt = (n: number) => `$${n.toFixed(2)}`

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [sortBy, setSortBy] = useState<'gross_revenue'|'units_sold'|'net_profit'>('gross_revenue')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/financials?days=${days}`)
      .then((r) => r.json())
      .then((r) => { if (r.success) setData(r.data) })
      .finally(() => setLoading(false))
  }, [days])

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>
  if (!data) return null

  const { summary, products, channels, daily } = data
  const sortedProducts = [...products].sort((a, b) => b[sortBy] - a[sortBy])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Business Analytics</h1>
        <div className="flex gap-2">
          {[7,30,90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${days === d ? 'bg-brand-600 border-brand-500 text-white' : 'bg-surface-card border-surface-border text-slate-400'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Gross Revenue',  value: fmt(summary.gross_revenue),  color: 'text-brand-400' },
          { label: 'Net Revenue',    value: fmt(summary.net_revenue),    color: 'text-emerald-400' },
          { label: 'Net Profit',     value: fmt(summary.net_profit),     color: 'text-emerald-400' },
          { label: 'Profit Margin',  value: `${summary.profit_margin.toFixed(1)}%`, color: 'text-emerald-400' },
          { label: 'Units Sold',     value: summary.units_sold,          color: 'text-yellow-400' },
          { label: 'Avg Order Value',value: fmt(summary.average_order_value), color: 'text-blue-400' },
          { label: 'Refund Rate',    value: `${summary.refund_rate.toFixed(1)}%`, color: 'text-red-400' },
          { label: 'Total Expenses', value: fmt(summary.total_expenses), color: 'text-red-400' },
        ].map((k) => (
          <div key={k.label} className="card">
            <div className="text-xs text-slate-400 mb-1">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Revenue vs Profit — {days} Days</h2>
        {daily.length === 0 ? (
          <EmptyState title="No revenue data" description="Import transactions to see charts" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={daily}>
              <defs>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="gross_revenue" stroke="#0ea5e9" fill="url(#cg)" name="Gross Revenue" />
              <Area type="monotone" dataKey="net_revenue"   stroke="#10b981" fill="url(#cn)" name="Net Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Units Sold Chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Units Sold — {days} Days</h2>
        {daily.length === 0 ? (
          <EmptyState title="No sales data" description="Import transactions to see charts" />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="units_sold" fill="#7c3aed" name="Units Sold" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Product Performance Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-slate-200">Product Performance</h2>
          <div className="flex gap-2">
            {(['gross_revenue','units_sold','net_profit'] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`text-xs px-2 py-1 rounded transition-colors ${sortBy === s ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                {s.replace(/_/g,' ')}
              </button>
            ))}
          </div>
        </div>
        {sortedProducts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No sales data yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Product','Units','Revenue','Net Revenue','Profit','Margin','Refunds'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((p) => (
                <tr key={p.product_id} className="border-b border-surface-border/50 hover:bg-surface-border/20">
                  <td className="px-4 py-3">
                    <a href={`/dashboard/products/${p.product_id}`} className="text-slate-200 hover:text-brand-300 line-clamp-1">{p.title}</a>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.units_sold}</td>
                  <td className="px-4 py-3 text-slate-300">{fmt(p.gross_revenue)}</td>
                  <td className="px-4 py-3 text-slate-300">{fmt(p.net_revenue)}</td>
                  <td className="px-4 py-3 text-emerald-400">{fmt(p.net_profit)}</td>
                  <td className="px-4 py-3">
                    <span className={p.profit_margin >= 50 ? 'text-emerald-400' : 'text-yellow-400'}>
                      {p.profit_margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-red-400">{p.refund_rate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Channel Performance */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-slate-200">Channel Performance</h2>
        </div>
        {channels.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No channel data yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Channel','Products','Units','Gross Revenue','Fees','Net Revenue'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.channel_name} className="border-b border-surface-border/50 hover:bg-surface-border/20">
                  <td className="px-4 py-3 text-slate-200 font-medium">{c.channel_name}</td>
                  <td className="px-4 py-3 text-slate-300">{c.products}</td>
                  <td className="px-4 py-3 text-slate-300">{c.units_sold}</td>
                  <td className="px-4 py-3 text-slate-300">{fmt(c.gross_revenue)}</td>
                  <td className="px-4 py-3 text-red-400">{fmt(c.total_fees)}</td>
                  <td className="px-4 py-3 text-emerald-400">{fmt(c.net_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
