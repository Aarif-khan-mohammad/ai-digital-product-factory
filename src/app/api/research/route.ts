import { NextResponse } from 'next/server'
import { getRecentResearch } from '@/lib/research/engine'

export async function GET() {
  try {
    const sources = await getRecentResearch(50)
    return NextResponse.json({ success: true, data: sources })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
