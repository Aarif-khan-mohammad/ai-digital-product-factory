import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — AI Digital Product Factory',
  description: 'Learn what AI Digital Product Factory is, how it works, and what it is designed to do.',
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-3xl font-bold text-white mb-4">About This Project</h1>
      <p className="text-slate-400 text-sm mb-12 leading-relaxed">
        AI Digital Product Factory is an open-source, self-hosted automation platform for creating
        and selling digital products. It is designed to run entirely on your own machine with no
        required paid subscriptions or external AI APIs.
      </p>

      <section aria-labelledby="what-heading" className="mb-12">
        <h2 id="what-heading" className="text-xl font-semibold text-white mb-4">What it does</h2>
        <ul className="space-y-3 text-sm text-slate-400 leading-relaxed list-none">
          {[
            'Researches digital product opportunities from public sources',
            'Scores each opportunity across 10 weighted dimensions',
            'Generates product content using a locally running LLM via Ollama',
            'Runs 16-point automated quality checks before publication',
            'Publishes to configured channels (Gumroad, Payhip, own store, or manual)',
            'Tracks sales, fees, refunds, expenses, and net profit',
            'Provides a full operational dashboard with pipeline, analytics, and audit logs',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="principles-heading" className="mb-12">
        <h2 id="principles-heading" className="text-xl font-semibold text-white mb-4">Core principles</h2>
        <div className="space-y-4">
          {[
            { title: 'Zero required paid AI API', body: 'All AI runs locally via Ollama. Cloudflare Workers AI is available as an optional free-tier fallback. No OpenAI, Anthropic, or similar paid API is required.' },
            { title: 'Zero automatic spending', body: 'The system will never automatically upgrade a plan, enable paid billing, purchase advertising, or spend money without explicit user approval.' },
            { title: 'Human approval before publishing', body: 'AUTO_PUBLISH is false by default. Every product waits for manual approval before going live.' },
            { title: 'Full data ownership', body: 'All data is stored in your own PostgreSQL database. Nothing is sent to external services unless you explicitly configure it.' },
            { title: 'Pluggable providers', body: 'AI providers, publishing channels, storage backends, and notification channels are all adapter-based and replaceable.' },
          ].map((p) => (
            <div key={p.title} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1">{p.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="disclaimer-heading" className="mb-12">
        <h2 id="disclaimer-heading" className="text-xl font-semibold text-white mb-4">Important disclaimers</h2>
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-5 space-y-3 text-sm text-amber-200/80 leading-relaxed">
          <p>Opportunity scores are internal decision-support metrics, not market predictions or guarantees of sales.</p>
          <p>AI-generated content may contain errors. Always review products before publishing.</p>
          <p>This platform does not guarantee income, revenue, or profit from any product created using it.</p>
          <p>You are responsible for ensuring your products comply with applicable laws in your jurisdiction.</p>
        </div>
      </section>

      <section aria-labelledby="legal-heading">
        <h2 id="legal-heading" className="text-xl font-semibold text-white mb-4">Legal & compliance</h2>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          This project is released under the MIT licence. You are free to use, modify, and deploy it.
          See the legal pages for full details on data handling and your rights.
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { href: '/privacy-policy', label: 'Privacy Policy' },
            { href: '/terms', label: 'Terms & Conditions' },
            { href: '/cookie-policy', label: 'Cookie Policy' },
            { href: '/refund-policy', label: 'Refund Policy' },
          ].map((l) => (
            <Link key={l.href} href={l.href}
              className="text-sm text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors">
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
