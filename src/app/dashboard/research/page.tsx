'use client'

import { useEffect, useState } from 'react'
import { Spinner, EmptyState } from '@/components/ui'

interface ResearchSource {
  id: string; keyword: string; niche: string; problem: string
  target_customer: string; source: string; demand_signal: string
  competition_signal: string; date_discovered: string
}

export default function ResearchPage() {
  const [sources, setSources] = useState<ResearchSource[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetch('/api/research').then((r) => r.json())
      .then((r) => { if (r.success) setSources(r.data) })
      .finally(() => setLoading(false))
  }, [])

  const runResearch = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/research/run', { method: 'POST' })
      const data = await res.json()
      if (data.success) window.location.reload()
      else alert(data.error)
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Market Research</h1>
          <p className="text-slate-400 text-sm">Discovered product opportunities from public sources</p>
        </div>
        <button onClick={runResearch} disabled={running} className="btn-primary text-xs">
          {running ? '⏳ Researching...' : '🔍 Run Research Now'}
        </button>
      </div>

      {sources.length === 0 ? (
        <EmptyState title="No research data yet" description="Run market research to discover product opportunities."
          action={<button onClick={runResearch} className="btn-primary text-sm">Run Research</button>} />
      ) : (
        <div className="space-y-3">
          {sources.map((s) => (
            <div key={s.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-slate-200">{s.keyword}</div>
                  <div className="text-xs text-slate-500">{s.niche} · {new Date(s.date_discovered).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-3 text-xs">
                  <div className="text-center">
                    <div className="text-brand-400 font-bold">{parseFloat(s.demand_signal).toFixed(0)}</div>
                    <div className="text-slate-500">Demand</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-bold">{parseFloat(s.competition_signal).toFixed(0)}</div>
                    <div className="text-slate-500">Competition</div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-400 mb-1"><span className="text-slate-500">Problem:</span> {s.problem}</div>
              <div className="text-xs text-slate-400"><span className="text-slate-500">Target:</span> {s.target_customer}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
