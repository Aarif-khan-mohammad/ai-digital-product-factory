// ============================================================
// OPPORTUNITY SCORING ENGINE
// ============================================================

import { query } from '@/lib/db/client'
import { callAI, extractJSON, loadPrompt, fillTemplate } from '@/lib/ai/provider'
import { logger } from '@/lib/logger'
import type { OpportunityScore, ScoringWeights, ResearchSource } from '@/types'

const DEFAULT_WEIGHTS: ScoringWeights = {
  demand:                  0.20,
  buyer_intent:            0.20,
  problem_severity:        0.15,
  differentiation:         0.15,
  price_potential:         0.10,
  trend_momentum:          0.10,
  competition_opportunity: 0.10,
}

async function getWeights(): Promise<ScoringWeights> {
  const result = await query<{ value: unknown }>(
    `SELECT value FROM settings WHERE key = 'scoring_weights'`
  )
  if (result.rows[0]?.value) {
    try {
      const v = result.rows[0].value
      return (typeof v === 'string' ? JSON.parse(v) : v) as ScoringWeights
    } catch {
      return DEFAULT_WEIGHTS
    }
  }
  return DEFAULT_WEIGHTS
}

function calculateTotalScore(scores: Omit<OpportunityScore, 'id' | 'research_source_id' | 'product_idea_id' | 'total_score' | 'weights' | 'calculated_at'>, weights: ScoringWeights): number {
  // Competition score: invert competition_signal (lower competition = higher score)
  const competition_opportunity = 100 - scores.competition_score

  return Math.round(
    scores.demand_score              * weights.demand +
    scores.buyer_intent              * weights.buyer_intent +
    scores.problem_severity          * weights.problem_severity +
    scores.differentiation_potential * weights.differentiation +
    scores.price_potential           * weights.price_potential +
    scores.trend_momentum            * weights.trend_momentum +
    competition_opportunity          * weights.competition_opportunity
  )
}

export async function scoreOpportunity(
  source: ResearchSource,
  productIdeaId?: string
): Promise<OpportunityScore> {
  const prompt_data = await loadPrompt('opportunity_scoring')
  const prompt = fillTemplate(prompt_data.template, {
    keyword:         source.keyword,
    niche:           source.niche,
    problem:         source.problem,
    target_customer: source.target_customer,
    evidence:        source.evidence,
  })

  const response = await callAI(
    { prompt, temperature: prompt_data.temperature },
    { purpose: 'opportunity_scoring' }
  )

  const raw = extractJSON<{
    demand_score: number
    competition_score: number
    problem_severity: number
    buyer_intent: number
    creation_difficulty: number
    production_cost: number
    price_potential: number
    differentiation_potential: number
    seasonality: number
    trend_momentum: number
  }>(response.content)

  const weights = await getWeights()

  const scores = {
    demand_score:              Math.min(100, Math.max(0, raw.demand_score || 50)),
    competition_score:         Math.min(100, Math.max(0, raw.competition_score || 50)),
    problem_severity:          Math.min(100, Math.max(0, raw.problem_severity || 50)),
    buyer_intent:              Math.min(100, Math.max(0, raw.buyer_intent || 50)),
    creation_difficulty:       Math.min(100, Math.max(0, raw.creation_difficulty || 50)),
    production_cost:           Math.min(100, Math.max(0, raw.production_cost || 50)),
    price_potential:           Math.min(100, Math.max(0, raw.price_potential || 50)),
    differentiation_potential: Math.min(100, Math.max(0, raw.differentiation_potential || 50)),
    seasonality:               Math.min(100, Math.max(0, raw.seasonality || 50)),
    trend_momentum:            Math.min(100, Math.max(0, raw.trend_momentum || 50)),
  }

  const total_score = calculateTotalScore(scores, weights)

  const result = await query<{ id: string }>(
    `INSERT INTO opportunity_scores
      (research_source_id, product_idea_id, demand_score, competition_score, problem_severity,
       buyer_intent, creation_difficulty, production_cost, price_potential,
       differentiation_potential, seasonality, trend_momentum, total_score, weights)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id`,
    [
      source.id,
      productIdeaId || null,
      scores.demand_score,
      scores.competition_score,
      scores.problem_severity,
      scores.buyer_intent,
      scores.creation_difficulty,
      scores.production_cost,
      scores.price_potential,
      scores.differentiation_potential,
      scores.seasonality,
      scores.trend_momentum,
      total_score,
      JSON.stringify(weights),
    ]
  )

  logger.info('scoring', `Scored opportunity`, {
    research_id: source.id,
    total_score,
    niche: source.niche,
  })

  return {
    id:                        result.rows[0].id,
    research_source_id:        source.id,
    product_idea_id:           productIdeaId || null,
    ...scores,
    total_score,
    weights,
    calculated_at:             new Date(),
  }
}

export async function getTopOpportunities(minScore = 70, limit = 10): Promise<Array<{
  score: OpportunityScore
  source: ResearchSource
}>> {
  const result = await query<OpportunityScore & ResearchSource & { score_id: string; source_id: string }>(
    `SELECT
       os.id as score_id, os.total_score, os.demand_score, os.competition_score,
       os.problem_severity, os.buyer_intent, os.creation_difficulty, os.production_cost,
       os.price_potential, os.differentiation_potential, os.seasonality, os.trend_momentum,
       os.weights, os.calculated_at,
       rs.id as source_id, rs.keyword, rs.niche, rs.problem, rs.target_customer,
       rs.source, rs.source_url, rs.evidence, rs.demand_signal, rs.competition_signal, rs.date_discovered
     FROM opportunity_scores os
     JOIN research_sources rs ON rs.id = os.research_source_id
     WHERE os.total_score >= $1
     ORDER BY os.total_score DESC
     LIMIT $2`,
    [minScore, limit]
  )

  return result.rows.map((row) => ({
    score: {
      id:                        row.score_id,
      research_source_id:        row.source_id,
      product_idea_id:           null,
      demand_score:              row.demand_score,
      competition_score:         row.competition_score,
      problem_severity:          row.problem_severity,
      buyer_intent:              row.buyer_intent,
      creation_difficulty:       row.creation_difficulty,
      production_cost:           row.production_cost,
      price_potential:           row.price_potential,
      differentiation_potential: row.differentiation_potential,
      seasonality:               row.seasonality,
      trend_momentum:            row.trend_momentum,
      total_score:               row.total_score,
      weights:                   row.weights as unknown as ScoringWeights,
      calculated_at:             row.calculated_at,
    },
    source: {
      id:                 row.source_id,
      keyword:            row.keyword,
      niche:              row.niche,
      problem:            row.problem,
      target_customer:    row.target_customer,
      source:             row.source,
      source_url:         row.source_url,
      evidence:           row.evidence,
      demand_signal:      row.demand_signal,
      competition_signal: row.competition_signal,
      date_discovered:    row.date_discovered,
      raw_data:           {},
    },
  }))
}
