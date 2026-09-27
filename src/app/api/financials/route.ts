import { NextRequest, NextResponse } from 'next/server'
import { getFinancialSummary, getProductPerformance, getChannelPerformance, getDailyRevenue } from '@/lib/financials/engine'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = parseInt(searchParams.get('days') || '30')

    const [summary, products, channels, daily] = await Promise.all([
      getFinancialSummary({}),
      getProductPerformance(20),
      getChannelPerformance(),
      getDailyRevenue(days),
    ])

    return NextResponse.json({ success: true, data: { summary, products, channels, daily } })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
