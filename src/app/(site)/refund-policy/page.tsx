import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Refund Policy — AI Digital Product Factory',
}

const UPDATED = '26 September 2026'

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-white mb-2">Refund Policy</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: {UPDATED}</p>

      <div className="space-y-10 text-sm text-slate-400 leading-relaxed">

        <section aria-labelledby="rp-software">
          <h2 id="rp-software" className="text-lg font-semibold text-white mb-3">1. This software platform</h2>
          <p>
            AI Digital Product Factory is open-source software released under the MIT Licence and
            available at no charge. There is nothing to refund for the platform itself.
          </p>
        </section>

        <section aria-labelledby="rp-products">
          <h2 id="rp-products" className="text-lg font-semibold text-white mb-3">2. Digital products sold through this platform</h2>
          <p className="mb-4">
            If you operate a store using this platform and sell digital products to customers,
            you are the seller and are responsible for your own refund policy. The following
            is a recommended baseline policy for digital products:
          </p>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Eligibility for refund</h3>
              <p>
                Refund requests may be considered within 7 days of purchase if the product file
                is corrupted, inaccessible, or materially different from its description.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">Non-refundable situations</h3>
              <ul className="space-y-1.5 list-none">
                {[
                  'Change of mind after download',
                  'Incompatibility with software not specified in the product description',
                  'Failure to read the product description before purchase',
                ].map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-600 shrink-0" aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">How to request a refund</h3>
              <p>
                Contact us via the{' '}
                <a href="/contact" className="text-sky-400 underline hover:text-sky-300">Contact page</a>{' '}
                with your order details and a description of the issue. We will respond within 5 business days.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="rp-consumer">
          <h2 id="rp-consumer" className="text-lg font-semibold text-white mb-3">3. Consumer rights (India)</h2>
          <p>
            Nothing in this policy limits your rights under the Consumer Protection Act 2019 (India)
            or any other applicable consumer protection legislation. If you believe you have been
            treated unfairly, you may contact the National Consumer Helpline at 1800-11-4000.
          </p>
        </section>

        <section aria-labelledby="rp-platform">
          <h2 id="rp-platform" className="text-lg font-semibold text-white mb-3">4. Third-party payment platforms</h2>
          <p>
            If a product is sold through Gumroad, Payhip, or another third-party platform, that
            platform's refund and dispute resolution process also applies. Refer to the respective
            platform's terms for details.
          </p>
        </section>

      </div>
    </div>
  )
}
