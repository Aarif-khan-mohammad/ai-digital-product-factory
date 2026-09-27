type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  service: string
  workflow?: string
  product_id?: string
  status?: string
  duration?: number
  error?: string
  message: string
  [key: string]: unknown
}

function log(level: LogLevel, service: string, message: string, meta: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...meta,
  }

  const line = JSON.stringify(entry)

  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  debug: (service: string, message: string, meta?: Record<string, unknown>) =>
    log('debug', service, message, meta),
  info: (service: string, message: string, meta?: Record<string, unknown>) =>
    log('info', service, message, meta),
  warn: (service: string, message: string, meta?: Record<string, unknown>) =>
    log('warn', service, message, meta),
  error: (service: string, message: string, meta?: Record<string, unknown>) =>
    log('error', service, message, meta),
}
