'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@/components/ui'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json())
      .then((r) => { if (r.success) setSettings(r.data) })
      .finally(() => setLoading(false))
  }, [])

  const set = (k: string, v: unknown) => setSettings((s) => ({ ...s, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>

  const s = settings

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <button onClick={save} disabled={saving} className="btn-primary text-xs">
          {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Settings'}
        </button>
      </div>

      {/* AI Provider */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">AI Provider</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Provider</label>
            <select className="input" value={String(s.ai_provider || 'ollama')} onChange={(e) => set('ai_provider', e.target.value)}>
              <option value="ollama">Ollama (Local — Preferred)</option>
              <option value="cloudflare">Cloudflare Workers AI (Free Tier)</option>
              <option value="manual">Manual (No AI)</option>
            </select>
          </div>
          <div>
            <label className="label">AI Base URL</label>
            <input className="input" value={String(s.ai_base_url || 'http://localhost:11434')} onChange={(e) => set('ai_base_url', e.target.value)} />
          </div>
          <div>
            <label className="label">AI Model</label>
            <input className="input" value={String(s.ai_model || 'llama3.2')} onChange={(e) => set('ai_model', e.target.value)} placeholder="llama3.2" />
          </div>
          <div>
            <label className="label">Embedding Model</label>
            <input className="input" value={String(s.embedding_model || 'nomic-embed-text')} onChange={(e) => set('embedding_model', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Automation */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Automation</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'auto_research', label: 'Auto Research' },
            { key: 'auto_create',   label: 'Auto Create' },
            { key: 'auto_qa',       label: 'Auto QA' },
            { key: 'auto_publish',  label: 'Auto Publish (default: OFF)' },
            { key: 'auto_price',    label: 'Auto Price' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-surface rounded-lg">
              <span className="text-sm text-slate-300">{label}</span>
              <button onClick={() => set(key, !s[key])}
                className={`w-10 h-5 rounded-full transition-colors relative ${Boolean(s[key]) ? 'bg-brand-600' : 'bg-surface-border'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${Boolean(s[key]) ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
        {Boolean(s.auto_publish) && (
          <div className="p-3 bg-yellow-950/50 border border-yellow-800 rounded-lg text-xs text-yellow-300">
            ⚠️ AUTO_PUBLISH is ON. Products that pass QA will be published automatically.
          </div>
        )}
      </div>

      {/* Limits */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Limits & Thresholds</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'products_per_day',      label: 'Max Products / Day',       type: 'number' },
            { key: 'max_daily_ai_calls',    label: 'Max Daily AI Calls',       type: 'number' },
            { key: 'min_opportunity_score', label: 'Min Opportunity Score',    type: 'number' },
            { key: 'min_qa_score',          label: 'Min QA Score',             type: 'number' },
            { key: 'max_revisions',         label: 'Max Auto Revisions',       type: 'number' },
            { key: 'default_product_price', label: 'Default Price (USD)',      type: 'number' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input className="input" type={type} value={String(s[key] ?? '')}
                onChange={(e) => set(key, type === 'number' ? parseFloat(e.target.value) : e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* Financial */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-200">Financial</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Default Currency</label>
            <select className="input" value={String(s.default_currency || 'USD')} onChange={(e) => set('default_currency', e.target.value)}>
              {['USD','EUR','GBP','CAD','AUD'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
