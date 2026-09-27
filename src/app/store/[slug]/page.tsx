'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'

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
  keywords: string[]
  slug: string
  published_at: string
  purchase_url: string | null
}

export default function StoreProductPage({ params }: { params: { slug: string } }) {
  const [product, setProduct] = useState<StoreProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFoundState, setNotFoundState] = useState(false)

  useEffect(() => {
    fetch('/api/store')
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          const found = r.data.find((p: StoreProduct) => p.slug === params.slug)
          if (found) setProduct(found)
          else setNotFoundState(true)
        }
      })
      .finally(() => setLoading(false))
  }, [params.slug])

  if (loading) return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-slate-800 rounded w-3/4" />
      <div className="h-4 bg-slate-800 rounded w-1/2" />
      <div className="h-40 bg-slate-800 rounded" />
    </div>
  )

  if (notFoundState) return (
    <div className="text-center py-24">
      <div className="text-slate-400 text-lg font-medium mb-2">Product not found</div>
      <a href="/store" className="text-sky-400 text-sm hover:underline">← Back to store</a>
    </div>
  )

  if (!product) return null

  return (
    <div className="max-w-2xl mx-auto">
      <a href="/store" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
        ← Back to store
      </a>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-sky-500 to-indigo-500" />
        <div className="p-8">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="text-xs font-medium text-sky-400 uppercase tracking-wider">{product.niche}</span>
              <h1 className="text-2xl font-bold text-white mt-1 leading-tight">{product.title}</h1>
              {product.subtitle && <p className="text-slate-400 mt-1">{product.subtitle}</p>}
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold text-emerald-400">${parseFloat(product.price).toFixed(2)}</div>
              <div className="text-xs text-slate-500 mt-0.5">{product.currency}</div>
            </div>
          </div>

          {product.description && (
            <div className="mt-6 text-slate-300 text-sm leading-relaxed whitespace-pre-line border-t border-slate-800 pt-6">
              {product.description}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="text-xs text-slate-500 mb-2">Product type</div>
            <span className="text-sm text-slate-300 bg-slate-800 px-3 py-1 rounded">
              {product.product_type.replace(/_/g, ' ')}
            </span>
          </div>

          {product.tags?.length > 0 && (
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-2">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <span key={tag} className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            {product.purchase_url ? (
              <a
                href={product.purchase_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Buy Now — ${parseFloat(product.price).toFixed(2)}
              </a>
            ) : (
              <>
                <button disabled className="w-full bg-slate-700 text-slate-400 font-semibold py-3 rounded-lg cursor-not-allowed">
                  Purchase — ${parseFloat(product.price).toFixed(2)}
                </button>
                <p className="text-center text-xs text-slate-600 mt-3">
                  Publish to Gumroad or Payhip in the dashboard to enable purchases
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 text-center text-xs text-slate-700">
        Published {new Date(product.published_at).toLocaleDateString()}
      </div>
    </div>
  )
}
