import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — AI Digital Product Factory',
  description: 'How AI Digital Product Factory collects, uses, and protects your personal data.',
}

const UPDATED = '26 September 2026'

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: {UPDATED}</p>

      <div className="prose-custom space-y-10 text-sm text-slate-400 leading-relaxed">

        <section aria-labelledby="pp-who">
          <h2 id="pp-who" className="text-lg font-semibold text-white mb-3">1. Who we are</h2>
          <p>
            AI Digital Product Factory is a self-hosted, open-source software platform. When you run
            this software on your own infrastructure, you are the data controller. This policy applies
            to the public-facing pages of this installation.
          </p>
          <p className="mt-3">
            For questions about data handling, contact us via the{' '}
            <a href="/contact" className="text-sky-400 underline hover:text-sky-300">Contact page</a>.
          </p>
        </section>

        <section aria-labelledby="pp-collect">
          <h2 id="pp-collect" className="text-lg font-semibold text-white mb-3">2. Data we collect</h2>
          <p className="mb-3">We collect only the minimum data necessary to operate this platform:</p>
          <ul className="space-y-2 list-none">
            {[
              { item: 'Contact form submissions', detail: 'Name, email address, and message content — used only to respond to your enquiry.' },
              { item: 'Essential cookies', detail: 'A single cookie to store your cookie consent preference. No tracking or analytics cookies.' },
              { item: 'Server logs', detail: 'Standard web server access logs (IP address, timestamp, URL). Retained for up to 30 days for security purposes.' },
            ].map((d) => (
              <li key={d.item} className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
                <span><strong className="text-slate-300">{d.item}:</strong> {d.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-amber-300/80 bg-amber-950/30 border border-amber-800/30 rounded-lg p-3">
            We do not use Google Analytics, Meta Pixel, or any third-party analytics or advertising trackers.
          </p>
        </section>

        <section aria-labelledby="pp-ai">
          <h2 id="pp-ai" className="text-lg font-semibold text-white mb-3">3. AI processing</h2>
          <p>
            By default, all AI processing is performed locally using Ollama. No data is sent to
            external AI providers. If you configure an optional cloud AI provider (such as Cloudflare
            Workers AI), data submitted to that provider is subject to their privacy policy.
          </p>
        </section>

        <section aria-labelledby="pp-legal">
          <h2 id="pp-legal" className="text-lg font-semibold text-white mb-3">4. Legal basis for processing</h2>
          <p>
            Under India's Digital Personal Data Protection Act 2023 (DPDP Act) and applicable IT Rules,
            we process personal data on the following bases:
          </p>
          <ul className="mt-3 space-y-2 list-none">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
              <span><strong className="text-slate-300">Consent:</strong> Contact form submissions — you provide explicit consent before submitting.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
              <span><strong className="text-slate-300">Legitimate interest:</strong> Server security logs.</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="pp-rights">
          <h2 id="pp-rights" className="text-lg font-semibold text-white mb-3">5. Your rights (DPDP Act 2023)</h2>
          <p className="mb-3">Under the DPDP Act 2023, you have the right to:</p>
          <ul className="space-y-2 list-none">
            {[
              'Access the personal data we hold about you',
              'Correct inaccurate personal data',
              'Request erasure of your personal data',
              'Withdraw consent at any time (this does not affect prior processing)',
              'Nominate another person to exercise these rights on your behalf',
            ].map((r) => (
              <li key={r} className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-4">
            To exercise any of these rights, contact us via the{' '}
            <a href="/contact" className="text-sky-400 underline hover:text-sky-300">Contact page</a>.
            We will respond within 30 days.
          </p>
        </section>

        <section aria-labelledby="pp-retention">
          <h2 id="pp-retention" className="text-lg font-semibold text-white mb-3">6. Data retention</h2>
          <p>Contact form data is retained only as long as necessary to resolve your enquiry, and deleted within 90 days thereafter. Server logs are deleted after 30 days.</p>
        </section>

        <section aria-labelledby="pp-third">
          <h2 id="pp-third" className="text-lg font-semibold text-white mb-3">7. Third-party services</h2>
          <p>
            This platform does not embed third-party scripts, social media widgets, advertising networks,
            or analytics services by default. If you configure optional integrations (Gumroad, Payhip,
            Cloudflare), those services have their own privacy policies.
          </p>
        </section>

        <section aria-labelledby="pp-changes">
          <h2 id="pp-changes" className="text-lg font-semibold text-white mb-3">8. Changes to this policy</h2>
          <p>We will update the "Last updated" date at the top of this page when changes are made. Continued use of the platform after changes constitutes acceptance.</p>
        </section>

      </div>
    </div>
  )
}
