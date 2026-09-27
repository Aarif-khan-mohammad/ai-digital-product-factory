// ============================================================
// WORKFLOW RUNNER — Orchestrates all automation pipelines
// ============================================================

import { query } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import type { WorkflowName } from '@/types'

export async function startWorkflowRun(
  workflow_name: WorkflowName,
  product_id?: string | null,
  input_reference?: string
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO workflow_runs (workflow_name, product_id, input_reference, status)
     VALUES ($1,$2,$3,'RUNNING') RETURNING id`,
    [workflow_name, product_id || null, input_reference || null]
  )
  logger.info('workflow', `Started: ${workflow_name}`, { run_id: result.rows[0].id, product_id })
  return result.rows[0].id
}

export async function completeWorkflowRun(
  runId: string,
  output_reference?: string
) {
  await query(
    `UPDATE workflow_runs SET
       status           = 'COMPLETED',
       completed_at     = NOW(),
       duration_ms      = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
       output_reference = $2
     WHERE id = $1`,
    [runId, output_reference || null]
  )
  logger.info('workflow', `Completed run`, { run_id: runId })
}

export async function failWorkflowRun(runId: string, error: string) {
  await query(
    `UPDATE workflow_runs SET
       status       = 'FAILED',
       completed_at = NOW(),
       duration_ms  = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
       error        = $2
     WHERE id = $1`,
    [runId, error]
  )

  const run = await query<{ workflow_name: string; product_id: string }>(
    `SELECT workflow_name, product_id FROM workflow_runs WHERE id = $1`, [runId]
  )

  if (run.rows[0]) {
    await query(
      `INSERT INTO workflow_errors (workflow_run_id, workflow_name, error_message, product_id)
       VALUES ($1,$2,$3,$4)`,
      [runId, run.rows[0].workflow_name, error, run.rows[0].product_id || null]
    )
  }

  logger.error('workflow', `Failed run`, { run_id: runId, error })
}

export async function withWorkflow<T>(
  workflow_name: WorkflowName,
  fn: (runId: string) => Promise<T>,
  product_id?: string | null
): Promise<T> {
  const runId = await startWorkflowRun(workflow_name, product_id)
  try {
    const result = await fn(runId)
    await completeWorkflowRun(runId)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await failWorkflowRun(runId, msg)
    throw err
  }
}

export async function getWorkflowRuns(params: {
  workflow_name?: string
  product_id?: string
  status?: string
  limit?: number
}) {
  const conditions: string[] = []
  const values: unknown[] = []
  let i = 1

  if (params.workflow_name) { conditions.push(`workflow_name = $${i++}`); values.push(params.workflow_name) }
  if (params.product_id)   { conditions.push(`product_id = $${i++}`);   values.push(params.product_id) }
  if (params.status)       { conditions.push(`status = $${i++}`);       values.push(params.status) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params.limit || 50

  const result = await query(
    `SELECT * FROM workflow_runs ${where} ORDER BY started_at DESC LIMIT $${i}`,
    [...values, limit]
  )
  return result.rows
}

export async function getWorkflowErrors(resolved = false) {
  const result = await query(
    `SELECT we.*, wr.workflow_name as run_workflow
     FROM workflow_errors we
     JOIN workflow_runs wr ON wr.id = we.workflow_run_id
     WHERE we.resolved = $1
     ORDER BY we.created_at DESC LIMIT 100`,
    [resolved]
  )
  return result.rows
}
