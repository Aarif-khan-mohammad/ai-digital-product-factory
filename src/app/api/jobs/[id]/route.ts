// GET /api/jobs/[id] — full job status including all steps

import { NextRequest, NextResponse } from 'next/server'
import { getJob } from '@/lib/jobs/engine'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const job = await getJob(params.id)
    if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: job })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
