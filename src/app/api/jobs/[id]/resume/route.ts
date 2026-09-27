// POST /api/jobs/[id]/resume
// Resets failed/paused step and re-dispatches from that point.

import { NextRequest, NextResponse } from 'next/server'
import { getJob, resetStepsFrom } from '@/lib/jobs/engine'
import { dispatchJob } from '@/lib/jobs/pipeline'

export const dynamic = 'force-dynamic'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const job = await getJob(params.id)
    if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })

    if (job.status === 'RUNNING') {
      return NextResponse.json({ success: false, error: 'Job is already running' }, { status: 409 })
    }
    if (job.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Job is already completed' }, { status: 409 })
    }

    // Find the first non-DONE step to resume from
    const steps = job.steps || []
    const firstPending = steps.find((s) => s.status !== 'DONE')
    const resumeFrom   = firstPending?.step_index ?? job.current_step

    // Reset that step and everything after it
    await resetStepsFrom(params.id, resumeFrom)

    // Re-dispatch background
    setImmediate(() => {
      dispatchJob(params.id).catch((e) => {
        console.error('[jobs] resume dispatchJob error:', e)
      })
    })

    return NextResponse.json({
      success: true,
      data: { job_id: params.id, resuming_from_step: resumeFrom, message: 'Job queued for resume' },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
