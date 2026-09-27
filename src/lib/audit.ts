import { query } from '@/lib/db/client'

export async function auditLog(params: {
  entity_type: string
  entity_id: string
  action: string
  changed_by?: string | null
  workflow?: string | null
  ai_model?: string | null
  prompt_version?: string | null
  old_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
}) {
  await query(
    `INSERT INTO audit_logs
      (entity_type, entity_id, action, changed_by, workflow, ai_model, prompt_version, old_value, new_value)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      params.entity_type,
      params.entity_id,
      params.action,
      params.changed_by ?? null,
      params.workflow ?? null,
      params.ai_model ?? null,
      params.prompt_version ?? null,
      params.old_value ? JSON.stringify(params.old_value) : null,
      params.new_value ? JSON.stringify(params.new_value) : null,
    ]
  )
}

export async function addTimelineEvent(
  product_id: string,
  event_type: string,
  description: string,
  metadata: Record<string, unknown> = {}
) {
  await query(
    `INSERT INTO product_timeline_events (product_id, event_type, description, metadata)
     VALUES ($1, $2, $3, $4)`,
    [product_id, event_type, description, JSON.stringify(metadata)]
  )
}
