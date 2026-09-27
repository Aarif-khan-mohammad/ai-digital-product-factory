// ============================================================
// PIPELINE RUNNER
// Runs each step of the product creation pipeline.
// Each step saves its output to job_steps so any failed step
// can be retried without re-running completed steps.
// ============================================================

import { query } from '@/lib/db/client'
import { callAI, extractJSON, loadPrompt, fillTemplate } from '@/lib/ai/provider'
import { scoreOpportunity } from '@/lib/scoring/engine'
import {
  generateProductIdeas, selectBestIdea, createProductFromIdea,
  generateProductContent, generateMarketingCopy, updateProductStatus,
} from '@/lib/generation/engine'
import {
  generatePDF, generateReadme, generateSalesDescriptionFile,
  generateKeywordsFile, generateProductMetadata, generatePlaceholderCover, createZipPackage,
} from '@/lib/generation/files'
import { runQA } from '@/lib/qa/engine'
import { addTimelineEvent } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  markStepRunning, markStepDone, markStepError,
  markJobCompleted, markJobFailed, markJobPaused,
  setJobProductId, getStepOutput, getJob,
} from '@/lib/jobs/engine'
import type { ResearchSource } from '@/types'

// ── PROGRESS CALLBACK ─────────────────────────────────────────
// Optional — used to push SSE messages while the client is still connected
export type ProgressCallback = (step: string, status: string, message: string, data?: Record<string, unknown>) => void
const noop: ProgressCallback = () => {}

// ── SCORE-DRIVEN PRICE DERIVATION ─────────────────────────────
// Uses the opportunity score dimensions to set a price that
// reflects actual demand, buyer intent, and price potential
// rather than a fixed default.
//
// Tiers (USD):
//   premium  $67–$97  — high price_potential + high demand + high buyer_intent
//   mid-high $47–$67  — solid demand, decent price potential
//   mid      $27–$47  — average signals
//   entry    $17–$27  — low demand or low buyer intent
//
// The AI's initial price suggestion acts as a soft anchor (20% weight)
// so it can nudge the result toward niche-aware pricing.
function derivePrice(
  aiPickPrice: number,
  pricePotential: number,
  demandScore: number,
  buyerIntent: number,
  competitionScore: number
): number {
  // Composite signal: weighted average of the four relevant dimensions
  const signal = (
    pricePotential * 0.40 +
    buyerIntent    * 0.30 +
    demandScore    * 0.20 +
    // low competition = more pricing power (invert: 100-comp gives 0–100 room)
    (100 - competitionScore) * 0.10
  )

  // Map signal (0–100) → price tier
  let scorePrice: number
  if      (signal >= 78) scorePrice = Math.round(67 + ((signal - 78) / 22) * 30)  // $67–$97
  else if (signal >= 60) scorePrice = Math.round(47 + ((signal - 60) / 18) * 20)  // $47–$67
  else if (signal >= 42) scorePrice = Math.round(27 + ((signal - 42) / 18) * 20)  // $27–$47
  else                   scorePrice = Math.round(17 + (signal / 42) * 10)          // $17–$27

  // Blend: 80% score-driven, 20% AI suggestion (soft anchor)
  const blended = Math.round(scorePrice * 0.80 + aiPickPrice * 0.20)

  // Round to the nearest psychologically friendly price point
  const points = [17, 19, 27, 37, 47, 57, 67, 77, 87, 97]
  return points.reduce((prev, curr) =>
    Math.abs(curr - blended) < Math.abs(prev - blended) ? curr : prev
  )
}

// ── TREND SIGNALS ─────────────────────────────────────────────
interface Signal {
  text:   string
  source: 'hacker_news' | 'google_news' | 'product_hunt' | 'exploding_topics' | 'gumroad'
}

// ── Hacker News (fully public API, zero auth needed) ──────────
// Uses /askstories + /showstories which are far more creator/product focused
// than /topstories (which is dominated by general tech and science news).
async function fetchHackerNewsSignals(): Promise<Signal[]> {
  const signals: Signal[] = []
  try {
    // Ask HN and Show HN surface real problems and indie products people build/pay for
    const [askRes, showRes] = await Promise.allSettled([
      fetch('https://hacker-news.firebaseio.com/v0/askstories.json', { signal: AbortSignal.timeout(8000) }),
      fetch('https://hacker-news.firebaseio.com/v0/showstories.json', { signal: AbortSignal.timeout(8000) }),
    ])
    const askIds  = askRes.status  === 'fulfilled' && askRes.value.ok  ? ((await askRes.value.json())  as number[]).slice(0, 30) : []
    const showIds = showRes.status === 'fulfilled' && showRes.value.ok ? ((await showRes.value.json()) as number[]).slice(0, 30) : []
    const ids = [...new Set([...askIds, ...showIds])]

    const items = await Promise.allSettled(
      ids.map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(5000) })
          .then((r) => r.json() as Promise<{ title: string; score: number; type: string }>)
      )
    )

    // Broader keyword set — Ask/Show HN stories use everyday language
    const mustHave = [
      'template', 'guide', 'ebook', 'workbook', 'checklist', 'planner', 'tracker',
      'notion', 'spreadsheet', 'prompt', 'newsletter', 'course', 'income', 'passive',
      'freelance', 'sell', 'digital', 'download', 'gumroad', 'etsy', 'creator',
      'side project', 'side hustle', 'indie', 'workflow', 'automation', 'productivity',
      'content', 'resume', 'swipe', 'tool i built', 'i made', 'i created', 'i launched',
      'saas', 'app i', 'build', 'startup', 'monetize', 'revenue', 'mrr', 'micro',
    ]
    const mustNotHave = [
      'politics', 'military', 'nuclear', 'exploit', 'cve', 'vulnerability',
    ]

    for (const item of items) {
      if (item.status !== 'fulfilled') continue
      const s = item.value
      if (!s?.title || s.score < 5) continue   // Ask/Show HN rarely get 50+ votes; 5 is meaningful
      const lower = s.title.toLowerCase()
      if (mustNotHave.some((k) => lower.includes(k))) continue
      if (mustHave.some((k) => lower.includes(k))) {
        signals.push({ text: `[HN] ${s.title}`, source: 'hacker_news' })
      }
    }
  } catch { /* skip */ }
  return signals.slice(0, 12)
}

// ── Gumroad discover (public page, no auth) ───────────────────
async function fetchGumroadSignals(): Promise<Signal[]> {
  const signals: Signal[] = []
  try {
    const res = await fetch('https://discover.gumroad.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal:  AbortSignal.timeout(15000),  // was 8s — Gumroad is slow
    })
    if (!res.ok) return signals
    const html = await res.text()
    // Gumroad embeds product data as JSON in the page — match product name strings
    const matches = [
      ...[...html.matchAll(/"name"\s*:\s*"([^"]{10,80})"/g)].map((m) => m[1]),
      ...[...html.matchAll(/data-name="([^"]{10,80})"/g)].map((m) => m[1]),
    ]
      .filter((t) => !t.includes('Gumroad') && !t.includes('http') && !t.includes('\\'))
      .filter((t, i, arr) => arr.indexOf(t) === i)  // dedupe
      .slice(0, 8)
    for (const t of matches) signals.push({ text: `[Gumroad Bestseller] ${t}`, source: 'gumroad' })
  } catch { /* skip */ }
  return signals
}

async function fetchGoogleNewsSignals(): Promise<Signal[]> {
  const queries = [
    'digital product ideas trending 2025',
    'best selling ebooks templates downloads',
    'AI tools productivity side hustle 2025',
    'online course workbook template business',
    'passive income digital downloads creator',
    'notion template spreadsheet planner sell',
  ]
  const signals: Signal[] = []

  await Promise.allSettled(queries.map(async (q) => {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en&gl=US&ceid=US:en`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal:  AbortSignal.timeout(8000),
      })
      if (!res.ok) return
      const text = await res.text()
      // Google News RSS uses plain <title> tags (not CDATA) since ~2023
      const titles = [
        ...[...text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].map((m) => m[1]),   // legacy CDATA
        ...[...text.matchAll(/<title>(?!\s*<!\[CDATA)(.*?)<\/title>/gs)].map((m) => m[1].trim()), // modern plain
      ]
        .filter((t) => !t.toLowerCase().includes('google news') && t.length > 15)
        .slice(0, 3)
      for (const t of titles) signals.push({ text: `[Google News] ${t}`, source: 'google_news' })
    } catch { /* skip */ }
  }))

  return signals
}

async function fetchProductHuntSignals(): Promise<Signal[]> {
  // Product Hunt /feed is Atom XML (<entry><title> not <item><title>)
  const signals: Signal[] = []
  try {
    const res = await fetch('https://www.producthunt.com/feed', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal:  AbortSignal.timeout(10000),
    })
    if (!res.ok) return signals
    const text = await res.text()
    // Atom format: <entry>...<title>Product Name</title>...
    // Skip the first <title> which is the feed title itself
    const entryTitles = [...text.matchAll(/<entry>[\s\S]*?<title>(.*?)<\/title>/g)]
      .map((m) => m[1].trim())
      .filter((t) => t.length > 3)
      .slice(0, 8)
    for (const t of entryTitles) {
      signals.push({ text: `[Product Hunt] ${t}`, source: 'product_hunt' })
    }
  } catch { /* skip */ }
  return signals
}

async function fetchExplodingTopicsSignals(): Promise<Signal[]> {
  // Exploding Topics removed their RSS feed — scrape blog post titles from their HTML blog page
  const signals: Signal[] = []
  try {
    const res = await fetch('https://explodingtopics.com/blog', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      signal:  AbortSignal.timeout(10000),
    })
    if (!res.ok) return signals
    const html = await res.text()
    // Blog post titles appear in <h2> and <h3> tags on the page
    const titles = [
      ...[...html.matchAll(/<h[23][^>]*>\s*(.*?)\s*<\/h[23]>/gs)].map((m) => m[1].replace(/<[^>]+>/g, '').trim()),
      ...[...html.matchAll(/"title"\s*:\s*"([^"]{15,100})"/g)].map((m) => m[1]),
    ]
      .filter((t) => t.length > 10 && !t.toLowerCase().includes('exploding topics') && !t.toLowerCase().includes('http'))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 6)
    for (const t of titles) signals.push({ text: `[Trending Topic] ${t}`, source: 'exploding_topics' })
  } catch { /* skip */ }
  return signals
}

async function fetchTrendSignals(): Promise<{ signals: Signal[]; sources: Record<string, number> }> {
  const [hackerNews, googleNews, productHunt, explodingTopics, gumroad] = await Promise.allSettled([
    fetchHackerNewsSignals(),
    fetchGoogleNewsSignals(),
    fetchProductHuntSignals(),
    fetchExplodingTopicsSignals(),
    fetchGumroadSignals(),
  ])

  const all: Signal[] = [
    ...(hackerNews.status      === 'fulfilled' ? hackerNews.value      : []),
    ...(googleNews.status      === 'fulfilled' ? googleNews.value      : []),
    ...(productHunt.status     === 'fulfilled' ? productHunt.value     : []),
    ...(explodingTopics.status === 'fulfilled' ? explodingTopics.value : []),
    ...(gumroad.status         === 'fulfilled' ? gumroad.value         : []),
  ]

  // Count per source for UI display
  const sources: Record<string, number> = {}
  for (const s of all) sources[s.source] = (sources[s.source] || 0) + 1

  logger.info('trends', `Signals: ${all.length} total | HN: ${sources.hacker_news||0} | Google: ${sources.google_news||0} | PH: ${sources.product_hunt||0} | ET: ${sources.exploding_topics||0} | Gumroad: ${sources.gumroad||0}`)

  return { signals: all.slice(0, 50), sources }
}

// ── AUTOPICK PIPELINE ─────────────────────────────────────────
export async function runAutopickPipeline(
  jobId: string,
  _input: Record<string, unknown>,
  onProgress: ProgressCallback = noop
): Promise<void> {
  const STEPS = [
    { key: 'trends',   idx: 0 },
    { key: 'pick',     idx: 1 },
    { key: 'research', idx: 2 },
    { key: 'score',    idx: 3 },
    { key: 'idea',     idx: 4 },
    { key: 'create',   idx: 5 },
    { key: 'generate', idx: 6 },
    { key: 'qa',       idx: 7 },
  ]

  // Re-load job to find out where to resume
  const job = await getJob(jobId)
  if (!job) throw new Error(`Job not found: ${jobId}`)
  const resumeFrom = job.current_step

  // Carry state between steps (load from DB for resume)
  let trendSignals: Signal[]        = []
  let pick: Record<string, unknown> = {}
  let sourceId        = ''
  let scoreId         = ''
  let productId       = ''

  // Rehydrate outputs from already-completed steps
  if (resumeFrom > 0) {
    const tOut = await getStepOutput(jobId, 'trends')
    // Support both old format (string[]) and new format (Signal[])
    const raw = tOut.signals
    if (Array.isArray(raw)) {
      trendSignals = raw.map((s) =>
        typeof s === 'string'
          ? { text: s, source: 'hacker_news' as const }
          : (s as Signal)
      )
    }
  }
  if (resumeFrom > 1) {
    pick = await getStepOutput(jobId, 'pick')
  }
  if (resumeFrom > 2) {
    const r = await getStepOutput(jobId, 'research')
    sourceId = (r.source_id as string) || ''
  }
  if (resumeFrom > 3) {
    const s = await getStepOutput(jobId, 'score')
    scoreId = (s.score_id as string) || ''
  }
  if (resumeFrom > 5) {
    const c = await getStepOutput(jobId, 'create')
    productId = (c.product_id as string) || ''
  }

  for (const step of STEPS) {
    if (step.idx < resumeFrom) continue  // already done — skip

    await markStepRunning(jobId, step.idx)

    try {
      // ─── STEP 0: TRENDS ──────────────────────────────────
      if (step.key === 'trends') {
        onProgress('trends', 'running', 'Scanning Hacker News, Google News, Product Hunt, Exploding Topics & Gumroad…')
        const result = await fetchTrendSignals()
        trendSignals = result.signals
        await markStepDone(jobId, step.idx, {
          signals: trendSignals,
          count:   trendSignals.length,
          sources: result.sources,
          reddit_auth: !!process.env.REDDIT_CLIENT_ID?.trim(),
        })
        const srcSummary = Object.entries(result.sources).map(([k, v]) => `${k}:${v}`).join(' ')
        onProgress('trends', 'done',
          `Captured ${trendSignals.length} signals (${srcSummary})`,
          { count: trendSignals.length, sources: result.sources }
        )
      }

      // ─── STEP 1: PICK ─────────────────────────────────────
      else if (step.key === 'pick') {
        onProgress('pick', 'running', 'AI selecting best opportunity from live signals…')
        const signalBlock = trendSignals.length > 0
          ? `LIVE SIGNALS FROM THE WEB (use these to identify what is actually trending right now):\n${
              trendSignals.map((s, i) => `${i + 1}. ${s.text}`).join('\n')
            }`
          : 'No live signals available — use your knowledge of current digital product trends.'

        const prompt = `You are a digital product strategist who creates downloadable products that sell on Gumroad and Etsy.
${signalBlock}

Based on the signals above, identify the SINGLE BEST opportunity for a downloadable digital product.

STRICT RULES — the product MUST:
- Be a downloadable file: PDF guide, ebook, workbook, template, spreadsheet, checklist, planner, prompt pack, or content calendar
- Solve a real, painful, everyday problem (NOT a scientific or academic topic)
- Target one of these proven buyer niches: productivity, freelancing, content creation, social media, personal finance, job search, small business, health habits, parenting, relationships, career growth, side hustle, design, writing, marketing
- Be creatable by a solo creator in a few hours
- Price between $17-$97

Respond ONLY with a single JSON object, no markdown, no explanation:
{"topic":"specific product name","niche":"2-3 word buyer niche","price":37,"why":"one sentence why this sells right now","hook":"one irresistible buy-now sentence","target_customer":"exactly who buys this","problem":"the specific painful problem it solves","unique_angle":"what makes it different"}`

        const res = await callAI({ prompt, temperature: 0.85, max_tokens: 500 }, { purpose: 'trend_autopick' })
        const parsed = extractJSON<typeof pick>(res.content)
        pick = {
          topic:           parsed.topic || 'Digital Product',
          niche:           parsed.niche || 'online business',
          price:           Math.min(97, Math.max(17, Number(parsed.price) || 37)),
          why:             parsed.why || '',
          hook:            parsed.hook || '',
          target_customer: parsed.target_customer || '',
          problem:         parsed.problem || '',
          unique_angle:    parsed.unique_angle || '',
        }
        await markStepDone(jobId, step.idx, pick)
        onProgress('pick', 'done', `Selected: "${pick.topic}" @ $${pick.price}`, { topic: pick.topic, niche: pick.niche, price: pick.price })
      }

      // ─── STEP 2: RESEARCH ──────────────────────────────────
      else if (step.key === 'research') {
        onProgress('research', 'running', `Researching "${pick.topic}"…`)
        const rsResult = await query<{ id: string }>(
          `INSERT INTO research_sources
            (keyword, niche, problem, target_customer, source, evidence, demand_signal, competition_signal, raw_data)
           VALUES ($1,$2,$3,$4,'AI_AUTOPICK',$5,$6,$7,$8) RETURNING id`,
          [pick.topic, pick.niche, pick.problem, pick.target_customer,
           `AI trend analysis: ${pick.why}`, 85, 35,
           JSON.stringify({ trend_signals: trendSignals.slice(0, 10).map((s) => s.text), pick })]
        )
        sourceId = rsResult.rows[0].id
        await markStepDone(jobId, step.idx, { source_id: sourceId })
        onProgress('research', 'done', `Market validated`, { source_id: sourceId })
      }

      // ─── STEP 3: SCORE ─────────────────────────────────────
      else if (step.key === 'score') {
        onProgress('score', 'running', 'Scoring opportunity…')
        const source: ResearchSource = {
          id: sourceId, keyword: String(pick.topic), niche: String(pick.niche),
          problem: String(pick.problem), target_customer: String(pick.target_customer),
          source: 'AI_AUTOPICK', source_url: null, evidence: String(pick.why),
          demand_signal: 85, competition_signal: 35, date_discovered: new Date(), raw_data: {},
        }
        const score = await scoreOpportunity(source)
        scoreId = score.id
        await markStepDone(jobId, step.idx, { score_id: scoreId, total_score: score.total_score })
        onProgress('score', 'done', `Score: ${score.total_score}/100`, { score: score.total_score })
      }

      // ─── STEP 4: IDEA ──────────────────────────────────────
      else if (step.key === 'idea') {
        onProgress('idea', 'running', 'Generating product concepts…')
        const source: ResearchSource = {
          id: sourceId, keyword: String(pick.topic), niche: String(pick.niche),
          problem: String(pick.problem), target_customer: String(pick.target_customer),
          source: 'AI_AUTOPICK', source_url: null, evidence: String(pick.why),
          demand_signal: 85, competition_signal: 35, date_discovered: new Date(), raw_data: {},
        }
        const scoreRow = await query<{
          id: string; total_score: number; weights: string
          price_potential: number; demand_score: number
          buyer_intent: number; competition_score: number
        }>(
          `SELECT id, total_score, weights, price_potential, demand_score, buyer_intent, competition_score
           FROM opportunity_scores WHERE id = $1`, [scoreId]
        )
        const sr = scoreRow.rows[0]
        const ideas = await generateProductIdeas(source, scoreId)
        const bestIdea = selectBestIdea(ideas, {
          ...sr,
          research_source_id: sourceId, product_idea_id: null,
          demand_score: sr?.demand_score ?? 85, competition_score: sr?.competition_score ?? 35,
          problem_severity: 80, buyer_intent: sr?.buyer_intent ?? 80,
          creation_difficulty: 60, production_cost: 90,
          price_potential: sr?.price_potential ?? 75, differentiation_potential: 80,
          seasonality: 70, trend_momentum: 75,
          weights: sr?.weights
            ? (typeof sr.weights === 'string' ? JSON.parse(sr.weights) : sr.weights)
            : {},
          calculated_at: new Date(),
        })

        // Derive price from opportunity score dimensions + AI suggestion
        bestIdea.estimated_price = derivePrice(
          Number(pick.price),
          sr?.price_potential ?? 75,
          sr?.demand_score    ?? 85,
          sr?.buyer_intent    ?? 80,
          sr?.competition_score ?? 35,
        )

        await markStepDone(jobId, step.idx, {
          idea_id: bestIdea.id,
          title: bestIdea.title,
          product_type: bestIdea.product_type,
          unique_value: bestIdea.unique_value,
          price: bestIdea.estimated_price,
        })
        onProgress('idea', 'done', `Concept: "${bestIdea.title}" — $${bestIdea.estimated_price}`, { title: bestIdea.title, price: bestIdea.estimated_price })

        // Persist idea choice for the create step
        await query(
          `UPDATE product_jobs SET input_data = input_data || $1 WHERE id = $2`,
          [JSON.stringify({ _selected_idea_id: bestIdea.id }), jobId]
        )
      }

      // ─── STEP 5: CREATE PRODUCT RECORD ─────────────────────
      else if (step.key === 'create') {
        onProgress('create', 'running', 'Creating product record…')

        // Get the selected idea id
        const jobRow = await query<{ input_data: Record<string, unknown> }>(
          `SELECT input_data FROM product_jobs WHERE id = $1`, [jobId]
        )
        const ideaId = (jobRow.rows[0]?.input_data as Record<string, unknown>)?._selected_idea_id as string
        if (!ideaId) throw new Error('No idea selected — cannot create product')

        await query(`UPDATE product_ideas SET status = 'APPROVED' WHERE id = $1`, [ideaId])
        const idea = await query(`SELECT * FROM product_ideas WHERE id = $1`, [ideaId])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const product = await createProductFromIdea(idea.rows[0] as any)
        await updateProductStatus(product.id, 'APPROVED_FOR_CREATION')

        await query(
          `UPDATE products SET metadata = metadata || $1 WHERE id = $2`,
          [JSON.stringify({ hook: pick.hook, unique_angle: pick.unique_angle, ai_autopick: true, job_id: jobId }), product.id]
        )

        productId = product.id
        await setJobProductId(jobId, productId)
        await markStepDone(jobId, step.idx, { product_id: productId, title: product.title })
        onProgress('create', 'done', `Product "${product.title}" created`, { product_id: productId })
      }

      // ─── STEP 6: GENERATE CONTENT + FILES ──────────────────
      else if (step.key === 'generate') {
        onProgress('generate', 'running', 'Writing content & generating files… (2–5 min)')

        const productRes = await query(`SELECT * FROM products WHERE id = $1`, [productId])
        const product = productRes.rows[0] as unknown as Awaited<ReturnType<typeof createProductFromIdea>>

        const content = await generateProductContent(product)
        const copy    = await generateMarketingCopy(product)

        const updatedRes = await query(`SELECT * FROM products WHERE id = $1`, [productId])
        const up = updatedRes.rows[0] as unknown as typeof product

        await Promise.allSettled([
          generatePDF(up, content).catch((e) => logger.warn('jobs', 'PDF failed', { error: String(e) })),
          generateReadme(up).catch((e) => logger.warn('jobs', 'README failed', { error: String(e) })),
          generateSalesDescriptionFile(up, copy).catch((e) => logger.warn('jobs', 'SalesDesc failed', { error: String(e) })),
          generateKeywordsFile(up, copy).catch((e) => logger.warn('jobs', 'Keywords failed', { error: String(e) })),
          generateProductMetadata(up).catch((e) => logger.warn('jobs', 'Metadata failed', { error: String(e) })),
          generatePlaceholderCover(up).catch((e) => logger.warn('jobs', 'Cover failed', { error: String(e) })),
        ])
        await createZipPackage(up).catch((e) => logger.warn('jobs', 'ZIP failed', { error: String(e) }))
        await updateProductStatus(productId, 'ASSETS_GENERATED')
        await addTimelineEvent(productId, 'ASSETS_GENERATED', `Files generated via job ${jobId}`)

        await markStepDone(jobId, step.idx, {
          subtitle:      copy.subtitle,
          bullet_points: copy.bullet_points?.slice(0, 3),
          tags:          copy.tags?.slice(0, 5),
        })
        onProgress('generate', 'done', 'Content written & files packaged')
      }

      // ─── STEP 7: QA ────────────────────────────────────────
      else if (step.key === 'qa') {
        onProgress('qa', 'running', 'Running quality check…')
        const qa = await runQA(productId)
        await markStepDone(jobId, step.idx, {
          qa_score: qa.overall_score,
          passed:   qa.passed,
        })
        onProgress('qa', qa.passed ? 'done' : 'warn',
          qa.passed ? `QA passed: ${qa.overall_score}/100 ✅` : `QA score ${qa.overall_score}/100 — review needed`,
          { qa_score: qa.overall_score, passed: qa.passed }
        )
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await markStepError(jobId, step.idx, msg)
      await markJobFailed(jobId, `Step "${step.key}" failed: ${msg}`)
      logger.error('jobs', `Step failed`, { job_id: jobId, step: step.key, error: msg })
      throw err
    }
  }

  await markJobCompleted(jobId)
}

// ── AI_CREATE PIPELINE ────────────────────────────────────────
export async function runAICreatePipeline(
  jobId: string,
  input: Record<string, unknown>,
  onProgress: ProgressCallback = noop
): Promise<void> {
  const topic = String(input.topic || '')
  const niche = String(input.niche || '')
  const price = Number(input.price || 27)

  const STEPS = [
    { key: 'research', idx: 0 },
    { key: 'score',    idx: 1 },
    { key: 'idea',     idx: 2 },
    { key: 'create',   idx: 3 },
    { key: 'generate', idx: 4 },
    { key: 'qa',       idx: 5 },
  ]

  const job = await getJob(jobId)
  if (!job) throw new Error(`Job not found: ${jobId}`)
  const resumeFrom = job.current_step

  // Rehydrate state for resume
  let sourceId  = ''
  let scoreId   = ''
  let productId = ''

  if (resumeFrom > 0) { sourceId  = String((await getStepOutput(jobId, 'research')).source_id || '') }
  if (resumeFrom > 1) { scoreId   = String((await getStepOutput(jobId, 'score')).score_id     || '') }
  if (resumeFrom > 3) { productId = String((await getStepOutput(jobId, 'create')).product_id  || '') }
  if (!productId && job.product_id) productId = job.product_id

  for (const step of STEPS) {
    if (step.idx < resumeFrom) continue

    await markStepRunning(jobId, step.idx)
    try {

      // RESEARCH
      if (step.key === 'research') {
        onProgress('research', 'running', `Researching "${topic}" in ${niche}…`)
        const rp = await loadPrompt('market_research')
        const evidence = `User-selected topic: ${topic}. Niche: ${niche}.`
        const filled = fillTemplate(rp.template, { keyword: topic, niche, evidence })
        const res = await callAI({ prompt: filled, temperature: rp.temperature, max_tokens: 600 }, { purpose: 'market_research' })
        const analysis = extractJSON<{ problem: string; target_customer: string; demand_signal: number; competition_signal: number }>(res.content)

        const rsResult = await query<{ id: string }>(
          `INSERT INTO research_sources (keyword, niche, problem, target_customer, source, evidence, demand_signal, competition_signal, raw_data)
           VALUES ($1,$2,$3,$4,'AI_AUTO',$5,$6,$7,'{}') RETURNING id`,
          [topic, niche, analysis.problem, analysis.target_customer, evidence, analysis.demand_signal || 70, analysis.competition_signal || 40]
        )
        sourceId = rsResult.rows[0].id
        await markStepDone(jobId, step.idx, { source_id: sourceId, problem: analysis.problem, target_customer: analysis.target_customer })
        onProgress('research', 'done', `Problem: ${analysis.problem.slice(0, 80)}`)
      }

      // SCORE
      else if (step.key === 'score') {
        onProgress('score', 'running', 'Scoring opportunity…')
        const rOut = await getStepOutput(jobId, 'research')
        const source: ResearchSource = {
          id: sourceId, keyword: topic, niche,
          problem: String(rOut.problem || topic), target_customer: String(rOut.target_customer || ''),
          source: 'AI_AUTO', source_url: null, evidence: `User-selected topic: ${topic}`,
          demand_signal: 70, competition_signal: 40, date_discovered: new Date(), raw_data: {},
        }
        const score = await scoreOpportunity(source)
        scoreId = score.id
        await markStepDone(jobId, step.idx, { score_id: scoreId, total_score: score.total_score })
        onProgress('score', 'done', `Score: ${score.total_score}/100`)
      }

      // IDEA
      else if (step.key === 'idea') {
        onProgress('idea', 'running', 'Generating product concepts…')
        const rOut = await getStepOutput(jobId, 'research')
        const source: ResearchSource = {
          id: sourceId, keyword: topic, niche,
          problem: String(rOut.problem || topic), target_customer: String(rOut.target_customer || ''),
          source: 'AI_AUTO', source_url: null, evidence: `User-selected topic: ${topic}`,
          demand_signal: 70, competition_signal: 40, date_discovered: new Date(), raw_data: {},
        }
        const scoreRow = await query<{
          id: string; total_score: number; weights: string
          price_potential: number; demand_score: number
          buyer_intent: number; competition_score: number
        }>(
          `SELECT id, total_score, weights, price_potential, demand_score, buyer_intent, competition_score
           FROM opportunity_scores WHERE id = $1`, [scoreId]
        )
        const sr = scoreRow.rows[0]
        const ideas = await generateProductIdeas(source, scoreId)
        const bestIdea = selectBestIdea(ideas, {
          ...sr,
          research_source_id: sourceId, product_idea_id: null,
          demand_score: sr?.demand_score ?? 70, competition_score: sr?.competition_score ?? 40,
          problem_severity: 70, buyer_intent: sr?.buyer_intent ?? 70,
          creation_difficulty: 60, production_cost: 90,
          price_potential: sr?.price_potential ?? 70, differentiation_potential: 70,
          seasonality: 70, trend_momentum: 70,
          weights: sr?.weights
            ? (typeof sr.weights === 'string' ? JSON.parse(sr.weights) : sr.weights)
            : {},
          calculated_at: new Date(),
        })

        // Derive price from opportunity score dimensions + user-provided price anchor
        bestIdea.estimated_price = derivePrice(
          price,
          sr?.price_potential  ?? 70,
          sr?.demand_score     ?? 70,
          sr?.buyer_intent     ?? 70,
          sr?.competition_score ?? 40,
        )

        await query(`UPDATE product_jobs SET input_data = input_data || $1 WHERE id = $2`,
          [JSON.stringify({ _selected_idea_id: bestIdea.id }), jobId])
        await markStepDone(jobId, step.idx, {
          idea_id: bestIdea.id, title: bestIdea.title,
          product_type: bestIdea.product_type, price: bestIdea.estimated_price,
        })
        onProgress('idea', 'done', `Concept: "${bestIdea.title}" — $${bestIdea.estimated_price}`, { price: bestIdea.estimated_price })
      }

      // CREATE
      else if (step.key === 'create') {
        onProgress('create', 'running', 'Creating product record…')
        const jobRow = await query<{ input_data: Record<string, unknown> }>(`SELECT input_data FROM product_jobs WHERE id = $1`, [jobId])
        const ideaId = (jobRow.rows[0]?.input_data as Record<string, unknown>)?._selected_idea_id as string
        if (!ideaId) throw new Error('No idea selected')
        await query(`UPDATE product_ideas SET status = 'APPROVED' WHERE id = $1`, [ideaId])
        const idea = await query(`SELECT * FROM product_ideas WHERE id = $1`, [ideaId])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const product = await createProductFromIdea(idea.rows[0] as any)
        await updateProductStatus(product.id, 'APPROVED_FOR_CREATION')
        productId = product.id
        await setJobProductId(jobId, productId)
        await markStepDone(jobId, step.idx, { product_id: productId, title: product.title })
        onProgress('create', 'done', `Product "${product.title}" created`, { product_id: productId })
      }

      // GENERATE
      else if (step.key === 'generate') {
        onProgress('generate', 'running', 'Writing content & generating files… (2–5 min)')
        const productRes = await query(`SELECT * FROM products WHERE id = $1`, [productId])
        const product = productRes.rows[0] as unknown as Awaited<ReturnType<typeof createProductFromIdea>>
        const content = await generateProductContent(product)
        const copy    = await generateMarketingCopy(product)
        const updatedRes = await query(`SELECT * FROM products WHERE id = $1`, [productId])
        const up = updatedRes.rows[0] as unknown as typeof product
        await Promise.allSettled([
          generatePDF(up, content).catch((e) => logger.warn('jobs', 'PDF failed', { error: String(e) })),
          generateReadme(up).catch((e) => logger.warn('jobs', 'README failed', { error: String(e) })),
          generateSalesDescriptionFile(up, copy).catch((e) => logger.warn('jobs', 'SalesDesc failed', { error: String(e) })),
          generateKeywordsFile(up, copy).catch((e) => logger.warn('jobs', 'Keywords failed', { error: String(e) })),
          generateProductMetadata(up).catch((e) => logger.warn('jobs', 'Metadata failed', { error: String(e) })),
          generatePlaceholderCover(up).catch((e) => logger.warn('jobs', 'Cover failed', { error: String(e) })),
        ])
        await createZipPackage(up).catch((e) => logger.warn('jobs', 'ZIP failed', { error: String(e) }))
        await updateProductStatus(productId, 'ASSETS_GENERATED')
        await addTimelineEvent(productId, 'ASSETS_GENERATED', `Files generated via job ${jobId}`)
        await markStepDone(jobId, step.idx, { subtitle: copy.subtitle, bullet_points: copy.bullet_points?.slice(0, 3) })
        onProgress('generate', 'done', 'Content written & files packaged')
      }

      // QA
      else if (step.key === 'qa') {
        onProgress('qa', 'running', 'Running quality check…')
        const qa = await runQA(productId)
        await markStepDone(jobId, step.idx, { qa_score: qa.overall_score, passed: qa.passed })
        onProgress('qa', qa.passed ? 'done' : 'warn',
          qa.passed ? `QA passed: ${qa.overall_score}/100 ✅` : `QA score ${qa.overall_score}/100`,
          { qa_score: qa.overall_score, passed: qa.passed }
        )
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await markStepError(jobId, step.idx, msg)
      await markJobFailed(jobId, `Step "${step.key}" failed: ${msg}`)
      throw err
    }
  }

  await markJobCompleted(jobId)
}

// ── DISPATCH (runs in background — fire and forget from API layer) ──
export async function dispatchJob(
  jobId: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const job = await getJob(jobId)
  if (!job) return

  const progress = onProgress ?? noop

  try {
    if (job.job_type === 'AUTOPICK') {
      await runAutopickPipeline(jobId, job.input_data, progress)
    } else {
      await runAICreatePipeline(jobId, job.input_data, progress)
    }
  } catch (err) {
    // Error already persisted by individual step handlers above
    logger.error('jobs', 'Pipeline dispatch error', { job_id: jobId, error: String(err) })
  }
}
