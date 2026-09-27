-- Migration 003: Background Job System
-- Run: node scripts/migrate.js

-- ── JOB TYPES & STATUSES ────────────────────────────────────
-- job_type: 'AUTOPICK' | 'AI_CREATE'
-- status:   'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED'

CREATE TABLE IF NOT EXISTS product_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type        TEXT NOT NULL CHECK (job_type IN ('AUTOPICK', 'AI_CREATE')),
  status          TEXT NOT NULL DEFAULT 'QUEUED'
                    CHECK (status IN ('QUEUED','RUNNING','PAUSED','COMPLETED','FAILED')),
  -- Input payload stored so resume knows what to run
  input_data      JSONB NOT NULL DEFAULT '{}',
  -- Which step to resume from (0-based index)
  current_step    INTEGER NOT NULL DEFAULT 0,
  total_steps     INTEGER NOT NULL DEFAULT 7,
  -- Linked product (set once the product record is created in the pipeline)
  product_id      UUID REFERENCES products(id),
  -- Human-readable label
  label           TEXT NOT NULL DEFAULT '',
  -- Error message if failed
  error_message   TEXT,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_jobs_status    ON product_jobs(status);
CREATE INDEX IF NOT EXISTS idx_product_jobs_created   ON product_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_jobs_product   ON product_jobs(product_id);

-- ── JOB STEPS ────────────────────────────────────────────────
-- One row per pipeline step; persisted so resume can skip completed steps

CREATE TABLE IF NOT EXISTS job_steps (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID NOT NULL REFERENCES product_jobs(id) ON DELETE CASCADE,
  step_index  INTEGER NOT NULL,
  step_key    TEXT NOT NULL,   -- e.g. 'trends', 'pick', 'research', ...
  step_label  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING','RUNNING','DONE','ERROR','SKIPPED')),
  output_data JSONB NOT NULL DEFAULT '{}',
  error       TEXT,
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(job_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_job_steps_job_id ON job_steps(job_id);
