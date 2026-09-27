// ============================================================
// PRODUCT GENERATION ENGINE
// ============================================================

import { query } from '@/lib/db/client'
import { callAI, extractJSON, loadPrompt, fillTemplate } from '@/lib/ai/provider'
import { addTimelineEvent, auditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'
import type { ProductIdea, Product, ResearchSource, OpportunityScore } from '@/types'

// ── IDEA GENERATION ───────────────────────────────────────────
const PRODUCT_TYPES = ['PDF_GUIDE','EBOOK','CHECKLIST','WORKBOOK','TEMPLATE',
  'SPREADSHEET_TEMPLATE','PROMPT_PACK','FINANCIAL_TRACKER','CONTENT_CALENDAR','RESOURCE_LIBRARY']

// Parse plain-text idea blocks. Each idea is separated by "---" or "IDEA N:".
// Within each block, look for labelled lines:
//   TITLE: ...  TYPE: ...  VALUE: ...  PRICE: ...  TIME: ...  DIFFICULTY: ...  STRATEGY: ...
function parseIdeasText(raw: string) {
  type IdeaShape = {
    title: string; product_type: string; unique_value: string
    estimated_price: number; estimated_creation_time: number
    difficulty: number; differentiation_strategy: string
  }

  // Split on separators: blank line before "IDEA", "---", or "###"
  const blocks = raw
    .split(/(?:^|\n)(?:---+|#{2,3}|IDEA\s+\d+)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 10)

  const ideas: IdeaShape[] = []

  for (const block of blocks.slice(0, 5)) {
    const get = (pattern: RegExp): string => {
      const m = block.match(pattern)
      return m ? m[1].trim() : ''
    }
    const title  = get(/TITLE:\s*(.+)/i)   || get(/^#+\s*(.+)/m) || ''
    if (!title) continue

    const typeRaw = get(/TYPE:\s*(.+)/i).toUpperCase().replace(/\s+/g, '_')
    const product_type = PRODUCT_TYPES.includes(typeRaw) ? typeRaw : 'PDF_GUIDE'

    ideas.push({
      title,
      product_type,
      unique_value:             get(/(?:VALUE|UNIQUE[_ ]VALUE):\s*(.+)/i),
      estimated_price:          parseInt(get(/PRICE:\s*\$?(\d+)/i))  || 27,
      estimated_creation_time:  parseInt(get(/TIME:\s*(\d+)/i))      || 4,
      difficulty:               parseInt(get(/DIFFICULTY:\s*(\d+)/i)) || 5,
      differentiation_strategy: get(/STRATEGY:\s*(.+)/i),
    })
  }
  return ideas
}

export async function generateProductIdeas(
  source: ResearchSource,
  scoreId: string
): Promise<ProductIdea[]> {
  const prompt = `You are a digital product creator. Generate exactly 3 product ideas for this opportunity.

Niche: ${source.niche}
Problem: ${source.problem}
Target Customer: ${source.target_customer}
Evidence: ${source.evidence}

Write each idea using EXACTLY this labelled format. Do not use JSON. Separate ideas with ---.

IDEA 1
TITLE: Short product name
TYPE: One of PDF_GUIDE, EBOOK, CHECKLIST, WORKBOOK, TEMPLATE, SPREADSHEET_TEMPLATE, PROMPT_PACK, FINANCIAL_TRACKER, CONTENT_CALENDAR, RESOURCE_LIBRARY
VALUE: One sentence describing the unique benefit for the buyer
PRICE: 37
TIME: 5
DIFFICULTY: 4
STRATEGY: One sentence on how this stands out from competitors

---

IDEA 2
TITLE: ...
TYPE: ...
VALUE: ...
PRICE: ...
TIME: ...
DIFFICULTY: ...
STRATEGY: ...

---

IDEA 3
TITLE: ...
TYPE: ...
VALUE: ...
PRICE: ...
TIME: ...
DIFFICULTY: ...
STRATEGY: ...`

  const response = await callAI(
    { prompt, temperature: 0.8, max_tokens: 700 },
    { purpose: 'idea_generation' }
  )

  const ideas = parseIdeasText(response.content)

  // Fallback: if plain-text parse got nothing, try JSON (covers edge cases)
  if (ideas.length === 0) {
    try {
      const raw = extractJSON<Array<Record<string, unknown>>>(response.content)
      for (const item of raw.slice(0, 3)) {
        const typeRaw = String(item.product_type ?? '').toUpperCase().replace(/\s+/g, '_')
        ideas.push({
          title:                    String(item.title ?? 'Digital Product'),
          product_type:             PRODUCT_TYPES.includes(typeRaw) ? typeRaw : 'PDF_GUIDE',
          unique_value:             String(item.unique_value ?? ''),
          estimated_price:          Number(item.estimated_price) || 27,
          estimated_creation_time:  Number(item.estimated_creation_time) || 4,
          difficulty:               Number(item.difficulty) || 5,
          differentiation_strategy: String(item.differentiation_strategy ?? ''),
        })
      }
    } catch { /* give up — insert empty list */ }
  }

  if (ideas.length === 0) {
    throw new Error('AI returned no parseable product ideas. Please retry.')
  }

  const stored: ProductIdea[] = []

  for (const idea of ideas.slice(0, 5)) {
    const result = await query<{ id: string }>(
      `INSERT INTO product_ideas
        (research_source_id, opportunity_score_id, title, product_type, niche, problem,
         target_customer, unique_value, estimated_price, estimated_creation_time,
         difficulty, differentiation_strategy, required_assets)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        source.id,
        scoreId,
        idea.title,
        idea.product_type || 'PDF_GUIDE',
        source.niche,
        source.problem,
        source.target_customer,
        idea.unique_value,
        idea.estimated_price || 27,
        idea.estimated_creation_time || 4,
        Math.min(10, Math.max(1, idea.difficulty || 5)),
        idea.differentiation_strategy,
        JSON.stringify(['PDF', 'COVER', 'PREVIEW']),
      ]
    )

    stored.push({
      id:                       result.rows[0].id,
      research_source_id:       source.id,
      opportunity_score_id:     scoreId,
      title:                    idea.title,
      product_type:             idea.product_type as ProductIdea['product_type'],
      niche:                    source.niche,
      problem:                  source.problem,
      target_customer:          source.target_customer,
      unique_value:             idea.unique_value,
      estimated_price:          idea.estimated_price || 27,
      estimated_creation_time:  idea.estimated_creation_time || 4,
      difficulty:               idea.difficulty || 5,
      differentiation_strategy: idea.differentiation_strategy,
      required_assets:          ['PDF', 'COVER', 'PREVIEW'],
      status:                   'PENDING',
      created_at:               new Date(),
    })
  }

  logger.info('generation', `Generated ${stored.length} product ideas`, { niche: source.niche })
  return stored
}

// ── SELECT BEST IDEA ──────────────────────────────────────────
export function selectBestIdea(ideas: ProductIdea[], score: OpportunityScore): ProductIdea {
  // Score each idea: lower difficulty + higher price potential = better
  const ranked = ideas.map((idea) => ({
    idea,
    rank: (100 - idea.difficulty * 10) * 0.4 +
          (idea.estimated_price / 100) * 0.3 +
          score.total_score * 0.3,
  }))
  ranked.sort((a, b) => b.rank - a.rank)
  return ranked[0].idea
}

// ── CREATE PRODUCT FROM IDEA ──────────────────────────────────
export async function createProductFromIdea(
  idea: ProductIdea,
  userId?: string
): Promise<Product> {
  const result = await query<Product>(
    `INSERT INTO products
      (title, product_type, niche, target_customer, problem_solved, status,
       opportunity_score, price, currency, idea_id, created_by, metadata)
     VALUES ($1,$2,$3,$4,$5,'IDEA_DISCOVERED',$6,$7,'USD',$8,$9,'{}')
     RETURNING *`,
    [
      idea.title,
      idea.product_type,
      idea.niche,
      idea.target_customer,
      idea.problem,
      null,
      idea.estimated_price,
      idea.id,
      userId || null,
    ]
  )

  const product = result.rows[0]

  await addTimelineEvent(product.id, 'IDEA_DISCOVERED', `Product idea created: ${idea.title}`)
  await auditLog({
    entity_type: 'product',
    entity_id:   product.id,
    action:      'CREATED',
    changed_by:  userId,
    new_value:   { title: idea.title, type: idea.product_type },
  })

  // Mark idea as in production
  await query(`UPDATE product_ideas SET status = 'IN_PRODUCTION' WHERE id = $1`, [idea.id])

  return product
}

// ── CONTENT TYPES ─────────────────────────────────────────────
export interface SectionContent {
  intro:       string
  key_points:  string[]
  steps:       string[]
  exercise:    string
  takeaway:    string
}

export interface ProductContent {
  outline:      string[]
  sections:     Record<string, SectionContent>
  faq:          Array<{ q: string; a: string }>
  quick_start:  string
  usage_guide:  string
  instructions: string
}

// ── SECTION TEXT PARSER ───────────────────────────────────────
// Parses plain-text labelled blocks into SectionContent.
// Format produced by the section prompt:
//   INTRO: <text>
//   KEY POINTS:
//   - <point>
//   STEPS:
//   1. <step>
//   EXERCISE: <text>
//   TAKEAWAY: <text>
function parseSectionText(raw: string): SectionContent {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)

  let intro      = ''
  const key_points: string[] = []
  const steps:      string[] = []
  let exercise   = ''
  let takeaway   = ''

  type Mode = 'none' | 'intro' | 'key_points' | 'steps' | 'exercise' | 'takeaway'
  let mode: Mode = 'none'

  for (const line of lines) {
    const upper = line.toUpperCase()

    // Mode switches
    if (upper.startsWith('INTRO:'))       { mode = 'intro';      intro    = line.replace(/^intro:\s*/i, ''); continue }
    if (upper.startsWith('KEY POINT'))    { mode = 'key_points'; continue }
    if (upper.startsWith('ACTION STEP') ||
        upper.startsWith('STEPS:'))       { mode = 'steps';      continue }
    if (upper.startsWith('EXERCISE:'))    { mode = 'exercise';   exercise = line.replace(/^exercise:\s*/i, ''); continue }
    if (upper.startsWith('TAKEAWAY:') ||
        upper.startsWith('KEY TAKEAWAY')) { mode = 'takeaway';   takeaway = line.replace(/^(key\s+)?takeaway:\s*/i, ''); continue }

    // Content lines
    if (mode === 'intro')      { intro      += (intro      ? ' ' : '') + line }
    if (mode === 'exercise')   { exercise   += (exercise   ? ' ' : '') + line }
    if (mode === 'takeaway')   { takeaway   += (takeaway   ? ' ' : '') + line }
    if (mode === 'key_points') {
      const clean = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '')
      if (clean) key_points.push(clean)
    }
    if (mode === 'steps') {
      const clean = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '')
      if (clean) steps.push(clean)
    }
  }

  return {
    intro:      intro      || raw.slice(0, 300),   // fallback: first 300 chars if parse fails
    key_points: key_points.length ? key_points : [],
    steps:      steps.length      ? steps      : [],
    exercise:   exercise   || '',
    takeaway:   takeaway   || '',
  }
}

// ── GENERATE PRODUCT CONTENT ──────────────────────────────────
// Two-phase approach to avoid JSON truncation:
//   Phase 1 — JSON call (small): outline + faq + quick_start + usage_guide + instructions
//   Phase 2 — PLAIN TEXT call per section: LLMs never truncate labelled plain text mid-line.
//             Parsed into SectionContent by parseSectionText().
export async function generateProductContent(
  product: Product,
  workflowRunId?: string
): Promise<ProductContent> {
  await updateProductStatus(product.id, 'CREATING')
  await addTimelineEvent(product.id, 'GENERATION_STARTED', 'AI content generation started')

  const meta = {
    product_type:    product.product_type,
    title:           product.title,
    target_customer: product.target_customer,
    problem:         product.problem_solved,
    unique_value:    (product.metadata as Record<string, string>)?.unique_value || '',
    niche:           product.niche,
  }

  // ── Phase 1: Outline + supporting fields (JSON, small) ────────
  const skeletonPrompt = `You are a digital product creator. Plan a ${meta.product_type} titled "${meta.title}" for ${meta.target_customer}.
Problem: ${meta.problem}
Unique value: ${meta.unique_value}
Niche: ${meta.niche}

Respond ONLY with a single valid JSON object:
{
  "outline": ["Section Title 1", "Section Title 2", "Section Title 3", "Section Title 4"],
  "faq": [
    {"q": "Real question a buyer would ask?", "a": "Thorough 2-sentence answer."},
    {"q": "How long does this take to implement?", "a": "Concrete timeframe with honest expectations."},
    {"q": "Can I customize this for my situation?", "a": "Yes, explain how in 1-2 sentences."}
  ],
  "quick_start": "Exactly what to do in the first 5 minutes. Be specific.",
  "usage_guide": "How to get maximum value from this product over time.",
  "instructions": "Step-by-step for a first-time user of the PDF guide only — where to start reading, what order to work through the sections, and what to do when finished. Do NOT reference any external files, spreadsheets, .xlsx, .docx, or zip contents. The only deliverable is this PDF."
}

Use real, specific content for the actual title and niche. No placeholders.`

  const skeletonRes = await callAI(
    { prompt: skeletonPrompt, temperature: 0.7, max_tokens: 1200 },
    { purpose: 'product_skeleton', product_id: product.id, workflow_run_id: workflowRunId }
  )
  const skeleton = extractJSON<Omit<ProductContent, 'sections'>>(skeletonRes.content)
  const outline = (skeleton.outline || []).slice(0, 4)

  // ── Phase 2: Section content as PLAIN TEXT (no JSON = no parse failure) ──
  const sections: Record<string, SectionContent> = {}

  for (const sectionTitle of outline) {
    const sectionPrompt = `Write one section of a ${meta.product_type} called "${meta.title}" for ${meta.target_customer}.

SECTION: ${sectionTitle}
Problem: ${meta.problem}
Niche: ${meta.niche}

Write using EXACTLY this labelled format. Do not use JSON. Do not add extra labels.

INTRO: Write 2 sentences explaining what this section covers and why it matters to the reader.

KEY POINTS:
- One key insight or concept for this section
- A second concrete tip or technique
- A third point — a common mistake to avoid

ACTION STEPS:
1. First specific action the reader takes
2. Second action that builds on step 1
3. How to complete or verify the work

EXERCISE: One hands-on activity the reader does right now. Be specific about what to write or create.

TAKEAWAY: One clear, memorable sentence summarising the most important thing from this section.`

    const sRes = await callAI(
      { prompt: sectionPrompt, temperature: 0.75, max_tokens: 600 },
      { purpose: 'product_section', product_id: product.id, workflow_run_id: workflowRunId }
    )
    sections[sectionTitle] = parseSectionText(sRes.content)
  }

  const content: ProductContent = {
    outline,
    sections,
    faq:          Array.isArray(skeleton.faq)          ? skeleton.faq          : [],
    quick_start:  skeleton.quick_start  || '',
    usage_guide:  skeleton.usage_guide  || '',
    instructions: skeleton.instructions || '',
  }

  // Store version snapshot
  await query(
    `INSERT INTO product_versions (product_id, version, title, content_snapshot, change_reason)
     VALUES ($1, (SELECT COALESCE(MAX(version),0)+1 FROM product_versions WHERE product_id=$1), $2, $3, $4)`,
    [product.id, product.title, JSON.stringify(content), 'AI content generation']
  )

  await updateProductStatus(product.id, 'CONTENT_GENERATED')
  await addTimelineEvent(product.id, 'CONTENT_GENERATED', 'AI content generation completed')

  return content
}

// ── GENERATE MARKETING COPY ───────────────────────────────────
export async function generateMarketingCopy(
  product: Product,
  workflowRunId?: string
): Promise<{
  sales_description: string
  short_description: string
  bullet_points: string[]
  tags: string[]
  keywords: string[]
  subtitle: string
  upsell_ideas: string[]
  cross_sell_ideas: string[]
}> {
  const prompt_data = await loadPrompt('product_marketing_copy')
  const prompt = fillTemplate(prompt_data.template, {
    title:           product.title,
    product_type:    product.product_type,
    target_customer: product.target_customer,
    problem:         product.problem_solved,
    unique_value:    (product.metadata as Record<string, string>)?.unique_value || '',
  })

  const response = await callAI(
    { prompt, temperature: prompt_data.temperature, max_tokens: 1024 },
    { purpose: 'marketing_copy', product_id: product.id, workflow_run_id: workflowRunId }
  )

  const copy = extractJSON<{
    sales_description: string
    short_description: string
    bullet_points: string[]
    tags: string[]
    keywords: string[]
    subtitle: string
    upsell_ideas: string[]
    cross_sell_ideas: string[]
  }>(response.content)

  // Update product with marketing data (merge bullet_points into metadata)
  await query(
    `UPDATE products SET
       description = $1,
       subtitle    = $2,
       tags        = $3,
       keywords    = $4,
       metadata    = metadata || $5,
       updated_at  = NOW()
     WHERE id = $6`,
    [
      copy.sales_description,
      copy.subtitle,
      JSON.stringify(copy.tags || []),
      JSON.stringify(copy.keywords || []),
      JSON.stringify({ bullet_points: copy.bullet_points || [] }),
      product.id,
    ]
  )

  return copy
}

// ── STATUS HELPERS ────────────────────────────────────────────
export async function updateProductStatus(
  productId: string,
  status: Product['status'],
  extra: Record<string, unknown> = {}
) {
  const old = await query<{ status: string }>(
    `SELECT status FROM products WHERE id = $1`,
    [productId]
  )

  await query(
    `UPDATE products SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, productId]
  )

  await auditLog({
    entity_type: 'product',
    entity_id:   productId,
    action:      'STATUS_CHANGED',
    old_value:   { status: old.rows[0]?.status },
    new_value:   { status, ...extra },
  })
}

export async function getProductById(id: string): Promise<Product | null> {
  const result = await query<Product>(`SELECT * FROM products WHERE id = $1`, [id])
  return result.rows[0] || null
}

export async function listProducts(params: {
  status?: string
  niche?: string
  page?: number
  per_page?: number
}): Promise<{ products: Product[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []
  let i = 1

  if (params.status) { conditions.push(`status = $${i++}`); values.push(params.status) }
  if (params.niche)  { conditions.push(`niche = $${i++}`);  values.push(params.niche) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const page     = params.page     || 1
  const per_page = params.per_page || 20
  const offset   = (page - 1) * per_page

  const [dataRes, countRes] = await Promise.all([
    query<Product>(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, per_page, offset]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM products ${where}`,
      values
    ),
  ])

  return {
    products: dataRes.rows,
    total:    parseInt(countRes.rows[0]?.count || '0'),
  }
}
