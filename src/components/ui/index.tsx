'use client'

import { clsx } from 'clsx'
import type { ReactNode } from 'react'

// ── KPI CARD ─────────────────────────────────────────────────
interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: { value: number; label: string }
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
}

export function KPICard({ title, value, subtitle, icon, trend, color = 'blue' }: KPICardProps) {
  const colorMap = {
    blue:   'text-brand-400',
    green:  'text-emerald-400',
    yellow: 'text-yellow-400',
    red:    'text-red-400',
    purple: 'text-purple-400',
  }

  return (
    <div className="card flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</span>
      <div className={clsx('text-2xl font-bold leading-tight', colorMap[color])}>{value}</div>
      {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      {trend && (
        <div className={clsx('text-xs font-medium', trend.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  )
}

// ── STATUS BADGE ──────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  IDEA_DISCOVERED:       'bg-slate-700 text-slate-300',
  RESEARCHING:           'bg-blue-900 text-blue-300',
  OPPORTUNITY_SCORED:    'bg-blue-900 text-blue-300',
  APPROVED_FOR_CREATION: 'bg-indigo-900 text-indigo-300',
  CREATING:              'bg-purple-900 text-purple-300',
  CONTENT_GENERATED:     'bg-purple-900 text-purple-300',
  ASSETS_GENERATED:      'bg-purple-900 text-purple-300',
  QA_IN_PROGRESS:        'bg-yellow-900 text-yellow-300',
  QA_FAILED:             'bg-red-900 text-red-300',
  REVISION_REQUIRED:     'bg-orange-900 text-orange-300',
  READY_TO_PUBLISH:      'bg-teal-900 text-teal-300',
  PUBLISHING:            'bg-cyan-900 text-cyan-300',
  PUBLISHED:             'bg-emerald-900 text-emerald-300',
  SALES_TRACKING:        'bg-emerald-900 text-emerald-300',
  PAUSED:                'bg-slate-700 text-slate-400',
  ARCHIVED:              'bg-slate-800 text-slate-500',
  FAILED:                'bg-red-950 text-red-400',
  RUNNING:               'bg-blue-900 text-blue-300',
  IDLE:                  'bg-slate-700 text-slate-400',
  ERROR:                 'bg-red-900 text-red-300',
}

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || 'bg-slate-700 text-slate-300'
  return (
    <span className={clsx('badge', style)}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── PROGRESS BAR ──────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color = 'blue' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const colorMap: Record<string, string> = {
    blue:   'bg-brand-500',
    green:  'bg-emerald-500',
    yellow: 'bg-yellow-500',
    red:    'bg-red-500',
  }
  return (
    <div className="w-full bg-surface-border rounded-full h-1.5">
      <div
        className={clsx('h-1.5 rounded-full transition-all', colorMap[color] || 'bg-brand-500')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── RESOURCE USAGE BAR ────────────────────────────────────────
export function ResourceBar({ label, used, limit, unit = '' }: { label: string; used: number; limit: number; unit?: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const color = pct > 90 ? 'red' : pct > 70 ? 'yellow' : 'blue'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">{used}{unit} / {limit}{unit} <span className="text-slate-500">({pct}%)</span></span>
      </div>
      <ProgressBar value={pct} color={color} />
    </div>
  )
}

// ── AUTOMATION STATUS DOT ─────────────────────────────────────
export function AutomationDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    RUNNING: 'bg-emerald-400 animate-pulse',
    IDLE:    'bg-slate-500',
    PAUSED:  'bg-yellow-400',
    ERROR:   'bg-red-400',
  }
  return <span className={clsx('inline-block w-2 h-2 rounded-full', map[status] || 'bg-slate-500')} />
}

// ── SCORE RING ────────────────────────────────────────────────
export function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444'
  const r = (size / 2) - 4
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#334155" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        className="rotate-90" fill={color} fontSize="11" fontWeight="600"
        transform={`rotate(90, ${size/2}, ${size/2})`}>
        {score}
      </text>
    </svg>
  )
}

// ── EMPTY STATE ───────────────────────────────────────────────
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-10 h-10 rounded-full bg-surface-border flex items-center justify-center mb-3">
        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
      <div className="text-slate-300 font-medium mb-1">{title}</div>
      {description && <div className="text-slate-500 text-sm mb-4">{description}</div>}
      {action}
    </div>
  )
}

// ── LOADING SPINNER ───────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size]
  return <div className={clsx('border-2 border-brand-500 border-t-transparent rounded-full animate-spin', s)} />
}
