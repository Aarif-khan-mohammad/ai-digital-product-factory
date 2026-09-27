import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions — AI Digital Product Factory',
}

const UPDATED = '26 September 2026'

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-white mb-2">Terms &amp; Conditions</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: {UPDATED}</p>

      <div className="space-y-10 text-sm text-slate-400 leading-relaxed">

        <section aria-labelledby="tc-acceptance">
          <h2 id="tc-acceptance" className="text-lg font-semibold text-white mb-3">1. Acceptance</h2>
          <p>By accessing or using this platform, you agree to these Terms. If you do not agree, do not use the platform.</p>
        </section>

        <section aria-labelledby="tc-licence">
          <h2 id="tc-licence" className="text-lg font-semibold text-white mb-3">2. Licence</h2>
          <p>
            This software is released under the MIT Licence. You are free to use, copy, modify, merge,
            publish, distribute, sublicense, and sell copies of the software, subject to the licence terms.
            The MIT Licence is included in the source repository.
          </p>
        </section>

        <section aria-labelledby="tc-use">
          <h2 id="tc-use" className="text-lg font-semibold text-white mb-3">3. Acceptable use</h2>
          <p className="mb-3">You must not use this platform to:</p>
          <ul className="space-y-2 list-none">
            {[
              'Create or distribute content that infringes copyright, trademarks, or other intellectual property rights',
              'Generate or publish false, misleading, or deceptive content',
              'Create fake reviews, fabricated testimonials, or unsupported earnings claims',
              'Violate any applicable law or regulation, including India\'s IT Act 2000 and DPDP Act 2023',
              'Scrape websites in violation of their terms of service or robots.txt',
            ].map((r) => (
              <li key={r} className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="tc-ai">
          <h2 id="tc-ai" className="text-lg font-semibold text-white mb-3">4. AI-generated content</h2>
          <p>
            You are solely responsible for reviewing, editing, and approving all AI-generated content
            before publication. AI-generated content may contain errors, inaccuracies, or outdated
            information. Do not publish content you have not reviewed.
          </p>
        </section>

        <section aria-labelledby="tc-disclaimer">
          <h2 id="tc-disclaimer" className="text-lg font-semibold text-white mb-3">5. No earnings guarantee</h2>
          <p>
            This platform does not guarantee any income, revenue, profit, or sales results. Opportunity
            scores are internal decision-support metrics only. Past performance of any product created
            using this platform is not indicative of future results.
          </p>
        </section>

        <section aria-labelledby="tc-ip">
          <h2 id="tc-ip" className="text-lg font-semibold text-white mb-3">6. Intellectual property</h2>
          <p>
            You retain ownership of all content you create using this platform. You are responsible for
            ensuring that content you publish does not infringe third-party intellectual property rights.
            Do not use copyrighted images, text, or other materials without appropriate licences.
          </p>
        </section>

        <section aria-labelledby="tc-liability">
          <h2 id="tc-liability" className="text-lg font-semibold text-white mb-3">7. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, this software is provided "as is" without warranty
            of any kind. The authors are not liable for any direct, indirect, incidental, or consequential
            damages arising from use of this platform.
          </p>
        </section>

        <section aria-labelledby="tc-law">
          <h2 id="tc-law" className="text-lg font-semibold text-white mb-3">8. Governing law</h2>
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in India.</p>
        </section>

      </div>
    </div>
  )
}
