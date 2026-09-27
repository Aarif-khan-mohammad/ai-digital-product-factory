'use client'

import { useEffect, useState } from 'react'
import { ResourceBar, Spinner } from '@/components/ui'

interface CostData {
  resourceUsage: {
    ai_requests_used: number; ai_requests_limit: number
    storage_used_gb: number; storage_limit_gb: number
    api_requests_used: number; api_requests_limit: number
  }
  ollamaHealth: { available: boolean; models: string[] }
}

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null)
  const [aiUsage, setAiUsage] = useState<Array<{ provider: string; model: string; purpose: string; total_tokens: number; estimated_cost: number; created_at: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then((r) => r.json()),
      fetch('/api/ai').then((r) => r.json()).catch(() => ({ success: false })),
    ]).then(([dash, ai]) => {
      if (dash.success) setData({ resourceUsage: dash.data.resourceUsage, ollamaHealth: dash.data.ollamaHealth })
      if (ai.success) setAiUsage(ai.data || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>
  if (!data) return null

  const { resourceUsage, ollamaHealth } = data

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Infrastructure & Costs</h1>
        <p className="text-slate-400 text-sm">Free-tier usage monitoring — no automatic upgrades</p>
      </div>

      {/* Free Tier Alert */}
      <div className="card border-brand-800 bg-brand-950/30">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <div className="text-sm font-medium text-brand-300 mb-1">Free-First Protection Active</div>
            <div className="text-xs text-slate-400">
              The system will NEVER automatically upgrade a plan, enable paid billing, or incur charges.
              When limits are reached, automation pauses and you are notified.
            </div>
          </div>
        </div>
      </div>

      {/* AI Provider Status */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">AI Provider Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
            <div className="flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${ollamaHealth.available ? 'bg-emerald-400' : 'bg-red-400'}`} />
              <div>
                <div className="text-sm text-slate-200">Ollama (Local AI) — Level 1</div>
                <div className="text-xs text-slate-500">
                  {ollamaHealth.available
                    ? `Connected · Models: ${ollamaHealth.models.join(', ') || 'none loaded'}`
                    : 'Offline — start Ollama to enable local AI'}
                </div>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-medium">$0.00 / request</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <div>
                <div className="text-sm text-slate-200">Cloudflare Workers AI — Level 2</div>
                <div className="text-xs text-slate-500">Free tier fallback · Configure in Settings</div>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-medium">$0.00 (free tier)</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div>
                <div className="text-sm text-slate-200">Manual Mode — Level 3</div>
                <div className="text-xs text-slate-500">Always available · Human provides content</div>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-medium">$0.00</span>
          </div>
        </div>
      </div>

      {/* Resource Usage */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Daily Free-Tier Usage</h2>
        <div className="space-y-5">
          <ResourceBar label="AI Requests (today)" used={resourceUsage.ai_requests_used} limit={resourceUsage.ai_requests_limit} />
          <ResourceBar label="Storage" used={resourceUsage.storage_used_gb} limit={resourceUsage.storage_limit_gb} unit=" GB" />
          <ResourceBar label="API Calls (today)" used={resourceUsage.api_requests_used} limit={resourceUsage.api_requests_limit} />
        </div>
        {(resourceUsage.ai_requests_used / resourceUsage.ai_requests_limit) > 0.9 && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-300">
            ⚠️ AI request limit nearly reached. Automation will pause when limit is hit.
          </div>
        )}
      </div>

      {/* Cost Breakdown */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">Cost Breakdown</h2>
        <div className="space-y-2">
          {[
            { label: 'Local AI (Ollama)',    cost: '$0.00', note: 'Runs on your hardware' },
            { label: 'Cloud AI (free tier)', cost: '$0.00', note: 'Free quota only' },
            { label: 'Storage (local)',      cost: '$0.00', note: 'Local filesystem' },
            { label: 'n8n (self-hosted)',    cost: '$0.00', note: 'Docker container' },
            { label: 'PostgreSQL (local)',   cost: '$0.00', note: 'Docker container' },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-surface-border/50">
              <div>
                <div className="text-sm text-slate-200">{item.label}</div>
                <div className="text-xs text-slate-500">{item.note}</div>
              </div>
              <span className="text-emerald-400 font-medium text-sm">{item.cost}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm font-semibold text-slate-200">Total Required Monthly Cost</div>
            <span className="text-emerald-400 font-bold text-lg">$0.00</span>
          </div>
        </div>
      </div>
    </div>
  )
}
