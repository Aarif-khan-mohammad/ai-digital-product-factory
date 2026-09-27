import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy — AI Digital Product Factory',
}

const UPDATED = '26 September 2026'

export default function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-white mb-2">Cookie Policy</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: {UPDATED}</p>

      <div className="space-y-10 text-sm text-slate-400 leading-relaxed">

        <section aria-labelledby="cp-what">
          <h2 id="cp-what" className="text-lg font-semibold text-white mb-3">What are cookies?</h2>
          <p>
            Cookies are small text files stored in your browser when you visit a website. They are used
            to remember preferences and enable certain functionality.
          </p>
        </section>

        <section aria-labelledby="cp-use">
          <h2 id="cp-use" className="text-lg font-semibold text-white mb-3">Cookies we use</h2>
          <p className="mb-4">This platform uses only one cookie:</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" aria-label="Cookie details">
              <thead>
                <tr className="border-b border-slate-700">
                  <th scope="col" className="text-left py-2 pr-4 text-slate-300 font-semibold">Name</th>
                  <th scope="col" className="text-left py-2 pr-4 text-slate-300 font-semibold">Purpose</th>
                  <th scope="col" className="text-left py-2 pr-4 text-slate-300 font-semibold">Type</th>
                  <th scope="col" className="text-left py-2 text-slate-300 font-semibold">Expiry</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800">
                  <td className="py-3 pr-4 font-mono text-slate-300">cookie_consent</td>
                  <td className="py-3 pr-4">Stores your cookie consent preference (accepted/declined)</td>
                  <td className="py-3 pr-4">Essential</td>
                  <td className="py-3">localStorage (no expiry)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="cp-no">
          <h2 id="cp-no" className="text-lg font-semibold text-white mb-3">What we do not use</h2>
          <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl p-4 space-y-2">
            {[
              'Analytics cookies (no Google Analytics, Matomo, or similar)',
              'Advertising or retargeting cookies',
              'Social media tracking pixels (no Meta Pixel, Twitter Pixel, etc.)',
              'Third-party session cookies',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-emerald-300/80">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="cp-consent">
          <h2 id="cp-consent" className="text-lg font-semibold text-white mb-3">Do you need to consent?</h2>
          <p>
            Because we use only a single essential cookie (to store your own consent preference),
            and no tracking or analytics cookies, a formal cookie consent banner is provided as
            good practice but is not strictly required under current Indian IT Rules for essential-only cookies.
            You may decline and the site will continue to function normally.
          </p>
        </section>

        <section aria-labelledby="cp-manage">
          <h2 id="cp-manage" className="text-lg font-semibold text-white mb-3">Managing cookies</h2>
          <p>
            You can clear the consent preference at any time by clearing your browser's localStorage,
            or by using your browser's built-in cookie management tools. Disabling cookies will not
            affect the functionality of this platform.
          </p>
        </section>

      </div>
    </div>
  )
}
