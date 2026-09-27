'use client'

import { useEffect, useState } from 'react'
import { StatusBadge, Spinner, EmptyState } from '@/components/ui'

interface Channel {
  id: string; name: string; channel_type: string; enabled: boolean
  config: Record<string, string>
}

interface PublishedProduct {
  id: string; product_id: string; channel_name: string; channel_type: string
  product_url: string; publication_status: string; price: string
  published_at: string; last_sync_at: string; sync_status: string; title: string
}

export default function PublishingPage() {
  const [published, setPublished] = useState<PublishedProduct[]>([])
  const [channels,  setChannels]  = useState<Channel[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState<string | null>(null)
  const [tokens,    setTokens]    = useState<Record<string, Record<string, string>>>({})

  const load = () =>
    fetch('/api/publishing').then((r) => r.json()).then((r) => {
      if (r.success) {
        setPublished(r.data.published || [])
        setChannels(r.data.channels   || [])
        // Seed token input state from existing config
        const t: Record<string, Record<string, string>> = {}
        for (const c of (r.data.channels || []) as Channel[]) {
          t[c.id] = { ...c.config }
        }
        setTokens(t)
      }
    }).finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const setField = (channelId: string, field: string, value: string) =>
    setTokens((prev) => ({ ...prev, [channelId]: { ...(prev[channelId] || {}), [field]: value } }))

  const saveChannel = async (c: Channel) => {
    setSaving(c.id)
    await fetch('/api/publishing', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: c.id, enabled: c.enabled, config: tokens[c.id] || {} }),
    })
    await load()
    setSaving(null)
  }

  const toggleAndSave = async (c: Channel) => {
    const updated = { ...c, enabled: !c.enabled }
    setChannels((prev) => prev.map((ch) => ch.id === c.id ? updated : ch))
    setSaving(c.id)
    await fetch('/api/publishing', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: c.id, enabled: updated.enabled }),
    })
    setSaving(null)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>

  const ch = (type: string) => channels.find((c) => c.channel_type === type)
  const gumroad = ch('GUMROAD')
  const payhip  = ch('PAYHIP')
  const etsy    = ch('ETSY')

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-xl font-bold text-white">Publishing Channels</h1>

      {/* ── GUMROAD ─────────────────────────────────────────── */}
      {gumroad && (
        <ChannelCard
          channel={gumroad}
          onToggle={() => toggleAndSave(gumroad)}
          onSave={() => saveChannel(gumroad)}
          saving={saving === gumroad.id}
        >
          <p className="text-xs text-slate-500 mb-3">
            Get your Access Token from{' '}
            <a href="https://app.gumroad.com/settings/advanced" target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
              Gumroad → Settings → Advanced → Applications
            </a>
          </p>
          <div className="flex gap-3">
            <input
              className="input flex-1 font-mono text-xs"
              type="password"
              placeholder="Access Token (e.g. daCMN74wz7dt…)"
              value={tokens[gumroad.id]?.access_token || ''}
              onChange={(e) => setField(gumroad.id, 'access_token', e.target.value)}
            />
          </div>
          {gumroad.enabled && tokens[gumroad.id]?.access_token && (
            <p className="text-xs text-emerald-400 mt-2">Connected — products publish directly to your Gumroad account. Files must be uploaded manually via the Gumroad Content tab.</p>
          )}
        </ChannelCard>
      )}

      {/* ── PAYHIP ──────────────────────────────────────────── */}
      {payhip && (
        <ChannelCard
          channel={payhip}
          onToggle={() => toggleAndSave(payhip)}
          onSave={() => saveChannel(payhip)}
          saving={saving === payhip.id}
        >
          <p className="text-xs text-slate-500 mb-3">
            Get your API Key from{' '}
            <a href="https://payhip.com/account#api" target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
              Payhip → Account → API
            </a>
            {' '}(free account supported).
          </p>
          <div className="flex gap-3">
            <input
              className="input flex-1 font-mono text-xs"
              type="password"
              placeholder="Payhip API Key"
              value={tokens[payhip.id]?.api_key || ''}
              onChange={(e) => setField(payhip.id, 'api_key', e.target.value)}
            />
          </div>
          {payhip.enabled && tokens[payhip.id]?.api_key && (
            <p className="text-xs text-emerald-400 mt-2">Connected — products and files publish automatically to Payhip.</p>
          )}
        </ChannelCard>
      )}

      {/* ── ETSY ────────────────────────────────────────────── */}
      {etsy && (
        <ChannelCard
          channel={etsy}
          onToggle={() => toggleAndSave(etsy)}
          onSave={() => saveChannel(etsy)}
          saving={saving === etsy.id}
        >
          <div className="rounded-lg bg-amber-950/20 border border-amber-800/30 px-3 py-2 text-xs text-amber-300 mb-3">
            Etsy requires OAuth 2.0 — programmatic listing creation is not available via API key alone.
            When you publish to Etsy, the app opens the Etsy listing editor pre-filled with your product details.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Etsy API Key <span className="text-slate-600">(optional — for future OAuth)</span></label>
              <input
                className="input font-mono text-xs"
                type="password"
                placeholder="API Key from Etsy Developer Portal"
                value={tokens[etsy.id]?.api_key || ''}
                onChange={(e) => setField(etsy.id, 'api_key', e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">
                Etsy Shop Name{' '}
                <a href="https://www.etsy.com/your/shops/me/tools" target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">(find yours)</a>
              </label>
              <input
                className="input text-xs"
                placeholder="e.g. MyDigitalShop"
                value={tokens[etsy.id]?.shop_id || ''}
                onChange={(e) => setField(etsy.id, 'shop_id', e.target.value)}
              />
            </div>
          </div>
          {etsy.enabled && (
            <p className="text-xs text-emerald-400 mt-2">
              Enabled — publishing will open Etsy&apos;s listing editor with product details pre-filled.
              {tokens[etsy.id]?.shop_id && ` Shop: ${tokens[etsy.id].shop_id}`}
            </p>
          )}
        </ChannelCard>
      )}

      {/* ── All Channels overview ────────────────────────────── */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-200 mb-4">All Channels</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {channels.map((c) => (
            <div key={c.id} className={`p-3 rounded-lg border ${c.enabled ? 'border-emerald-800 bg-emerald-950/20' : 'border-surface-border bg-surface'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-200">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.channel_type}</div>
                </div>
                <span className={`text-xs font-medium ${c.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {c.enabled ? '●' : '○'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Published Products ───────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-slate-200">Published Products</h2>
        </div>
        {published.length === 0 ? (
          <div className="p-8"><EmptyState title="No published products yet" description="Products will appear here after publishing." /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Product','Channel','Status','Price','Published','URL'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {published.map((p) => (
                <tr key={p.id} className="border-b border-surface-border/50 hover:bg-surface-border/20">
                  <td className="px-4 py-3">
                    <a href={`/dashboard/products/${p.product_id}`} className="text-slate-200 hover:text-brand-300 text-xs">{p.title}</a>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.channel_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.publication_status} /></td>
                  <td className="px-4 py-3 text-emerald-400 text-xs">${parseFloat(p.price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.published_at ? new Date(p.published_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {p.product_url
                      ? <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">Link ↗</a>
                      : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Reusable channel card ─────────────────────────────────────
function ChannelCard({
  channel, onToggle, onSave, saving, children,
}: {
  channel:  Channel
  onToggle: () => void
  onSave:   () => void
  saving:   boolean
  children: React.ReactNode
}) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">{channel.name}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              channel.enabled
                ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400'
                : 'bg-surface border-surface-border text-slate-400'
            }`}
          >
            {channel.enabled ? '● Enabled' : '○ Disabled'}
          </button>
          <button onClick={onSave} disabled={saving} className="btn-primary text-xs">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
