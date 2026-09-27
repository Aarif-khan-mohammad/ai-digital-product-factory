'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 px-6 py-5 shadow-2xl">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
          This site uses only essential cookies required for it to function. We do not use analytics,
          advertising, or tracking cookies. No personal data is shared with third parties.{' '}
          <Link href="/cookie-policy" className="text-sky-400 underline hover:text-sky-300">
            Cookie Policy
          </Link>
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
            aria-label="Decline non-essential cookies">
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors"
            aria-label="Accept essential cookies">
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
