'use client'

import { useEffect, useState } from 'react'
import { StatusBadge, Spinner } from '@/components/ui'

interface WorkflowRun {
  id: string; workflow_name: string; status: string; started_at: string
  completed_at: string; duration_ms: number; error: string; product_id: string; retry_count: number
}

interface WorkflowError {
  id: string; workflow_name: string; error_message: string; created_at: string; resolved: boolean
}

export default function AutomationPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [errors, setErrors] = useState<WorkflowError[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'runs'|'errors'>('runs')

  useEffect(() => {
    fetch('/api/workflows').then((r) => r.json())
      .then((r) => { if (r.success) { setRuns(r.data.runs); setErrors(r.data.errors) } })
      .finally(() => setLoading(false))
  }, [])

  const statusColor: Record<string, string> = {
    COMPLETED: 'text-emerald-400', RUNNING: 'text-blue-400',
    FAILED: 'text-red-400', TIMEOUT: 'text-yellow-400', CANCELLED: 'text-slate-400',
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Automation & Workflow Logs</h1>
        <div className="flex gap-2 text-xs">
          <span className="text-slate-400">{runs.filter((r) => r.status === 'RUNNING').length} running</span>
          <span className="text-red-400">{errors.length} errors</span>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-border">
        {(['runs','errors'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors ${tab === t ? 'text-brand-300 border-b-2 border-brand-500' : 'text-slate-400 hover:text-slate-200'}`}>
            {t} {t === 'errors' && errors.length > 0 && <span className="ml-1 bg-red-900 text-red-300 text-xs px-1.5 rounded-full">{errors.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'runs' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Workflow','Status','Started','Duration','Retries','Product'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">No workflow runs yet</td></tr>
              ) : runs.map((r) => (
                <tr key={r.id} className="border-b border-surface-border/50 hover:bg-surface-border/20">
                  <td className="px-4 py-3 text-slate-200 text-xs font-mono">{r.workflow_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${statusColor[r.status] || 'text-slate-400'}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.duration_ms ? `${(r.duration_ms/1000).toFixed(1)}s` : '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.retry_count}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.product_id
                      ? <a href={`/dashboard/products/${r.product_id}`} className="text-brand-400 hover:underline">View</a>
                      : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'errors' && (
        <div className="space-y-3">
          {errors.length === 0 ? (
            <div className="card text-center py-8 text-slate-500 text-sm">No unresolved errors 🎉</div>
          ) : errors.map((e) => (
            <div key={e.id} className="card border-red-900/50">
              <div className="flex items-start justify-between mb-2">
                <div className="text-xs font-mono text-red-400">{e.workflow_name}</div>
                <div className="text-xs text-slate-500">{new Date(e.created_at).toLocaleString()}</div>
              </div>
              <div className="text-sm text-slate-300">{e.error_message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
