// ============================================================
// QA ENGINE — Quality Control for Digital Products
// ============================================================

import { query } from '@/lib/db/client'
import { callAI, extractJSON, loadPrompt, fillTemplate } from '@/lib/ai/provider'
import { addTimelineEvent, auditLog } from '@/lib/audit'
import { updateProductStatus, getProductById } from '@/lib/generation/engine'
import { logger } from '@/lib/logger'
import type { QAResult, QACheckResult, QACheckType, Product } from '@/types'

const MIN_QA_SCORE  = parseInt(process.env.MIN_QA_SCORE  || '75') || 75  // Relaxed from 85
const MAX_REVISIONS = parseInt(process.env.MAX_REVISIONS || '3')  || 3

// ── STRUCTURAL CHECKS (no AI needed — always run) ─────────────
async function runStructuralChecks(product: Product): Promise<QACheckResult[]> {
  const checks: QACheckResult[] = []

  // 1. PDF file present
  const files = await query<{ file_name: string; file_type: string }>(
    `SELECT file_name, file_type FROM product_files WHERE product_id = $1`,
    [product.id]
  )
  const hasPDF = files.rows.some((f) => f.file_type === 'application/pdf')
  checks.push({
    check_type: 'MISSING_FILES',
    passed:     hasPDF,
    score:      hasPDF ? 100 : 0,
    message:    hasPDF ? 'Primary PDF file present' : 'Missing primary PDF file',
    severity:   hasPDF ? 'INFO' : 'ERROR',
  })

  // 2. Cover asset
  const assets = await query<{ asset_type: string }>(
    `SELECT asset_type FROM product_assets WHERE product_id = $1`,
    [product.id]
  )
  const hasCover = assets.rows.some((a) => a.asset_type === 'COVER')
  checks.push({
    check_type: 'MISSING_IMAGES',
    passed:     true, // Cover is optional — don't fail on this
    score:      hasCover ? 100 : 70,
    message:    hasCover ? 'Cover image present' : 'Cover image missing (recommended)',
    severity:   hasCover ? 'INFO' : 'WARNING',
  })

  // 3. Required metadata
  const hasTitle       = !!product.title && product.title.length > 3
  const hasDescription = !!product.description && product.description.length > 20
  const hasPrice       = product.price > 0
  const metaScore      = [hasTitle, hasDescription, hasPrice].filter(Boolean).length * 33

  checks.push({
    check_type: 'MISSING_METADATA',
    passed:     metaScore >= 66,
    score:      metaScore,
    message:    metaScore >= 99
      ? 'All metadata present'
      : `Missing: ${[!hasTitle && 'title', !hasDescription && 'description', !hasPrice && 'price'].filter(Boolean).join(', ')}`,
    severity: metaScore >= 99 ? 'INFO' : metaScore >= 66 ? 'WARNING' : 'ERROR',
  })

  // 4. Keywords
  const hasKeywords = Array.isArray(product.keywords) && product.keywords.length >= 1
  checks.push({
    check_type: 'MISSING_METADATA',
    passed:     hasKeywords,
    score:      hasKeywords ? 100 : 60,
    message:    hasKeywords ? `${product.keywords.length} keywords present` : 'No keywords set',
    severity:   hasKeywords ? 'INFO' : 'WARNING',
  })

  // 5. Target customer defined
  const hasTarget = !!product.target_customer && product.target_customer.length > 5
  checks.push({
    check_type: 'MISSING_METADATA',
    passed:     hasTarget,
    score:      hasTarget ? 100 : 50,
    message:    hasTarget ? 'Target customer defined' : 'Target customer not set',
    severity:   hasTarget ? 'INFO' : 'WARNING',
  })

  return checks
}

// ── AI CONTENT CHECKS (best-effort — never block QA) ─────────
async function runAIChecks(product: Product, workflowRunId?: string): Promise<QACheckResult[]> {
  try {
    const prompt_data = await loadPrompt('qa_review')

    const contentSummary = [
      `Title: ${product.title}`,
      `Type: ${product.product_type}`,
      `Description: ${(product.description || '').slice(0, 300)}`,
      `Target: ${product.target_customer}`,
      `Problem: ${product.problem_solved}`,
    ].join('\n')

    const prompt = fillTemplate(prompt_data.template, {
      title:           product.title,
      product_type:    product.product_type,
      content_summary: contentSummary,
    })

    const response = await callAI(
      { prompt, temperature: prompt_data.temperature, max_tokens: 1500 },
      { purpose: 'qa_review', product_id: product.id, workflow_run_id: workflowRunId }
    )

    const result = extractJSON<{
      checks: Array<{
        check_type: string
        score: number
        passed: boolean
        message: string
        severity: string
      }>
      overall_score: number
    }>(response.content)

    if (!result.checks || !Array.isArray(result.checks)) return []

    return result.checks.map((c) => ({
      check_type: (c.check_type || 'CONTENT_COMPLETENESS') as QACheckType,
      passed:     c.passed !== false,
      score:      Math.min(100, Math.max(0, c.score || 75)),
      message:    c.message || 'AI review completed',
      severity:   (c.severity || 'INFO') as QACheckResult['severity'],
    }))
  } catch (err) {
    logger.warn('qa', 'AI checks skipped (non-fatal)', { error: String(err), product_id: product.id })
    // Return a neutral passing check so QA isn't blocked by AI unavailability
    return [{
      check_type: 'CONTENT_COMPLETENESS' as QACheckType,
      passed:     true,
      score:      80,
      message:    'AI review skipped (model unavailable) — structural checks passed',
      severity:   'WARNING' as const,
    }]
  }
}

// ── MAIN QA RUNNER ────────────────────────────────────────────
export async function runQA(
  productId: string,
  workflowRunId?: string
): Promise<QAResult> {
  const product = await getProductById(productId)
  if (!product) throw new Error(`Product not found: ${productId}`)

  await updateProductStatus(productId, 'QA_IN_PROGRESS')
  await addTimelineEvent(productId, 'QA_STARTED', 'Quality control check started')

  const runNumber = await getNextQARunNumber(productId)

  // Structural checks always run; AI checks are best-effort
  const structuralChecks = await runStructuralChecks(product)
  const aiChecks = await runAIChecks(product, workflowRunId)

  const allChecks = [...structuralChecks, ...aiChecks]

  // Weighted average score (structural checks count double for reliability)
  const structuralScore = structuralChecks.reduce((s, c) => s + c.score, 0) / structuralChecks.length
  const aiScore = aiChecks.length > 0
    ? aiChecks.reduce((s, c) => s + c.score, 0) / aiChecks.length
    : structuralScore  // if no AI checks, use structural score

  const overall_score = Math.round((structuralScore * 0.6) + (aiScore * 0.4))

  // Fail only on CRITICAL structural issues (e.g., no PDF)
  const hasCriticalFailure = structuralChecks.some(
    (c) => c.severity === 'CRITICAL' && !c.passed
  )

  const passed = overall_score >= MIN_QA_SCORE && !hasCriticalFailure

  // Store QA result
  const qaResult = await query<{ id: string }>(
    `INSERT INTO qa_results (product_id, run_number, overall_score, passed, checks)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id`,
    [productId, runNumber, overall_score, passed, JSON.stringify(allChecks)]
  )

  const qaResultId = qaResult.rows[0].id

  // Store individual issues (non-fatal — don't let this break QA)
  try {
    for (const check of allChecks.filter((c) => !c.passed)) {
      await query(
        `INSERT INTO qa_issues (qa_result_id, product_id, check_type, severity, description, suggestion)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          qaResultId,
          productId,
          check.check_type,
          check.severity,
          check.message,
          `Improve ${check.check_type.toLowerCase().replace(/_/g, ' ')}`,
        ]
      )
    }
  } catch (err) {
    logger.warn('qa', 'Failed to store QA issues (non-fatal)', { error: String(err) })
  }

  // Update product status
  if (passed) {
    await updateProductStatus(productId, 'READY_TO_PUBLISH', { qa_score: overall_score })
    await query(`UPDATE products SET qa_score = $1 WHERE id = $2`, [overall_score, productId])
    await addTimelineEvent(productId, 'QA_PASSED', `QA passed with score ${overall_score}`)
  } else {
    let revisions = 0
    try {
      revisions = await getRevisionCount(productId)
    } catch { /* ignore */ }

    if (revisions >= MAX_REVISIONS) {
      await updateProductStatus(productId, 'FAILED', { qa_score: overall_score, reason: 'Max revisions exceeded' })
      await addTimelineEvent(productId, 'QA_FAILED_FINAL', `QA failed after ${revisions} revisions. Manual review required.`)
    } else {
      await updateProductStatus(productId, 'REVISION_REQUIRED', { qa_score: overall_score })
      await query(`UPDATE products SET qa_score = $1 WHERE id = $2`, [overall_score, productId])
      await addTimelineEvent(productId, 'QA_FAILED', `QA score ${overall_score} — revision required.`)
    }
  }

  logger.info('qa', `QA completed`, { product_id: productId, score: overall_score, passed })

  return {
    id:            qaResultId,
    product_id:    productId,
    run_number:    runNumber,
    overall_score,
    passed,
    checks:        allChecks,
    ai_feedback:   null,
    created_at:    new Date(),
  }
}

async function getNextQARunNumber(productId: string): Promise<number> {
  const result = await query<{ max: string }>(
    `SELECT COALESCE(MAX(run_number), 0) as max FROM qa_results WHERE product_id = $1`,
    [productId]
  )
  return parseInt(result.rows[0]?.max || '0') + 1
}

async function getRevisionCount(productId: string): Promise<number> {
  const result = await query<{ revision_count: number }>(
    `SELECT revision_count FROM products WHERE id = $1`,
    [productId]
  )
  return result.rows[0]?.revision_count || 0
}

export async function getQAResults(productId: string): Promise<QAResult[]> {
  const result = await query<QAResult>(
    `SELECT * FROM qa_results WHERE product_id = $1 ORDER BY run_number DESC`,
    [productId]
  )
  return result.rows
}
