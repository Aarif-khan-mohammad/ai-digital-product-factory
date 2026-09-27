'use client'

import { useEffect, useState } from 'react'

interface StoreProduct {
  id: string
  title: string
  subtitle: string
  description: string
  product_type: string
  niche: string
  price: string
  currency: string
  tags: string[]
  slug: string
  published_at: string
}

export default function StorePage() {
  const [products, setProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/store')
      .then((r) => r.json())
      .then((r) => { if (r.success) setProducts(r.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-slate-800 h-56" />
      ))}
    </div>
  )

  if (products.length === 0) return (
    <div className="text-center py-24">
      <div className="text-slate-400 text-lg font-medium mb-2">No products available yet</div>
      <div className="text-slate-600 text-sm">Check back soon.</div>
    </div>
  )

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">Digital Products</h1>
        <p className="text-slate-400">{products.length} product{products.length !== 1 ? 's' : ''} available</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <a key={p.id} href={`/store/${p.slug}`}
            className="group block rounded-xl border border-slate-800 bg-slate-900 hover:border-slate-600 hover:bg-slate-800/80 transition-all duration-200 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-sky-500 to-indigo-500" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="text-xs font-medium text-sky-400 uppercase tracking-wider">{p.niche}</span>
                <span className="text-lg font-bold text-emerald-400 shrink-0">
                  ${parseFloat(p.price).toFixed(2)}
                </span>
              </div>
              <h2 className="text-base font-semibold text-white mb-2 group-hover:text-sky-300 transition-colors leading-snug">
                {p.title}
              </h2>
              {p.subtitle && (
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{p.subtitle}</p>
              )}
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                  {p.product_type.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-sky-400 group-hover:translate-x-0.5 transition-transform">
                  View →
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
