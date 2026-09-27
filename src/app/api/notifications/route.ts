import { NextRequest, NextResponse } from 'next/server'
import { getNotifications, markAllRead } from '@/lib/notifications/engine'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get('unread') === 'true'
    const data = await getNotifications(unreadOnly)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function PATCH() {
  try {
    await markAllRead()
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
