// ============================================================
// RESEARCH ENGINE — Discovers digital product opportunities
// ============================================================

import { query } from '@/lib/db/client'
import { callAI, extractJSON, loadPrompt, fillTemplate } from '@/lib/ai/provider'
import { addTimelineEvent } from '@/lib/audit'
import { logger } from '@/lib/logger'
import type { ResearchSource } from '@/types'

// ── PUBLIC DATA SOURCES ───────────────────────────────────────
const RESEARCH_NICHES = [
  'small business', 'freelancing', 'personal finance', 'productivity',
  'health and wellness', 'online business', 'content creation', 'marketing',
  'career development', 'education', 'real estate', 'investing',
  'e-commerce', 'social media', 'remote work', 'side hustles',
]

const PRODUCT_KEYWORDS = [
  'template', 'checklist', 'planner', 'tracker', 'guide', 'workbook',
  'spreadsheet', 'toolkit', 'system', 'framework', 'cheat sheet',
  'swipe file', 'prompt pack', 'resource library',
]

// ── REDDIT PUBLIC API (no auth required for public posts) ────
async function fetchRedditSignals(niche: string): Promise<Array<{
  title: string
  url: string
  score: number
  body: string
}>> {
  try {
    const query_str = encodeURIComponent(`${niche} template OR checklist OR guide OR planner`)
    const url = `https://www.reddit.com/search.json?q=${query_str}&sort=top&t=month&limit=10`

    const res = await fetch(url, {
      headers: { 'User-Agent': process.env.REDDIT_USER_AGENT || 'DigitalProductFactory/1.0' },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return []

    const data = await res.json() as {
      data?: { children?: Array<{ data: { title: string; url: string; score: number; selftext: string } }> }
    }

    return (data.data?.children || []).map((c) => ({
      title: c.data.title,
      url:   c.data.url,
      score: c.data.score,
      body:  c.data.selftext?.slice(0, 500) || '',
    }))
  } catch (err) {
    logger.warn('research', 'Reddit fetch failed', { niche, error: String(err) })
    return []
  }
}

// ── RSS FEED SIGNALS ──────────────────────────────────────────
async function fetchRSSSignals(niche: string): Promise<Array<{ title: string; url: string }>> {
  const feeds = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(niche + ' digital product')}&hl=en`,
  ]

  const results: Array<{ title: string; url: string }> = []

  for (const feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const text = await res.text()
      const items = text.match(/<item>[\s\S]*?<\/item>/g) || []
      for (const item of items.slice(0, 5)) {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                      item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const link  = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
        if (title) results.push({ title, url: link })
      }
    } catch {
      // Skip failed feeds silently
    }
  }

  return results
}

// ── AI-POWERED OPPORTUNITY ANALYSIS ──────────────────────────
async function analyzeOpportunity(
  keyword: string,
  niche: string,
  evidence: string
): Promise<{
  problem: string
  target_customer: string
  demand_signal: number
  competition_signal: number
}> {
  const prompt_data = await loadPrompt('market_research')
  const prompt = fillTemplate(prompt_data.template, { keyword, niche, evidence })

  const response = await callAI(
    { prompt, temperature: prompt_data.temperature, model: prompt_data.model || undefined },
    { purpose: 'market_research' }
  )

  return extractJSON(response.content)
}

// ── STORE RESEARCH SOURCE ─────────────────────────────────────
async function storeResearchSource(data: Omit<ResearchSource, 'id' | 'date_discovered'>): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO research_sources
      (keyword, niche, problem, target_customer, source, source_url, evidence, demand_signal, competition_signal, raw_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      data.keyword,
      data.niche,
      data.problem,
      data.target_customer,
      data.source,
      data.source_url,
      data.evidence,
      data.demand_signal,
      data.competition_signal,
      JSON.stringify(data.raw_data),
    ]
  )
  return result.rows[0].id
}

// ── MAIN RESEARCH RUNNER ──────────────────────────────────────
export async function runMarketResearch(workflowRunId?: string): Promise<{
  sources_found: number
  niches_researched: number
}> {
  // Check daily research limit
  const maxJobs = parseInt(process.env.MAX_DAILY_RESEARCH_JOBS || '5')
  const today   = new Date().toISOString().split('T')[0]
  const usedRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM workflow_runs
     WHERE workflow_name = 'DAILY_MARKET_RESEARCH'
       AND started_at::date = $1
       AND status = 'COMPLETED'`,
    [today]
  )
  const usedJobs = parseInt(usedRes.rows[0]?.count || '0')
  if (usedJobs >= maxJobs) {
    throw new Error(`FREE_TIER_LIMIT: Daily research job limit reached (${usedJobs}/${maxJobs})`)
  }

  let sources_found = 0
  const niches_to_research = RESEARCH_NICHES.slice(0, 3) // Research 3 niches per run

  for (const niche of niches_to_research) {
    try {
      logger.info('research', `Researching niche: ${niche}`)

      // Gather signals from multiple sources
      const [redditSignals, rssSignals] = await Promise.all([
        fetchRedditSignals(niche),
        fetchRSSSignals(niche),
      ])

      // Build evidence string
      const evidence_parts: string[] = []
      if (redditSignals.length > 0) {
        evidence_parts.push(`Reddit discussions: ${redditSignals.slice(0, 3).map((s) => s.title).join('; ')}`)
      }
      if (rssSignals.length > 0) {
        evidence_parts.push(`News/trends: ${rssSignals.slice(0, 3).map((s) => s.title).join('; ')}`)
      }

      // Generate keyword combinations
      for (const keyword of PRODUCT_KEYWORDS.slice(0, 2)) {
        const evidence = evidence_parts.join('. ') || `General demand for ${niche} ${keyword}s`

        try {
          const analysis = await analyzeOpportunity(keyword, niche, evidence)

          const sourceId = await storeResearchSource({
            keyword:            `${niche} ${keyword}`,
            niche,
            problem:            analysis.problem,
            target_customer:    analysis.target_customer,
            source:             'AI_ANALYSIS + REDDIT + RSS',
            source_url:         redditSignals[0]?.url || null,
            evidence,
            demand_signal:      analysis.demand_signal,
            competition_signal: analysis.competition_signal,
            raw_data: {
              reddit_signals: redditSignals.slice(0, 3),
              rss_signals:    rssSignals.slice(0, 3),
            },
          })

          // Store market signals
          for (const signal of redditSignals.slice(0, 3)) {
            await query(
              `INSERT INTO market_signals (research_source_id, signal_type, signal_value, strength)
               VALUES ($1, 'FORUM', $2, $3)`,
              [sourceId, signal.title.slice(0, 500), Math.min(signal.score / 100, 10)]
            )
          }

          sources_found++
          logger.info('research', `Stored research source`, { id: sourceId, niche, keyword })
        } catch (err) {
          logger.warn('research', `Failed to analyze opportunity`, { niche, keyword, error: String(err) })
        }
      }
    } catch (err) {
      logger.error('research', `Failed to research niche`, { niche, error: String(err) })
    }
  }

  return { sources_found, niches_researched: niches_to_research.length }
}

// ── GET RECENT RESEARCH ───────────────────────────────────────
export async function getRecentResearch(limit = 20): Promise<ResearchSource[]> {
  const result = await query<ResearchSource>(
    `SELECT * FROM research_sources ORDER BY date_discovered DESC LIMIT $1`,
    [limit]
  )
  return result.rows
}

export async function getResearchById(id: string): Promise<ResearchSource | null> {
  const result = await query<ResearchSource>(
    `SELECT * FROM research_sources WHERE id = $1`,
    [id]
  )
  return result.rows[0] || null
}
