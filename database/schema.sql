-- ============================================================
-- AI DIGITAL PRODUCT FACTORY — COMPLETE DATABASE SCHEMA
-- PostgreSQL / Supabase-compatible
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SETTINGS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key                   TEXT UNIQUE NOT NULL,
  value                 JSONB NOT NULL,
  description           TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by            UUID REFERENCES users(id)
);

-- ── RESEARCH SOURCES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_sources (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword             TEXT NOT NULL,
  niche               TEXT NOT NULL,
  problem             TEXT NOT NULL,
  target_customer     TEXT NOT NULL,
  source              TEXT NOT NULL,
  source_url          TEXT,
  evidence            TEXT NOT NULL,
  demand_signal       NUMERIC(5,2) NOT NULL DEFAULT 0,
  competition_signal  NUMERIC(5,2) NOT NULL DEFAULT 0,
  date_discovered     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_data            JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_research_niche ON research_sources(niche);
CREATE INDEX IF NOT EXISTS idx_research_date ON research_sources(date_discovered DESC);

-- ── MARKET SIGNALS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_signals (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_source_id  UUID NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
  signal_type         TEXT NOT NULL CHECK (signal_type IN ('TREND','SEARCH','FORUM','MARKETPLACE','SEASONAL')),
  signal_value        TEXT NOT NULL,
  strength            NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── OPPORTUNITY SCORES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunity_scores (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_source_id        UUID NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
  product_idea_id           UUID,
  demand_score              NUMERIC(5,2) NOT NULL DEFAULT 0,
  competition_score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  problem_severity          NUMERIC(5,2) NOT NULL DEFAULT 0,
  buyer_intent              NUMERIC(5,2) NOT NULL DEFAULT 0,
  creation_difficulty       NUMERIC(5,2) NOT NULL DEFAULT 0,
  production_cost           NUMERIC(5,2) NOT NULL DEFAULT 0,
  price_potential           NUMERIC(5,2) NOT NULL DEFAULT 0,
  differentiation_potential NUMERIC(5,2) NOT NULL DEFAULT 0,
  seasonality               NUMERIC(5,2) NOT NULL DEFAULT 0,
  trend_momentum            NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_score               NUMERIC(5,2) NOT NULL DEFAULT 0,
  weights                   JSONB NOT NULL DEFAULT '{}',
  calculated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PRODUCT IDEAS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_ideas (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  research_source_id        UUID NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
  opportunity_score_id      UUID REFERENCES opportunity_scores(id),
  title                     TEXT NOT NULL,
  product_type              TEXT NOT NULL,
  niche                     TEXT NOT NULL,
  problem                   TEXT NOT NULL,
  target_customer           TEXT NOT NULL,
  unique_value              TEXT NOT NULL,
  estimated_price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_creation_time   INTEGER NOT NULL DEFAULT 0,
  difficulty                INTEGER NOT NULL DEFAULT 5 CHECK (difficulty BETWEEN 1 AND 10),
  differentiation_strategy  TEXT NOT NULL DEFAULT '',
  required_assets           JSONB NOT NULL DEFAULT '[]',
  status                    TEXT NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING','APPROVED','REJECTED','IN_PRODUCTION')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PRODUCTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             TEXT NOT NULL,
  subtitle          TEXT,
  description       TEXT,
  product_type      TEXT NOT NULL,
  niche             TEXT NOT NULL,
  target_customer   TEXT NOT NULL,
  problem_solved    TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'IDEA_DISCOVERED',
  opportunity_score NUMERIC(5,2),
  qa_score          NUMERIC(5,2),
  revision_count    INTEGER NOT NULL DEFAULT 0,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  tags              JSONB NOT NULL DEFAULT '[]',
  keywords          JSONB NOT NULL DEFAULT '[]',
  idea_id           UUID REFERENCES product_ideas(id),
  research_id       UUID REFERENCES research_sources(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at       TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES users(id),
  metadata          JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_niche ON products(niche);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);

-- ── PRODUCT VERSIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_versions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL,
  title             TEXT NOT NULL,
  content_snapshot  JSONB NOT NULL DEFAULT '{}',
  changed_by        UUID REFERENCES users(id),
  change_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, version)
);

-- ── PRODUCT FILES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_files (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  file_type   TEXT NOT NULL,
  file_size   BIGINT NOT NULL DEFAULT 0,
  sha256_hash TEXT NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PRODUCT ASSETS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_assets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  asset_type  TEXT NOT NULL CHECK (asset_type IN ('COVER','THUMBNAIL','PREVIEW','BANNER','SOCIAL')),
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  width       INTEGER,
  height      INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PRODUCT GENERATION JOBS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS product_generation_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  job_type        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED')),
  input_data      JSONB NOT NULL DEFAULT '{}',
  output_data     JSONB NOT NULL DEFAULT '{}',
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── QA RESULTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  run_number      INTEGER NOT NULL DEFAULT 1,
  overall_score   NUMERIC(5,2) NOT NULL DEFAULT 0,
  passed          BOOLEAN NOT NULL DEFAULT false,
  checks          JSONB NOT NULL DEFAULT '[]',
  ai_feedback     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── QA ISSUES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_issues (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qa_result_id    UUID NOT NULL REFERENCES qa_results(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  check_type      TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR','CRITICAL')),
  description     TEXT NOT NULL,
  suggestion      TEXT,
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PUBLISHING CHANNELS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS publishing_channels (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  channel_type  TEXT NOT NULL CHECK (channel_type IN ('GUMROAD','PAYHIP','SHOPIFY','ETSY','OWN_STORE','MANUAL')),
  enabled       BOOLEAN NOT NULL DEFAULT false,
  config        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel_type)
);

-- ── PUBLISHED PRODUCTS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS published_products (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id            UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel_id            UUID NOT NULL REFERENCES publishing_channels(id),
  external_product_id   TEXT,
  product_url           TEXT,
  published_at          TIMESTAMPTZ,
  publication_status    TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (publication_status IN ('PENDING','PUBLISHED','FAILED','MANUAL_REQUIRED','UNPUBLISHED')),
  price                 NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'USD',
  last_sync_at          TIMESTAMPTZ,
  sync_status           TEXT NOT NULL DEFAULT 'NEVER'
                          CHECK (sync_status IN ('SYNCED','PENDING','ERROR','NEVER')),
  error_message         TEXT,
  UNIQUE(product_id, channel_id)
);

-- ── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id              UUID NOT NULL REFERENCES products(id),
  channel_id              UUID NOT NULL REFERENCES publishing_channels(id),
  external_order_id       TEXT,
  customer_country        TEXT,
  sale_date               TIMESTAMPTZ NOT NULL,
  quantity                INTEGER NOT NULL DEFAULT 1,
  gross_amount            NUMERIC(12,4) NOT NULL DEFAULT 0,
  discount                NUMERIC(12,4) NOT NULL DEFAULT 0,
  refund_amount           NUMERIC(12,4) NOT NULL DEFAULT 0,
  platform_fee            NUMERIC(12,4) NOT NULL DEFAULT 0,
  payment_processing_fee  NUMERIC(12,4) NOT NULL DEFAULT 0,
  other_fee               NUMERIC(12,4) NOT NULL DEFAULT 0,
  net_revenue             NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency                TEXT NOT NULL DEFAULT 'USD',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_channel ON transactions(channel_id);

-- ── EXPENSES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID REFERENCES products(id),
  category      TEXT NOT NULL CHECK (category IN ('AI_COST','HOSTING','STORAGE','API','MARKETING','OTHER')),
  description   TEXT NOT NULL,
  amount        NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  expense_date  DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── DAILY METRICS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_metrics (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date                  DATE UNIQUE NOT NULL,
  products_created      INTEGER NOT NULL DEFAULT 0,
  products_published    INTEGER NOT NULL DEFAULT 0,
  units_sold            INTEGER NOT NULL DEFAULT 0,
  gross_revenue         NUMERIC(12,4) NOT NULL DEFAULT 0,
  net_revenue           NUMERIC(12,4) NOT NULL DEFAULT 0,
  net_profit            NUMERIC(12,4) NOT NULL DEFAULT 0,
  ai_requests_used      INTEGER NOT NULL DEFAULT 0,
  research_jobs_run     INTEGER NOT NULL DEFAULT 0
);

-- ── MONTHLY METRICS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_metrics (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year                INTEGER NOT NULL,
  month               INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  products_created    INTEGER NOT NULL DEFAULT 0,
  products_published  INTEGER NOT NULL DEFAULT 0,
  units_sold          INTEGER NOT NULL DEFAULT 0,
  gross_revenue       NUMERIC(12,4) NOT NULL DEFAULT 0,
  net_revenue         NUMERIC(12,4) NOT NULL DEFAULT 0,
  net_profit          NUMERIC(12,4) NOT NULL DEFAULT 0,
  profit_margin       NUMERIC(5,2) NOT NULL DEFAULT 0,
  top_product_id      UUID REFERENCES products(id),
  top_channel_id      UUID REFERENCES publishing_channels(id),
  UNIQUE(year, month)
);

-- ── WORKFLOW RUNS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_name     TEXT NOT NULL,
  product_id        UUID REFERENCES products(id),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'RUNNING'
                      CHECK (status IN ('RUNNING','COMPLETED','FAILED','TIMEOUT','CANCELLED')),
  error             TEXT,
  input_reference   TEXT,
  output_reference  TEXT,
  duration_ms       INTEGER,
  retry_count       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_name ON workflow_runs(workflow_name);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at DESC);

-- ── WORKFLOW ERRORS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_errors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_run_id   UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  workflow_name     TEXT NOT NULL,
  error_message     TEXT NOT NULL,
  error_stack       TEXT,
  product_id        UUID REFERENCES products(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved          BOOLEAN NOT NULL DEFAULT false
);

-- ── AUDIT LOGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type     TEXT NOT NULL,
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,
  changed_by      UUID REFERENCES users(id),
  workflow        TEXT,
  ai_model        TEXT,
  prompt_version  TEXT,
  old_value       JSONB,
  new_value       JSONB,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

-- ── PROMPT TEMPLATES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  purpose     TEXT NOT NULL,
  template    TEXT NOT NULL,
  model       TEXT,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.7,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, version)
);

-- ── AI USAGE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  purpose           TEXT NOT NULL,
  product_id        UUID REFERENCES products(id),
  workflow_run_id   UUID REFERENCES workflow_runs(id),
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  estimated_cost    NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(created_at DESC);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event       TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  product_id  UUID REFERENCES products(id),
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_at DESC);

-- ── PRODUCT TIMELINE EVENTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS product_timeline_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_product ON product_timeline_events(product_id, created_at ASC);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
