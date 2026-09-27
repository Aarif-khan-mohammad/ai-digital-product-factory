// ============================================================
// NOTIFICATION ENGINE
// ============================================================

import { query } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import type { NotificationEvent } from '@/types'

export async function createNotification(params: {
  event: NotificationEvent
  title: string
  message: string
  product_id?: string | null
}) {
  await query(
    `INSERT INTO notifications (event, title, message, product_id)
     VALUES ($1,$2,$3,$4)`,
    [params.event, params.title, params.message, params.product_id || null]
  )

  // Email notification (if configured)
  if (process.env.NOTIFICATION_EMAIL_ENABLED === 'true') {
    await sendEmailNotification(params.title, params.message).catch((err) =>
      logger.warn('notifications', 'Email send failed', { error: String(err) })
    )
  }

  // Webhook notification (if configured)
  if (process.env.NOTIFICATION_WEBHOOK_ENABLED === 'true' && process.env.NOTIFICATION_WEBHOOK_URL) {
    await sendWebhookNotification(params).catch((err) =>
      logger.warn('notifications', 'Webhook send failed', { error: String(err) })
    )
  }
}

async function sendEmailNotification(subject: string, body: string) {
  const { createTransport } = await import('nodemailer')
  const transporter = createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  await transporter.sendMail({
    from:    process.env.SMTP_USER,
    to:      process.env.NOTIFICATION_EMAIL_TO,
    subject: `[Product Factory] ${subject}`,
    text:    body,
  })
}

async function sendWebhookNotification(params: {
  event: string; title: string; message: string; product_id?: string | null
}) {
  await fetch(process.env.NOTIFICATION_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, timestamp: new Date().toISOString() }),
    signal: AbortSignal.timeout(10000),
  })
}

export async function getNotifications(unreadOnly = false, limit = 50) {
  const where = unreadOnly ? 'WHERE read = false' : ''
  const result = await query(
    `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $1`,
    [limit]
  )
  return result.rows
}

export async function markNotificationRead(id: string) {
  await query(`UPDATE notifications SET read = true WHERE id = $1`, [id])
}

export async function markAllRead() {
  await query(`UPDATE notifications SET read = true WHERE read = false`)
}
