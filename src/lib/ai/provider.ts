// ============================================================
// AI PROVIDER ADAPTER
// Priority chain: Groq → Gemini → Ollama → Cloudflare → Manual
//
// Free tiers:
//   Groq   — llama-3.1-70b-versatile, 14,400 req/day, 6k tokens/min (FREE)
//   Gemini — gemini-1.5-flash, 1M tokens/day, 15 req/min          (FREE)
//   Ollama — local, unlimited but small model (llama3.2:3B)
//   Cloudflare Workers AI — 10k req/day                            (FREE)
// ============================================================

import { query } from '@/lib/db/client'
import { logger } from '@/lib/logger'

export interface AIRequest {
  prompt: string
  system?: string
  temperature?: number
  max_tokens?: number
  model?: string
}

export interface AIResponse {
  content: string
  provider: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost: number
}

// ── DAILY QUOTA GUARD ────────────────────────────────────────
async function checkQuota(): Promise<void> {
  const max = parseInt(process.env.MAX_DAILY_AI_REQUESTS || '200')
  const today = new Date().toISOString().split('T')[0]
  try {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ai_usage WHERE created_at::date = $1`,
      [today]
    )
    const used = parseInt(result.rows[0]?.count || '0')
    if (used >= max) {
      throw new Error(`FREE_TIER_LIMIT: Daily AI request limit reached (${used}/${max}). Automation paused.`)
    }
  } catch (err) {
    // If quota check fails due to DB issue, log and continue
    if (err instanceof Error && err.message.startsWith('FREE_TIER_LIMIT')) throw err
    logger.warn('ai', 'Quota check failed, proceeding', { error: String(err) })
  }
}

async function recordUsage(params: {
  provider: string
  model: string
  purpose: string
  product_id?: string | null
  workflow_run_id?: string | null
  prompt_tokens: number
  completion_tokens: number
  estimated_cost: number
}) {
  try {
    await query(
      `INSERT INTO ai_usage
        (provider, model, purpose, product_id, workflow_run_id, prompt_tokens, completion_tokens, total_tokens, estimated_cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        params.provider,
        params.model,
        params.purpose,
        params.product_id ?? null,
        params.workflow_run_id ?? null,
        params.prompt_tokens,
        params.completion_tokens,
        params.prompt_tokens + params.completion_tokens,
        params.estimated_cost,
      ]
    )
  } catch (err) {
    // Non-fatal: usage recording failure must never break a generation run
    logger.warn('ai', 'Failed to record usage', { error: String(err) })
  }
}

// ── LEVEL 1: OLLAMA ──────────────────────────────────────────
async function callOllama(req: AIRequest): Promise<AIResponse> {
  const baseUrl = process.env.AI_BASE_URL || 'http://localhost:11434'
  const model   = req.model || process.env.AI_MODEL || 'llama3.2'

  // Allow up to 8192 tokens for rich content generation (llama3.2 supports it)
  const num_predict = Math.min(req.max_tokens ?? 4096, 8192)

  const body = {
    model,
    prompt: req.system ? `${req.system}\n\n${req.prompt}` : req.prompt,
    stream: false,
    options: {
      temperature: req.temperature ?? 0.7,
      num_predict,
      // Keep context window reasonable for speed
      num_ctx: 8192,
    },
  }

  // 8-minute hard ceiling per call — long enough for any generation
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(480_000), // 8 minutes
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as {
    response: string
    prompt_eval_count?: number
    eval_count?: number
  }

  if (!data.response) {
    throw new Error('Ollama returned empty response')
  }

  const prompt_tokens     = data.prompt_eval_count ?? 0
  const completion_tokens = data.eval_count ?? 0

  return {
    content:          data.response,
    provider:         'ollama',
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens:     prompt_tokens + completion_tokens,
    estimated_cost:   0, // local = free
  }
}

// ── LEVEL 1b: OPENAI (GPT-4o-mini) ──────────────────────────
async function callOpenAI(req: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const messages = []
  if (req.system) messages.push({ role: 'system', content: req.system })
  messages.push({ role: 'user', content: req.prompt })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature:  req.temperature ?? 0.7,
      max_tokens:   req.max_tokens  ?? 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    // 429 = rate limit, 402 = no credits — both should fall through to next provider
    throw new Error(`OpenAI error ${res.status}: ${txt.slice(0, 200)}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    usage?: { prompt_tokens: number; completion_tokens: number }
  }
  const content = data.choices?.[0]?.message?.content || ''
  if (!content) throw new Error('OpenAI returned empty response')

  return {
    content,
    provider:          'openai',
    model,
    prompt_tokens:     data.usage?.prompt_tokens     ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    total_tokens:      (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
    estimated_cost:    ((data.usage?.prompt_tokens ?? 0) * 0.00000015) + ((data.usage?.completion_tokens ?? 0) * 0.0000006),
  }
}

// ── LEVEL 2: GROQ (free, llama-3.1-70b) ─────────────────────
async function callGroq(req: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  const model   = process.env.GROQ_MODEL || 'llama-3.1-70b-versatile'
  const messages = []
  if (req.system) messages.push({ role: 'system', content: req.system })
  messages.push({ role: 'user', content: req.prompt })

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature:  req.temperature ?? 0.7,
      max_tokens:   req.max_tokens  ?? 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    // 429 = rate limit — let caller fall through to next provider
    throw new Error(`Groq error ${res.status}: ${txt.slice(0, 200)}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
    usage?: { prompt_tokens: number; completion_tokens: number }
  }
  const content = data.choices?.[0]?.message?.content || ''
  if (!content) throw new Error('Groq returned empty response')

  return {
    content,
    provider:          'groq',
    model,
    prompt_tokens:     data.usage?.prompt_tokens     ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    total_tokens:      (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0),
    estimated_cost:    0,
  }
}

// ── LEVEL 3: GOOGLE GEMINI FLASH (free, 1M tokens/day) ───────
async function callGemini(req: AIRequest): Promise<AIResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const parts = req.system
    ? [{ text: `${req.system}\n\n${req.prompt}` }]
    : [{ text: req.prompt }]

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature:     req.temperature ?? 0.7,
        maxOutputTokens: req.max_tokens  ?? 4096,
      },
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Gemini error ${res.status}: ${txt.slice(0, 200)}`)
  }

  const data = await res.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number }
  }
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!content) throw new Error('Gemini returned empty response')

  return {
    content,
    provider:          'gemini',
    model,
    prompt_tokens:     data.usageMetadata?.promptTokenCount     ?? 0,
    completion_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    total_tokens:      (data.usageMetadata?.promptTokenCount ?? 0) + (data.usageMetadata?.candidatesTokenCount ?? 0),
    estimated_cost:    0,
  }
}

// ── LEVEL 4: CLOUDFLARE WORKERS AI ──────────────────────────
async function callCloudflare(req: AIRequest): Promise<AIResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken  = process.env.CLOUDFLARE_API_TOKEN
  const model     = req.model || process.env.CLOUDFLARE_AI_MODEL || '@cf/meta/llama-3-8b-instruct'

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare credentials not configured')
  }

  const messages = []
  if (req.system) messages.push({ role: 'system', content: req.system })
  messages.push({ role: 'user', content: req.prompt })

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(120_000), // 2 minutes
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Cloudflare AI error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json() as { result?: { response?: string } }
  const content = data.result?.response || ''

  if (!content) {
    throw new Error('Cloudflare AI returned empty response')
  }

  return {
    content,
    provider:          'cloudflare',
    model,
    prompt_tokens:     0,
    completion_tokens: 0,
    total_tokens:      0,
    estimated_cost:    0, // free tier
  }
}

// ── MAIN AI CALL — PRIORITY CHAIN ────────────────────────────
// Order: Groq (free 70B) → Gemini Flash (free 1M/day) → Ollama (local) → Cloudflare
// Set AI_PROVIDER=groq|gemini|ollama|cloudflare to pin a specific provider.
// When set to 'auto' (default), tries each in order until one succeeds.
export async function callAI(
  req: AIRequest,
  meta: { purpose: string; product_id?: string | null; workflow_run_id?: string | null } = { purpose: 'general' }
): Promise<AIResponse> {
  await checkQuota()

  const provider = process.env.AI_PROVIDER || 'auto'

  if (provider === 'manual') {
    throw new Error('MANUAL_MODE: AI provider set to manual. Human input required.')
  }

  // Build the ordered list of providers to try
  type ProviderFn = () => Promise<AIResponse>
  const chain: Array<{ name: string; fn: ProviderFn; available: boolean }> = [
    {
      name:      'openai',
      fn:        () => callOpenAI(req),
      available: provider === 'auto' || provider === 'openai'
        ? !!process.env.OPENAI_API_KEY?.trim()
        : provider === 'openai',
    },
    {
      name:      'groq',
      fn:        () => callGroq(req),
      available: provider === 'auto' || provider === 'groq'
        ? !!process.env.GROQ_API_KEY?.trim()
        : provider === 'groq',
    },
    {
      name:      'gemini',
      fn:        () => callGemini(req),
      available: provider === 'auto' || provider === 'gemini'
        ? !!process.env.GEMINI_API_KEY?.trim()
        : provider === 'gemini',
    },
    {
      name:      'ollama',
      fn:        () => callOllama(req),
      available: provider === 'auto' || provider === 'ollama',
    },
    {
      name:      'cloudflare',
      fn:        () => callCloudflare(req),
      available: (provider === 'auto' || provider === 'cloudflare')
        && !!process.env.CLOUDFLARE_ACCOUNT_ID
        && !!process.env.CLOUDFLARE_API_TOKEN,
    },
  ]

  // In 'auto' mode try all available providers in order.
  // When pinned to a specific provider, only try that one.
  const toTry = provider === 'auto'
    ? chain.filter((p) => p.available)
    : chain.filter((p) => p.name === provider && p.available)

  if (toTry.length === 0) {
    throw new Error(
      `No AI provider available. Set GROQ_API_KEY or GEMINI_API_KEY in .env.local, ` +
      `or make sure Ollama is running (ollama serve).`
    )
  }

  let response: AIResponse | undefined
  const errors: string[] = []

  for (const p of toTry) {
    try {
      logger.info('ai', `Calling ${p.name}`, { purpose: meta.purpose })
      response = await p.fn()
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      logger.warn('ai', `${p.name} failed — trying next`, { error: msg.slice(0, 120), purpose: meta.purpose })
      errors.push(`${p.name}: ${msg.slice(0, 80)}`)
    }
  }

  if (!response) {
    throw new Error(`All AI providers failed:\n${errors.join('\n')}`)
  }

  await recordUsage({
    provider:          response.provider,
    model:             response.model,
    purpose:           meta.purpose,
    product_id:        meta.product_id,
    workflow_run_id:   meta.workflow_run_id,
    prompt_tokens:     response.prompt_tokens,
    completion_tokens: response.completion_tokens,
    estimated_cost:    response.estimated_cost,
  })

  return response
}

// ── JSON EXTRACTION HELPER ────────────────────────────────────

/**
 * Attempt lightweight repairs on LLM-generated JSON that is almost-valid:
 * - Missing opening quote on a key  e.g.  niche":  →  "niche":
 * - Unquoted key entirely             e.g.  niche :  →  "niche":
 * - Trailing commas before } or ]
 * - Single-quoted strings  →  double-quoted
 * - Truncated response (mid-string or mid-structure) — close open tokens
 */
function repairJSON(s: string): string {
  let r = s.trimEnd()

  // 1a. Key missing only its opening quote:  word":  →  "word":
  r = r.replace(/([{,]\s*)([A-Za-z_]\w*)"(\s*:)/g, '$1"$2"$3')

  // 1b. Key missing both quotes entirely:  word :  →  "word":
  r = r.replace(/([{,]\s*)([A-Za-z_]\w*)(\s*:)(?!")/g, '$1"$2"$3')

  // 2. Trailing commas before closing bracket/brace
  r = r.replace(/,(\s*[}\]])/g, '$1')

  // 3. Single-quoted strings → double-quoted (simple cases)
  r = r.replace(/'([^'\\]*)'/g, '"$1"')

  // 4. Walk once: build nesting stack + track the last safe comma at each depth.
  //    "Safe" means: outside a string, so truncating there gives valid JSON up
  //    to that point. We record one position per depth level so we can always
  //    pick the deepest (closest to the cut) when rolling back.
  const stack: Array<'{' | '['> = []
  let inString = false
  let escaped  = false
  const lastSafeCommaByDepth: Record<number, number> = {}

  for (let i = 0; i < r.length; i++) {
    const ch = r[i]
    if (escaped)            { escaped = false; continue }
    if (ch === '\\')        { escaped = true;  continue }
    if (ch === '"')         { inString = !inString; continue }
    if (inString)           { continue }
    if (ch === '{' || ch === '[') { stack.push(ch as '{' | '['); continue }
    if (ch === '}' || ch === ']') { stack.pop(); continue }
    if (ch === ',') {
      lastSafeCommaByDepth[stack.length] = i
    }
  }

  // If truncated mid-string: cut back to the deepest safe comma available,
  // working from the current nesting depth outward so we preserve max data.
  if (inString) {
    let cutAt = -1
    for (let d = stack.length; d >= 1; d--) {
      if (lastSafeCommaByDepth[d] != null) { cutAt = lastSafeCommaByDepth[d]; break }
    }

    if (cutAt > 0) {
      r = r.slice(0, cutAt)
    } else {
      // Nothing recoverable — return an empty structure of the right type
      return stack[0] === '[' ? '[]' : '{}'
    }

    // Rebuild the nesting stack from the truncated string
    stack.length = 0
    inString = false
    escaped  = false
    for (let i = 0; i < r.length; i++) {
      const ch = r[i]
      if (escaped)            { escaped = false; continue }
      if (ch === '\\')        { escaped = true;  continue }
      if (ch === '"')         { inString = !inString; continue }
      if (inString)           { continue }
      if (ch === '{' || ch === '[') { stack.push(ch as '{' | '['); continue }
      if (ch === '}' || ch === ']') { stack.pop(); continue }
    }
  }

  // Close open structures in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    r += stack[i] === '{' ? '}' : ']'
  }

  return r
}

export function extractJSON<T>(text: string): T {
  // Strip leading/trailing whitespace
  const trimmed = text.trim()

  // Try fenced code blocks first
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) {
    try { return JSON.parse(fenced[1]) as T } catch { /* fall through */ }
    try { return JSON.parse(repairJSON(fenced[1])) as T } catch { /* fall through */ }
  }

  // Find the earliest [ and { in the text — prefer whichever comes first.
  // Handles the common LLM pattern of prefixing JSON with prose:
  //   "Here are 5 concepts:\n\n[{...}]"
  const objIdx = trimmed.indexOf('{')
  const arrIdx = trimmed.indexOf('[')

  const preferArr = arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx)

  // Greedy regex captures complete outermost structure (requires closing bracket)
  const arrMatch = trimmed.match(/\[[\s\S]*\]/)
  const objMatch = trimmed.match(/\{[\s\S]*\}/)

  // Truncation fallback: slice from the first bracket/brace to end-of-string.
  // repairJSON will close any unclosed brackets so a partial response can parse.
  const arrTrunc = arrIdx !== -1 ? trimmed.slice(arrIdx) : null
  const objTrunc = objIdx !== -1 ? trimmed.slice(objIdx) : null

  // Build a priority list:
  //  1. complete preferred structure  (raw then repaired)
  //  2. complete other structure      (raw then repaired)
  //  3. truncated preferred structure (repaired only — raw will always fail)
  //  4. truncated other structure     (repaired only)
  //  5. full trimmed text             (last resort)
  const complete: Array<string>  = []
  const truncated: Array<string> = []

  if (preferArr) {
    if (arrMatch)  complete.push(arrMatch[0])
    if (objMatch)  complete.push(objMatch[0])
    if (arrTrunc)  truncated.push(arrTrunc)
    if (objTrunc)  truncated.push(objTrunc)
  } else {
    if (objMatch)  complete.push(objMatch[0])
    if (arrMatch)  complete.push(arrMatch[0])
    if (objTrunc)  truncated.push(objTrunc)
    if (arrTrunc)  truncated.push(arrTrunc)
  }

  for (const c of complete) {
    try { return JSON.parse(c) as T } catch { /* fall through */ }
    try { return JSON.parse(repairJSON(c)) as T } catch { /* fall through */ }
  }
  for (const c of truncated) {
    try { return JSON.parse(repairJSON(c)) as T } catch { /* fall through */ }
  }
  try { return JSON.parse(repairJSON(trimmed)) as T } catch { /* fall through */ }

  throw new Error(`Failed to parse AI JSON response: ${trimmed.slice(0, 300)}`)
}

// ── PROMPT TEMPLATE LOADER ────────────────────────────────────
export async function loadPrompt(name: string): Promise<{
  template: string
  model: string | null
  temperature: number
  version: number
}> {
  const result = await query<{
    template: string
    model: string | null
    temperature: string
    version: number
  }>(
    `SELECT template, model, temperature, version
     FROM prompt_templates
     WHERE name = $1 AND active = true
     ORDER BY version DESC LIMIT 1`,
    [name]
  )

  if (!result.rows[0]) {
    throw new Error(`Prompt template not found: ${name}`)
  }

  return {
    template:    result.rows[0].template,
    model:       result.rows[0].model,
    temperature: parseFloat(result.rows[0].temperature),
    version:     result.rows[0].version,
  }
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [k, v]) => t.replaceAll(`{{${k}}}`, v ?? ''),
    template
  )
}

// ── OLLAMA HEALTH CHECK ───────────────────────────────────────
export async function checkOllamaHealth(): Promise<{ available: boolean; models: string[] }> {
  try {
    const baseUrl = process.env.AI_BASE_URL || 'http://localhost:11434'
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { available: false, models: [] }
    const data = await res.json() as { models?: Array<{ name: string }> }
    return {
      available: true,
      models: (data.models || []).map((m) => m.name),
    }
  } catch {
    return { available: false, models: [] }
  }
}
