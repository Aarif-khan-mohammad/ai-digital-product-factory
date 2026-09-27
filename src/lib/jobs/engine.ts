// ============================================================
// BACKGROUND JOB ENGINE
// Enqueues jobs, runs them step-by-step, persists progress
// so any step can be resumed after a crash or network drop.
// ============================================================

import { query } from '@/lib/db/client'
import { logger } from '@/lib/logger'

// ── TYPES ─────────────────────────────────────────────────────
export type JobType   = 'AUTOPICK' | 'AI_CREATE'
export type JobStatus = 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'
export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR' | 'SKIPPED'

export interface JobStep {
  id:           string
  job_id:       string
  step_index:   number
  step_key:     string
  step_label:   string
  status:       StepStatus
  output_data:  Record<string, unknown>
  error:        string | null
  started_at:   Date | null
  completed_at: Date | null
}

export interface ProductJob {
  id:            string
  job_type:      JobType
  status:        JobStatus
  input_data:    Record<string, unknown>
  current_step:  number
  total_steps:   number
  product_id:    string | null
  label:         string
  error_message: string | null
  created_at:    Date
  started_at:    Date | null
  completed_at:  Date | null
  updated_at:    Date
  steps?:        JobStep[]
}

// ── STEP DEFINITIONS ──────────────────────────────────────────
export const AUTOPICK_STEPS = [
  { key: 'trends',   label: 'Scan live trends' },
  { key: 'pick',     label: 'AI picks opportunity' },
  { key: 'research', label: 'Market research' },
  { key: 'score',    label: 'Score opportunity' },
  { key: 'idea',     label: 'Generate product ideas' },
  { key: 'create',   label: 'Create product record' },
  { key: 'generate', label: 'Generate content & files' },
  { key: 'qa',       label: 'Quality check' },
]

export const AI_CREATE_STEPS = [
  { key: 'research', label: 'Market research' },
  { key: 'score',    label: 'Score opportunity' },
  { key: 'idea',     label: 'Generate product ideas' },
  { key: 'create',   label: 'Create product record' },
  { key: 'generate', label: 'Generate content & files' },
  { key: 'qa',       label: 'Quality check' },
]

// ── ENQUEUE ───────────────────────────────────────────────────
export async function enqueueJob(
  job_type: JobType,
  input_data: Record<string, unknown>,
  label: string
): Promise<ProductJob> {
  const steps = job_type === 'AUTOPICK' ? AUTOPICK_STEPS : AI_CREATE_STEPS

  const result = await query<ProductJob>(
    `INSERT INTO product_jobs (job_type, input_data, label, total_steps, status)
     VALUES ($1, $2, $3, $4, 'QUEUED')
     RETURNING *`,
    [job_type, JSON.stringify(input_data), label, steps.length]
  )
  const job = result.rows[0]

  // Pre-create all step rows as PENDING
  for (let i = 0; i < steps.length; i++) {
    await query(
      `INSERT INTO job_steps (job_id, step_index, step_key, step_label, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [job.id, i, steps[i].key, steps[i].label]
    )
  }

  logger.info('jobs', `Enqueued job`, { job_id: job.id, type: job_type, label })
  return job
}

// ── STEP HELPERS ──────────────────────────────────────────────
export async function markStepRunning(jobId: string, stepIndex: number) {
  await query(
    `UPDATE job_steps SET status = 'RUNNING', started_at = NOW()
     WHERE job_id = $1 AND step_index = $2`,
    [jobId, stepIndex]
  )
  await query(
    `UPDATE product_jobs SET current_step = $1, status = 'RUNNING', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
     WHERE id = $2`,
    [stepIndex, jobId]
  )
}

export async function markStepDone(
  jobId: string,
  stepIndex: number,
  output: Record<string, unknown> = {}
) {
  await query(
    `UPDATE job_steps SET status = 'DONE', completed_at = NOW(), output_data = $1
     WHERE job_id = $2 AND step_index = $3`,
    [JSON.stringify(output), jobId, stepIndex]
  )
  await query(
    `UPDATE product_jobs SET current_step = $1, updated_at = NOW() WHERE id = $2`,
    [stepIndex + 1, jobId]
  )
}

export async function markStepError(jobId: string, stepIndex: number, error: string) {
  await query(
    `UPDATE job_steps SET status = 'ERROR', error = $1, completed_at = NOW()
     WHERE job_id = $2 AND step_index = $3`,
    [error, jobId, stepIndex]
  )
}

export async function markJobCompleted(jobId: string) {
  await query(
    `UPDATE product_jobs SET status = 'COMPLETED', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [jobId]
  )
  logger.info('jobs', `Job completed`, { job_id: jobId })
}

export async function markJobFailed(jobId: string, error: string) {
  await query(
    `UPDATE product_jobs SET status = 'FAILED', error_message = $1, updated_at = NOW()
     WHERE id = $2`,
    [error, jobId]
  )
  logger.error('jobs', `Job failed`, { job_id: jobId, error })
}

export async function markJobPaused(jobId: string) {
  await query(
    `UPDATE product_jobs SET status = 'PAUSED', updated_at = NOW() WHERE id = $1`,
    [jobId]
  )
}

export async function setJobProductId(jobId: string, productId: string) {
  await query(
    `UPDATE product_jobs SET product_id = $1, updated_at = NOW() WHERE id = $2`,
    [productId, jobId]
  )
}

// ── RESET STEP FOR RESUME ─────────────────────────────────────
// When resuming, reset any ERROR or RUNNING steps back to PENDING
export async function resetStepsFrom(jobId: string, fromStepIndex: number) {
  await query(
    `UPDATE job_steps SET status = 'PENDING', error = NULL, started_at = NULL, completed_at = NULL, output_data = '{}'
     WHERE job_id = $1 AND step_index >= $2 AND status IN ('ERROR', 'RUNNING', 'PENDING')`,
    [jobId, fromStepIndex]
  )
  await query(
    `UPDATE product_jobs SET status = 'QUEUED', current_step = $1, error_message = NULL, updated_at = NOW()
     WHERE id = $2`,
    [fromStepIndex, jobId]
  )
}

// ── GETTERS ───────────────────────────────────────────────────
export async function getJob(jobId: string): Promise<ProductJob | null> {
  const jobRes = await query<ProductJob>(
    `SELECT * FROM product_jobs WHERE id = $1`, [jobId]
  )
  if (!jobRes.rows[0]) return null

  const stepsRes = await query<JobStep>(
    `SELECT * FROM job_steps WHERE job_id = $1 ORDER BY step_index ASC`, [jobId]
  )

  return { ...jobRes.rows[0], steps: stepsRes.rows }
}

export async function listJobs(params: {
  status?: JobStatus | null
  limit?: number
  offset?: number
}): Promise<{ jobs: ProductJob[]; total: number }> {
  const conditions: string[] = []
  const values: unknown[] = []
  let i = 1

  if (params.status) {
    conditions.push(`status = $${i++}`)
    values.push(params.status)
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit  = params.limit  ?? 20
  const offset = params.offset ?? 0

  const [dataRes, countRes] = await Promise.all([
    query<ProductJob>(
      `SELECT pj.*, p.title as product_title
       FROM product_jobs pj
       LEFT JOIN products p ON p.id = pj.product_id
       ${where}
       ORDER BY pj.created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM product_jobs ${where}`, values
    ),
  ])

  return {
    jobs:  dataRes.rows,
    total: parseInt(countRes.rows[0]?.count || '0'),
  }
}

export async function getStepOutput(
  jobId: string,
  stepKey: string
): Promise<Record<string, unknown>> {
  const res = await query<{ output_data: Record<string, unknown> }>(
    `SELECT output_data FROM job_steps WHERE job_id = $1 AND step_key = $2 AND status = 'DONE'`,
    [jobId, stepKey]
  )
  return (res.rows[0]?.output_data as Record<string, unknown>) || {}
}
