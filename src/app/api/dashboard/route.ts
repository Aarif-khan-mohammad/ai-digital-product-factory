import { NextResponse } from 'next/server'
import { getFullDashboard } from '@/lib/dashboard/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getFullDashboard()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
