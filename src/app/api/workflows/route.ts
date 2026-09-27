import { NextRequest, NextResponse } from 'next/server'
import { getWorkflowRuns, getWorkflowErrors } from '@/lib/workflows/runner'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const runs = await getWorkflowRuns({
      workflow_name: searchParams.get('workflow_name') || undefined,
      product_id:   searchParams.get('product_id')   || undefined,
      status:       searchParams.get('status')       || undefined,
      limit:        parseInt(searchParams.get('limit') || '50'),
    })
    const errors = await getWorkflowErrors(false)
    return NextResponse.json({ success: true, data: { runs, errors } })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
