import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI Digital Product Factory — Create & Sell Digital Products with Local AI',
  description: 'An open-source, self-hosted platform that researches opportunities, creates digital products with local AI, and publishes them to your store. No paid AI API required.',
}

const FEATURES = [
  {
    title: 'Market Research Engine',
    description: 'Automatically discovers product opportunities from public sources. Scores each idea across 10 dimensions before any work begins.',
  },
  {
    title: 'Local AI Generation',
    description: 'Uses Ollama and open-source LLMs running on your own machine. Zero AI API costs. Your data never leaves your server.',
  },
  {
    title: 'Automated QA',
    description: '16-point quality check on every product before publication. Minimum score of 85/100 required. Auto-revision loop up to 3 times.',
  },
  {
    title: 'Publishing Engine',
    description: 'Pluggable adapters for Gumroad, Payhip, your own store, or manual publishing. One product, multiple channels.',
  },
  {
    title: 'Financial Tracking',
    description: 'Tracks gross revenue, fees, refunds, expenses, and net profit per product and per channel. Full audit trail.',
  },
  {
    title: 'Human Approval First',
    description: 'AUTO_PUBLISH is off by default. Every product waits for your approval before going live. You stay in control.',
  },
]

const STACK = [
  { label: 'Next.js 14', note: 'Frontend & API' },
  { label: 'PostgreSQL', note: 'Database' },
  { label: 'Ollama', note: 'Local AI' },
  { label: 'n8n', note: 'Automation' },
  { label: 'TypeScript', note: 'Type-safe' },
  { label: 'Tailwind CSS', note: 'Styling' },
]

export default function HomePage() {
  return (
    <>
      {/* Skip to main content — accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-sky-600 text-white px-4 py-2 rounded-lg text-sm z-50">
        Skip to main content
      </a>

      {/* Hero */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-950/40 via-slate-950 to-slate-950 pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-36 text-center">
          <div className="inline-flex items-center gap-2 bg-sky-950/60 border border-sky-800/50 text-sky-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" aria-hidden="true" />
            Open Source · Self-Hosted · Free Tier First
          </div>
          <h1 id="hero-heading" className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
            Create Digital Products<br />
            <span className="text-sky-400">with Local AI</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            An automated platform that researches market opportunities, generates digital products
            using AI running on your own machine, runs quality checks, and publishes to your store.
            No paid AI API. No subscription. Full data ownership.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard"
              className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950">
              Open Dashboard
            </Link>
            <Link href="/store"
              className="px-6 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950">
              Browse Products
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-600">
            Requires Node.js 20+, PostgreSQL, and Ollama installed locally.
          </p>
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 id="features-heading" className="text-2xl md:text-3xl font-bold text-white mb-3">
            Everything in one platform
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            From market research to published product — fully automated, fully auditable, fully yours.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <article key={f.title} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors">
              <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Product Lifecycle */}
      <section aria-labelledby="lifecycle-heading" className="bg-slate-900/50 border-y border-slate-800 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 id="lifecycle-heading" className="text-2xl font-bold text-white mb-3">Product Lifecycle</h2>
            <p className="text-slate-400 text-sm">Every product follows a transparent, auditable pipeline.</p>
          </div>
          <ol className="flex flex-wrap justify-center gap-2" aria-label="Product lifecycle stages">
            {['Research', 'Score', 'Approve', 'Generate', 'QA', 'Revise', 'Publish', 'Track'].map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium px-3 py-1.5 rounded-full">
                  <span className="text-sky-500 font-bold" aria-hidden="true">{i + 1}</span>
                  {step}
                </span>
                {i < 7 && <span className="text-slate-700 text-xs" aria-hidden="true">→</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Tech Stack */}
      <section aria-labelledby="stack-heading" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <h2 id="stack-heading" className="text-2xl font-bold text-white mb-3">Built on open-source</h2>
          <p className="text-slate-400 text-sm">Every component is replaceable. No vendor lock-in.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {STACK.map((s) => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-lg px-5 py-3 text-center">
              <div className="text-sm font-semibold text-white">{s.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.note}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section aria-labelledby="cta-heading" className="max-w-6xl mx-auto px-6 pb-24 text-center">
        <div className="bg-gradient-to-br from-sky-950/50 to-slate-900 border border-sky-900/40 rounded-2xl p-12">
          <h2 id="cta-heading" className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to start?
          </h2>
          <p className="text-slate-400 text-sm mb-8 max-w-md mx-auto">
            Open the dashboard to create your first product, run market research, or browse the store.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard"
              className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-950">
              Open Dashboard
            </Link>
            <Link href="/about"
              className="px-6 py-3 text-slate-400 hover:text-white text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-lg">
              Learn more about this project
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
