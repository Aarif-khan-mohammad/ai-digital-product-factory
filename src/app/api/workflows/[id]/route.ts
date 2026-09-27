import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/client'
import { startWorkflowRun } from '@/lib/workflows/runner'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const run = await query<{ workflow_name: string; product_id: string; retry_count: number }>(
      `SELECT workflow_name, product_id, retry_count FROM workflow_runs WHERE id = $1`,
      [params.id]
    )
    if (!run.rows[0]) {
      return NextResponse.json({ success: false, error: 'Workflow run not found' }, { status: 404 })
    }

    const { workflow_name, product_id, retry_count } = run.rows[0]

    // Create a new run with incremented retry count
    const newRunId = await startWorkflowRun(
      workflow_name as Parameters<typeof startWorkflowRun>[0],
      product_id,
      `retry_of_${params.id}`
    )

    await query(
      `UPDATE workflow_runs SET retry_count = $1 WHERE id = $2`,
      [retry_count + 1, newRunId]
    )

    return NextResponse.json({ success: true, data: { run_id: newRunId } })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
