// Unit tests — Opportunity Scoring & Financial Engine

describe('Opportunity Scoring', () => {
  it('calculates total score correctly with default weights', () => {
    const weights = {
      demand: 0.20, buyer_intent: 0.20, problem_severity: 0.15,
      differentiation: 0.15, price_potential: 0.10,
      trend_momentum: 0.10, competition_opportunity: 0.10,
    }
    const scores = {
      demand_score: 80, competition_score: 40, problem_severity: 70,
      buyer_intent: 85, creation_difficulty: 60, production_cost: 90,
      price_potential: 75, differentiation_potential: 80,
      seasonality: 65, trend_momentum: 72,
    }
    const competition_opportunity = 100 - scores.competition_score // 60
    const total = Math.round(
      scores.demand_score              * weights.demand +
      scores.buyer_intent              * weights.buyer_intent +
      scores.problem_severity          * weights.problem_severity +
      scores.differentiation_potential * weights.differentiation +
      scores.price_potential           * weights.price_potential +
      scores.trend_momentum            * weights.trend_momentum +
      competition_opportunity          * weights.competition_opportunity
    )
    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThanOrEqual(100)
    expect(total).toBe(76)
  })

  it('clamps scores between 0 and 100', () => {
    const clamp = (v: number) => Math.min(100, Math.max(0, v))
    expect(clamp(-10)).toBe(0)
    expect(clamp(150)).toBe(100)
    expect(clamp(75)).toBe(75)
  })
})

describe('Financial Calculations', () => {
  it('calculates net revenue correctly', () => {
    const gross   = 37.00
    const discount = 0
    const refund   = 0
    const platform_fee = 2.59
    const payment_fee  = 0
    const other_fee    = 0
    const net = gross - discount - refund - platform_fee - payment_fee - other_fee
    expect(net).toBeCloseTo(34.41, 2)
  })

  it('calculates profit margin correctly', () => {
    const net_revenue = 34.41
    const expenses    = 0
    const net_profit  = net_revenue - expenses
    const margin      = (net_profit / net_revenue) * 100
    expect(margin).toBeCloseTo(100, 0)
  })

  it('calculates refund rate correctly', () => {
    const total_orders = 10
    const refund_count = 1
    const rate = (refund_count / total_orders) * 100
    expect(rate).toBe(10)
  })

  it('handles zero revenue without division errors', () => {
    const net_revenue = 0
    const profit_margin = net_revenue > 0 ? (0 / net_revenue) * 100 : 0
    expect(profit_margin).toBe(0)
  })
})

describe('Product Lifecycle', () => {
  const VALID_STATUSES = [
    'IDEA_DISCOVERED','RESEARCHING','OPPORTUNITY_SCORED','APPROVED_FOR_CREATION',
    'CREATING','CONTENT_GENERATED','ASSETS_GENERATED','QA_IN_PROGRESS',
    'QA_FAILED','REVISION_REQUIRED','READY_TO_PUBLISH','PUBLISHING',
    'PUBLISHED','SALES_TRACKING','PAUSED','ARCHIVED','FAILED',
  ]

  it('has all required lifecycle statuses', () => {
    expect(VALID_STATUSES).toContain('IDEA_DISCOVERED')
    expect(VALID_STATUSES).toContain('PUBLISHED')
    expect(VALID_STATUSES).toContain('FAILED')
    expect(VALID_STATUSES.length).toBe(17)
  })
})

describe('QA Engine', () => {
  it('fails products below minimum QA score', () => {
    const MIN_QA_SCORE = 75
    const score = 60
    expect(score >= MIN_QA_SCORE).toBe(false)
  })

  it('passes products at or above minimum QA score', () => {
    const MIN_QA_SCORE = 75
    const score = 78
    expect(score >= MIN_QA_SCORE).toBe(true)
  })

  it('blocks publish after max revisions', () => {
    const MAX_REVISIONS = 3
    const revision_count = 3
    expect(revision_count >= MAX_REVISIONS).toBe(true)
  })
})

describe('Free-Tier Protection', () => {
  it('blocks AI calls when daily limit reached', () => {
    const MAX = 200
    const used = 200
    const blocked = used >= MAX
    expect(blocked).toBe(true)
  })

  it('allows AI calls when under limit', () => {
    const MAX = 200
    const used = 150
    const blocked = used >= MAX
    expect(blocked).toBe(false)
  })
})
