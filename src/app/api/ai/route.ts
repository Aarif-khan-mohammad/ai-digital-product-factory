import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/client'
import { checkOllamaHealth } from '@/lib/ai/provider'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const [usage, health, daily] = await Promise.all([
      query(
        `SELECT provider, model, purpose, prompt_tokens, completion_tokens,
                total_tokens, estimated_cost, created_at
         FROM ai_usage ORDER BY created_at DESC LIMIT $1`,
        [limit]
      ),
      checkOllamaHealth(),
      query<{ date: string; requests: string; tokens: string; cost: string }>(
        `SELECT created_at::date as date,
                COUNT(*) as requests,
                SUM(total_tokens) as tokens,
                SUM(estimated_cost) as cost
         FROM ai_usage
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY created_at::date ORDER BY date DESC`
      ),
    ])

    return NextResponse.json({
      success: true,
      data: {
        recent:  usage.rows,
        daily:   daily.rows,
        ollama:  health,
      },
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
