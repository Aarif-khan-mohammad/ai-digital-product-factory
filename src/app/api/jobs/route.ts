// POST /api/jobs  — enqueue a new background job
// GET  /api/jobs  — list all jobs with status

import { NextRequest, NextResponse } from 'next/server'
import { enqueueJob, listJobs } from '@/lib/jobs/engine'
import { dispatchJob } from '@/lib/jobs/pipeline'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as Parameters<typeof listJobs>[0]['status']
    const limit  = parseInt(searchParams.get('limit')  || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const result = await listJobs({ status, limit, offset })
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      job_type: 'AUTOPICK' | 'AI_CREATE'
      input?: Record<string, unknown>
      topic?: string
      niche?: string
      price?: number
    }

    if (!body.job_type) {
      return NextResponse.json({ success: false, error: 'job_type required' }, { status: 400 })
    }

    if (body.job_type === 'AI_CREATE' && (!body.topic || !body.niche)) {
      return NextResponse.json({ success: false, error: 'topic and niche required for AI_CREATE' }, { status: 400 })
    }

    const input = body.job_type === 'AI_CREATE'
      ? { topic: body.topic, niche: body.niche, price: body.price || 27 }
      : {}

    const label = body.job_type === 'AUTOPICK'
      ? `AI Autopick — ${new Date().toLocaleTimeString()}`
      : `AI Create: ${body.topic} (${body.niche})`

    const job = await enqueueJob(body.job_type, input, label)

    // Fire and forget — runs entirely in the background.
    // The client can poll GET /api/jobs/[id] for progress.
    setImmediate(() => {
      dispatchJob(job.id).catch((e) => {
        console.error('[jobs] dispatchJob error:', e)
      })
    })

    return NextResponse.json({ success: true, data: { job_id: job.id, status: job.status } }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
