'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { clsx } from 'clsx'
import { Spinner } from '@/components/ui'

// ── TYPES ─────────────────────────────────────────────────────
interface JobStep {
  id:           string
  step_index:   number
  step_key:     string
  step_label:   string
  status:       'PENDING' | 'RUNNING' | 'DONE' | 'ERROR' | 'SKIPPED'
  output_data:  Record<string, unknown>
  error:        string | null
  started_at:   string | null
  completed_at: string | null
}

interface Job {
  id:            string
  job_type:      'AUTOPICK' | 'AI_CREATE'
  status:        'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'
  label:         string
  current_step:  number
  total_steps:   number
  product_id:    string | null
  product_title?: string
  error_message: string | null
  created_at:    string
  completed_at:  string | null
  steps?:        JobStep[]
}

// ── HELPERS ───────────────────────────────────────────────────
function elapsedSince(iso: string | null): string {
  if (!iso) return ''
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60)  return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

const JOB_STATUS_STYLE: Record<string, string> = {
  QUEUED:    'bg-slate-700 text-slate-300',
  RUNNING:   'bg-blue-900 text-blue-300',
  PAUSED:    'bg-yellow-900 text-yellow-300',
  COMPLETED: 'bg-emerald-900 text-emerald-300',
  FAILED:    'bg-red-950 text-red-400',
}

const STEP_STATUS_ICON: Record<string, string> = {
  PENDING: '○',
  RUNNING: '◌',
  DONE:    '✓',
  ERROR:   '✗',
  SKIPPED: '–',
}

const STEP_STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-slate-500',
  RUNNING: 'text-blue-400',
  DONE:    'text-emerald-400',
  ERROR:   'text-red-400',
  SKIPPED: 'text-slate-600',
}

// ── JOB CARD ─────────────────────────────────────────────────
function JobCard({
  job,
  isExpanded,
  onToggle,
  onResume,
  onNewAutopick,
  onNewCreate,
}: {
  job: Job
  isExpanded: boolean
  onToggle: () => void
  onResume: (id: string) => void
  onNewAutopick: () => void
  onNewCreate: () => void
}) {
  const progress = job.total_steps > 0
    ? Math.round((job.current_step / job.total_steps) * 100)
    : 0

  const canResume = job.status === 'FAILED' || job.status === 'PAUSED' || job.status === 'QUEUED'

  return (
    <div className={clsx(
      'card border transition-all',
      job.status === 'RUNNING'   && 'border-blue-700/60',
      job.status === 'COMPLETED' && 'border-emerald-700/40',
      job.status === 'FAILED'    && 'border-red-800/60',
      job.status === 'QUEUED'    && 'border-slate-700',
      job.status === 'PAUSED'    && 'border-yellow-700/60',
    )}>

      {/* Header row */}
      <div className="flex items-start gap-3 cursor-pointer" onClick={onToggle}>
        {/* Animated icon */}
        <div className="mt-0.5 flex-shrink-0">
          {job.status === 'RUNNING' ? (
            <Spinner size="sm" />
          ) : job.status === 'COMPLETED' ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          ) : job.status === 'FAILED' ? (
            <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-500" />
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-100 truncate">{job.label}</span>
            <span className={clsx('badge text-xs', JOB_STATUS_STYLE[job.status])}>{job.status}</span>
            <span className="badge bg-slate-800 text-slate-400 text-xs">{job.job_type}</span>
          </div>

          {/* Progress bar */}
          {(job.status === 'RUNNING' || job.status === 'QUEUED') && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-surface-border rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 whitespace-nowrap">{job.current_step}/{job.total_steps}</span>
            </div>
          )}

          {/* Completed — show product link */}
          {job.status === 'COMPLETED' && job.product_id && (
            <div className="mt-1">
              <a
                href={`/dashboard/products/${job.product_id}`}
                className="text-xs text-brand-400 hover:text-brand-300"
                onClick={(e) => e.stopPropagation()}
              >
                View product: {job.product_title || job.product_id} →
              </a>
            </div>
          )}

          {/* Error summary */}
          {job.status === 'FAILED' && job.error_message && (
            <div className="mt-1 text-xs text-red-400 truncate">{job.error_message}</div>
          )}

          {/* Elapsed */}
          <div className="mt-1 text-xs text-slate-600">
            Started {elapsedSince(job.created_at)} ago
            {job.completed_at && ` · Completed ${elapsedSince(job.completed_at)} ago`}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {canResume && (
            <button
              onClick={() => onResume(job.id)}
              className="px-2.5 py-1 text-xs bg-brand-600 hover:bg-brand-500 text-white rounded-md transition-colors"
            >
              {job.status === 'FAILED' ? 'Retry' : 'Resume'}
            </button>
          )}
          <svg
            className={clsx('w-4 h-4 text-slate-500 transition-transform', isExpanded && 'rotate-180')}
            fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Step timeline (expanded) */}
      {isExpanded && job.steps && (
        <div className="mt-4 border-t border-surface-border pt-4">
          <div className="relative pl-5 space-y-0">
            {job.steps.map((step, idx) => (
              <div key={step.id} className="relative">
                {/* Connector line */}
                {idx < job.steps!.length - 1 && (
                  <div className={clsx(
                    'absolute left-0 top-5 w-px h-full -translate-x-0',
                    step.status === 'DONE' ? 'bg-emerald-800' : 'bg-surface-border'
                  )} />
                )}
                <div className="flex items-start gap-3 pb-4">
                  {/* Step icon */}
                  <div className={clsx(
                    'absolute left-0 -translate-x-2 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold z-10',
                    step.status === 'DONE'    && 'bg-emerald-900 text-emerald-400',
                    step.status === 'RUNNING' && 'bg-blue-900 text-blue-300 ring-2 ring-blue-500/50',
                    step.status === 'ERROR'   && 'bg-red-950 text-red-400',
                    step.status === 'PENDING' && 'bg-slate-800 text-slate-600',
                    step.status === 'SKIPPED' && 'bg-slate-800 text-slate-600',
                  )}>
                    {step.status === 'RUNNING'
                      ? <span className="animate-pulse">◌</span>
                      : STEP_STATUS_ICON[step.status]}
                  </div>

                  {/* Step content */}
                  <div className="pl-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx('text-sm font-medium', STEP_STATUS_COLOR[step.status])}>
                        {step.step_label}
                      </span>
                      {step.started_at && step.completed_at && (
                        <span className="text-xs text-slate-600">
                          {Math.round((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 1000)}s
                        </span>
                      )}
                      {step.status === 'RUNNING' && (
                        <span className="text-xs text-blue-400 animate-pulse">running…</span>
                      )}
                    </div>

                    {/* Step output preview */}
                    {step.status === 'DONE' && Object.keys(step.output_data).length > 0 && (
                      <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                        {step.output_data.count !== undefined && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={
                              Number(step.output_data.count) > 0 ? 'text-emerald-400' : 'text-yellow-400'
                            }>
                              {String(step.output_data.count)} signals
                            </span>
                            {step.output_data.sources != null && typeof step.output_data.sources === 'object' && (
                              Object.entries(step.output_data.sources as Record<string, number>).map(([src, n]) => (
                                <span key={src} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                  {src === 'hacker_news' ? '🟠' : src === 'google_news' ? '🔵' : src === 'product_hunt' ? '🟣' : src === 'gumroad' ? '🟡' : '🟢'} {String(n)}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                        {step.output_data.score !== undefined && (
                          <div>Score: <span className="text-emerald-400">{String(step.output_data.score)}/100</span></div>
                        )}
                        {!!step.output_data.topic && (
                          <div>Topic: <span className="text-slate-300">{String(step.output_data.topic)}</span></div>
                        )}
                        {!!step.output_data.title && !step.output_data.product_id && (
                          <div>Concept: <span className="text-slate-300">{String(step.output_data.title)}</span></div>
                        )}
                        {!!step.output_data.product_id && (
                          <div>
                            Product:{' '}
                            <a
                              href={`/dashboard/products/${String(step.output_data.product_id)}`}
                              className="text-brand-400 hover:text-brand-300"
                            >
                              {String(step.output_data.title || step.output_data.product_id)} →
                            </a>
                          </div>
                        )}
                        {step.output_data.qa_score !== undefined && (
                          <div>
                            QA score:{' '}
                            <span className={Boolean(step.output_data.passed) ? 'text-emerald-400' : 'text-yellow-400'}>
                              {String(step.output_data.qa_score)}/100 {step.output_data.passed ? '✅' : '⚠️'}
                            </span>
                          </div>
                        )}
                        {!!step.output_data.subtitle && (
                          <div className="text-slate-400 italic">{String(step.output_data.subtitle)}</div>
                        )}
                      </div>
                    )}

                    {/* Error */}
                    {step.status === 'ERROR' && step.error && (
                      <div className="mt-1 text-xs text-red-400 bg-red-950/30 rounded p-2">{step.error}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── NEW JOB MODAL ─────────────────────────────────────────────
function NewJobModal({ onClose, onCreate }: { onClose: () => void; onCreate: (job: Partial<Job>) => void }) {
  const [mode, setMode] = useState<'AUTOPICK' | 'AI_CREATE'>('AUTOPICK')
  const [topic, setTopic] = useState('')
  const [niche, setNiche] = useState('')
  const [price, setPrice] = useState('37')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (mode === 'AI_CREATE' && (!topic.trim() || !niche.trim())) {
      setError('Topic and niche are required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: mode, topic: topic.trim(), niche: niche.trim(), price: parseFloat(price) }),
      })
      const data = await res.json() as { success: boolean; data?: { job_id: string }; error?: string }
      if (!data.success) throw new Error(data.error)
      onCreate({ id: data.data?.job_id })
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-xl w-full max-w-md p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-white mb-4">Create New Job</h2>

        {/* Mode selector */}
        <div className="flex rounded-lg bg-surface-border overflow-hidden mb-5">
          {(['AUTOPICK', 'AI_CREATE'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                'flex-1 py-2 text-sm font-medium transition-colors',
                mode === m ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {m === 'AUTOPICK' ? '🔍 AI Autopick' : '✏️ Custom Topic'}
            </button>
          ))}
        </div>

        {mode === 'AUTOPICK' ? (
          <p className="text-sm text-slate-400 mb-4">
            AI will scan live Reddit & Google News trends and automatically select the best opportunity, then create and QA the product — entirely in the background.
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Topic / Product Idea</label>
              <input
                className="input w-full"
                placeholder="e.g. Freelancer Invoice System"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Niche</label>
              <input
                className="input w-full"
                placeholder="e.g. freelancing"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Price (USD)</label>
              <input
                className="input w-full"
                type="number" min="1" max="997"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
        )}

        {error && <div className="text-sm text-red-400 mb-3 bg-red-950/30 rounded p-2">{error}</div>}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary text-sm flex items-center gap-1.5">
            {loading && <Spinner size="sm" />}
            {loading ? 'Starting…' : 'Start Job'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function TasksPage() {
  const [jobs, setJobs]           = useState<Job[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [resuming, setResuming]   = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const qs = filterStatus !== 'ALL' ? `?status=${filterStatus}&limit=30` : '?limit=30'
      const res  = await fetch(`/api/jobs${qs}`)
      const data = await res.json() as { success: boolean; data?: { jobs: Job[]; total: number } }
      if (data.success && data.data) {
        setJobs(data.data.jobs)
        setTotal(data.data.total)
      }
    } catch { /* silent */ }
    finally {
      setLoading(false)
    }
  }, [filterStatus])

  // Fetch full details for the expanded job
  const fetchJobDetail = useCallback(async (id: string) => {
    try {
      const res  = await fetch(`/api/jobs/${id}`)
      const data = await res.json() as { success: boolean; data?: Job }
      if (data.success && data.data) {
        setJobs((prev) => prev.map((j) => j.id === id ? { ...j, ...data.data } : j))
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Poll every 3 seconds when there are running jobs or expanded job is active
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === 'RUNNING' || j.status === 'QUEUED')
    if (hasRunning || expandedId) {
      pollRef.current = setInterval(() => {
        fetchJobs()
        if (expandedId) fetchJobDetail(expandedId)
      }, 3000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobs, expandedId, fetchJobs, fetchJobDetail])

  const handleToggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    await fetchJobDetail(id)
  }

  const handleResume = async (jobId: string) => {
    setResuming(jobId)
    try {
      const res  = await fetch(`/api/jobs/${jobId}/resume`, { method: 'POST' })
      const data = await res.json() as { success: boolean; error?: string }
      if (!data.success) throw new Error(data.error)
      await fetchJobs()
      if (expandedId === jobId) await fetchJobDetail(jobId)
    } catch (e) {
      alert(`Resume failed: ${e}`)
    } finally {
      setResuming(null)
    }
  }

  const handleCreated = async (_job: Partial<Job>) => {
    await fetchJobs()
  }

  const activeCount    = jobs.filter((j) => j.status === 'RUNNING' || j.status === 'QUEUED').length
  const failedCount    = jobs.filter((j) => j.status === 'FAILED').length
  const completedCount = jobs.filter((j) => j.status === 'COMPLETED').length

  const FILTERS = ['ALL', 'RUNNING', 'QUEUED', 'COMPLETED', 'FAILED', 'PAUSED']

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Task Progress</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Background jobs run independently — leave the page freely.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              {activeCount} running
            </div>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Job
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-400">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-1">Active</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-emerald-400">{completedCount}</div>
          <div className="text-xs text-slate-500 mt-1">Completed</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-400">{failedCount}</div>
          <div className="text-xs text-slate-500 mt-1">Failed</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={clsx(
              'px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
              filterStatus === f
                ? 'bg-brand-600 text-white'
                : 'bg-surface-border text-slate-400 hover:text-slate-200'
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : jobs.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">⚡</div>
          <div className="text-slate-300 font-medium mb-1">No jobs yet</div>
          <p className="text-slate-500 text-sm mb-4">
            Create a job to start generating products in the background.<br />
            You can leave this page — everything runs server-side.
          </p>
          <button onClick={() => setShowModal(true)} className="btn-primary text-sm mx-auto">
            Create First Job
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={{ ...job, steps: expandedId === job.id ? job.steps : undefined }}
              isExpanded={expandedId === job.id}
              onToggle={() => handleToggleExpand(job.id)}
              onResume={(id) => { if (!resuming) handleResume(id) }}
              onNewAutopick={() => { setShowModal(true) }}
              onNewCreate={() => { setShowModal(true) }}
            />
          ))}
          {total > jobs.length && (
            <p className="text-center text-xs text-slate-600 py-2">
              Showing {jobs.length} of {total} jobs
            </p>
          )}
        </div>
      )}

      {/* New job modal */}
      {showModal && <NewJobModal onClose={() => setShowModal(false)} onCreate={handleCreated} />}
    </div>
  )
}


