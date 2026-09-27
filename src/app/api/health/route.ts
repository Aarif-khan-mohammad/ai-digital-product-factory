import { NextResponse } from 'next/server'
import { healthCheck } from '@/lib/db/client'
import { checkOllamaHealth } from '@/lib/ai/provider'

export async function GET() {
  const [db, ollama] = await Promise.all([healthCheck(), checkOllamaHealth()])
  const status = db ? 'healthy' : 'degraded'
  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: db ? 'up' : 'down',
      ollama:   ollama.available ? 'up' : 'down',
      ollama_models: ollama.models,
    },
  }, { status: db ? 200 : 503 })
}
