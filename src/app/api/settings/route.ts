import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/client'

export async function GET() {
  try {
    const result = await query(`SELECT key, value, description FROM settings ORDER BY key`)
    const settings: Record<string, unknown> = {}
    for (const row of result.rows as Array<{ key: string; value: string }>) {
      try { settings[row.key] = JSON.parse(row.value) } catch { settings[row.key] = row.value }
    }
    return NextResponse.json({ success: true, data: settings })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>
    for (const [key, value] of Object.entries(body)) {
      await query(
        `INSERT INTO settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
