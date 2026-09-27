import { NextResponse } from 'next/server'
import { runMarketResearch } from '@/lib/research/engine'
import { withWorkflow } from '@/lib/workflows/runner'

export async function POST() {
  try {
    const result = await withWorkflow('DAILY_MARKET_RESEARCH', async (runId) => {
      return runMarketResearch(runId)
    })
    return NextResponse.json({ success: true, data: result })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
