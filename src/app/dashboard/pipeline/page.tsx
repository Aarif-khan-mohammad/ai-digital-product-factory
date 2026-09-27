'use client'

import { useEffect, useState } from 'react'
import { StatusBadge, Spinner, EmptyState } from '@/components/ui'

interface PipelineProduct {
  id: string; title: string; product_type: string; niche: string
  status: string; qa_score: string; price: string; opportunity_score: string
  revision_count: number; updated_at: string
}

const COLS = ['IDEAS','RESEARCH','APPROVED','CREATING','QA','READY','PUBLISHING','PUBLISHED','FAILED']

const COL_COLORS: Record<string, string> = {
  IDEAS: 'border-slate-600', RESEARCH: 'border-blue-700', APPROVED: 'border-indigo-700',
  CREATING: 'border-purple-700', QA: 'border-yellow-700', READY: 'border-teal-700',
  PUBLISHING: 'border-cyan-700', PUBLISHED: 'border-emerald-700', FAILED: 'border-red-800',
}

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<Record<string, PipelineProduct[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((r) => { if (r.success) setPipeline(r.data.pipeline) })
      .finally(() => setLoading(false))
  }, [])

  const runResearch = async () => {
    await fetch('/api/research/run', { method: 'POST' })
    window.location.reload()
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Production Pipeline</h1>
          <p className="text-slate-400 text-sm">Kanban view of all products in the factory</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runResearch} className="btn-secondary text-xs">🔍 Run Research</button>
          <a href="/dashboard/products/new" className="btn-primary text-xs">+ Create Product</a>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLS.map((col) => {
          const products = pipeline[col] || []
          return (
            <div key={col} className={`min-w-[200px] max-w-[220px] flex-shrink-0 border-t-2 ${COL_COLORS[col]} bg-surface-card rounded-xl p-3`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{col}</span>
                <span className="text-xs bg-surface-border text-slate-400 rounded-full px-2 py-0.5">{products.length}</span>
              </div>

              <div className="space-y-2">
                {products.length === 0 && (
                  <div className="text-xs text-slate-600 text-center py-4">Empty</div>
                )}
                {products.map((p) => (
                  <a key={p.id} href={`/dashboard/products/${p.id}`}
                    className="block bg-surface rounded-lg p-3 hover:bg-surface-border/30 transition-colors border border-surface-border/50">
                    <div className="text-xs font-medium text-slate-200 leading-tight mb-1 line-clamp-2">{p.title}</div>
                    <div className="text-xs text-slate-500 mb-2">{p.niche} · {p.product_type.replace(/_/g,' ')}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-brand-400">${parseFloat(p.price||'0').toFixed(0)}</span>
                      {p.qa_score && <span className="text-xs text-slate-400">QA: {p.qa_score}</span>}
                    </div>
                    {p.revision_count > 0 && (
                      <div className="text-xs text-orange-400 mt-1">Rev: {p.revision_count}</div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
