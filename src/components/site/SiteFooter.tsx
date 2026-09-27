import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 mt-20" role="contentinfo">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          <div>
            <div className="font-bold text-white mb-2">
              <span className="text-sky-400">AI</span> Product Factory
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">
              An automated platform for creating and selling digital products using local AI.
              Self-hosted. No paid AI API required.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Navigation</h3>
            <ul className="space-y-2">
              {[
                { href: '/', label: 'Home' },
                { href: '/about', label: 'About' },
                { href: '/store', label: 'Products' },
                { href: '/contact', label: 'Contact' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Legal</h3>
            <ul className="space-y-2">
              {[
                { href: '/privacy-policy', label: 'Privacy Policy' },
                { href: '/terms', label: 'Terms & Conditions' },
                { href: '/cookie-policy', label: 'Cookie Policy' },
                { href: '/refund-policy', label: 'Refund Policy' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} AI Digital Product Factory. All rights reserved.
          </p>
          <p className="text-xs text-slate-700">
            This platform uses local AI (Ollama). No data is sent to third-party AI providers by default.
          </p>
        </div>
      </div>
    </footer>
  )
}
