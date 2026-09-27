'use client'

import { useEffect, useState } from 'react'
import { Spinner, EmptyState } from '@/components/ui'

interface Transaction {
  id: string; product_title: string; channel_name: string
  sale_date: string; quantity: number; gross_amount: string
  net_revenue: string; platform_fee: string; refund_amount: string; currency: string
}

export default function SalesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [products, setProducts] = useState<Array<{ id: string; title: string }>>([])
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([])
  const [form, setForm] = useState({
    product_id: '', channel_id: '', sale_date: new Date().toISOString().split('T')[0],
    quantity: '1', gross_amount: '', platform_fee: '0', payment_processing_fee: '0',
    discount: '0', refund_amount: '0', other_fee: '0', currency: 'USD',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/transactions').then((r) => r.json()),
      fetch('/api/products?per_page=100').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ]).then(([tx, pr, _]) => {
      if (tx.success) setTransactions(tx.data)
      if (pr.success) setProducts(pr.products)
    }).finally(() => setLoading(false))

    // Load channels from settings API
    fetch('/api/publishing').then((r) => r.json()).then((r) => {
      if (r.success) setChannels(r.data?.channels || [])
    }).catch(() => {})
  }, [])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const importTx = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        quantity:               parseInt(form.quantity),
        gross_amount:           parseFloat(form.gross_amount),
        platform_fee:           parseFloat(form.platform_fee),
        payment_processing_fee: parseFloat(form.payment_processing_fee),
        discount:               parseFloat(form.discount),
        refund_amount:          parseFloat(form.refund_amount),
        other_fee:              parseFloat(form.other_fee),
      }),
    })
    const data = await res.json()
    if (data.success) { setShowImport(false); window.location.reload() }
    else alert(data.error)
  }

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner size="lg" /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Sales <span className="text-slate-500 text-base font-normal">({transactions.length})</span></h1>
        <button onClick={() => setShowImport(!showImport)} className="btn-primary text-xs">+ Import Transaction</button>
      </div>

      {/* Import Form */}
      {showImport && (
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Import Transaction</h2>
          <form onSubmit={importTx} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Product *</label>
              <select className="input" value={form.product_id} onChange={(e) => set('product_id', e.target.value)} required>
                <option value="">Select product...</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Channel *</label>
              <select className="input" value={form.channel_id} onChange={(e) => set('channel_id', e.target.value)} required>
                <option value="">Select channel...</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sale Date *</label>
              <input className="input" type="date" value={form.sale_date} onChange={(e) => set('sale_date', e.target.value)} required />
            </div>
            <div>
              <label className="label">Gross Amount *</label>
              <input className="input" type="number" step="0.01" value={form.gross_amount} onChange={(e) => set('gross_amount', e.target.value)} required placeholder="27.00" />
            </div>
            <div>
              <label className="label">Platform Fee</label>
              <input className="input" type="number" step="0.01" value={form.platform_fee} onChange={(e) => set('platform_fee', e.target.value)} />
            </div>
            <div>
              <label className="label">Payment Fee</label>
              <input className="input" type="number" step="0.01" value={form.payment_processing_fee} onChange={(e) => set('payment_processing_fee', e.target.value)} />
            </div>
            <div>
              <label className="label">Discount</label>
              <input className="input" type="number" step="0.01" value={form.discount} onChange={(e) => set('discount', e.target.value)} />
            </div>
            <div>
              <label className="label">Refund Amount</label>
              <input className="input" type="number" step="0.01" value={form.refund_amount} onChange={(e) => set('refund_amount', e.target.value)} />
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" className="btn-primary text-xs">Import</button>
              <button type="button" onClick={() => setShowImport(false)} className="btn-secondary text-xs">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Transactions Table */}
      {transactions.length === 0 ? (
        <EmptyState title="No transactions yet" description="Import your first transaction to start tracking revenue." action={<button onClick={() => setShowImport(true)} className="btn-primary text-sm">Import Transaction</button>} />
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Product','Channel','Date','Qty','Gross','Fees','Net','Refund'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-surface-border/50 hover:bg-surface-border/20">
                  <td className="px-4 py-3 text-slate-200 text-xs line-clamp-1 max-w-[160px]">{tx.product_title}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{tx.channel_name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(tx.sale_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{tx.quantity}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">${parseFloat(tx.gross_amount).toFixed(2)}</td>
                  <td className="px-4 py-3 text-red-400 text-xs">${parseFloat(tx.platform_fee).toFixed(2)}</td>
                  <td className="px-4 py-3 text-emerald-400 text-xs">${parseFloat(tx.net_revenue).toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs">
                    {parseFloat(tx.refund_amount) > 0
                      ? <span className="text-red-400">${parseFloat(tx.refund_amount).toFixed(2)}</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
