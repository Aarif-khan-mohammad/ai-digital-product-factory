// ============================================================
// CORE TYPES — AI Digital Product Factory
// ============================================================

// ── PRODUCT LIFECYCLE ────────────────────────────────────────
export type ProductStatus =
  | 'IDEA_DISCOVERED'
  | 'RESEARCHING'
  | 'OPPORTUNITY_SCORED'
  | 'APPROVED_FOR_CREATION'
  | 'CREATING'
  | 'CONTENT_GENERATED'
  | 'ASSETS_GENERATED'
  | 'QA_IN_PROGRESS'
  | 'QA_FAILED'
  | 'REVISION_REQUIRED'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'SALES_TRACKING'
  | 'PAUSED'
  | 'ARCHIVED'
  | 'FAILED'

export type ProductType =
  | 'PDF_GUIDE'
  | 'EBOOK'
  | 'CHECKLIST'
  | 'WORKBOOK'
  | 'TEMPLATE'
  | 'NOTION_TEMPLATE'
  | 'SPREADSHEET_TEMPLATE'
  | 'EXCEL_TEMPLATE'
  | 'GOOGLE_SHEETS_TEMPLATE'
  | 'PROMPT_PACK'
  | 'SWIPE_FILE'
  | 'BUSINESS_PLANNER'
  | 'FINANCIAL_TRACKER'
  | 'CONTENT_CALENDAR'
  | 'SOCIAL_MEDIA_TEMPLATE'
  | 'RESUME_TEMPLATE'
  | 'JOB_SEARCH_KIT'
  | 'STUDY_PLANNER'
  | 'PRINTABLE_PLANNER'
  | 'DIGITAL_PLANNER'
  | 'EDUCATIONAL_WORKSHEET'
  | 'MINI_COURSE'
  | 'RESOURCE_LIBRARY'

// ── PRODUCT ──────────────────────────────────────────────────
export interface Product {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  product_type: ProductType
  niche: string
  target_customer: string
  problem_solved: string
  status: ProductStatus
  opportunity_score: number | null
  qa_score: number | null
  revision_count: number
  price: number
  currency: string
  tags: string[]
  keywords: string[]
  created_at: Date
  updated_at: Date
  approved_at: Date | null
  published_at: Date | null
  created_by: string | null
  metadata: Record<string, unknown>
}

export interface ProductVersion {
  id: string
  product_id: string
  version: number
  title: string
  content_snapshot: Record<string, unknown>
  changed_by: string | null
  change_reason: string | null
  created_at: Date
}

export interface ProductFile {
  id: string
  product_id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  sha256_hash: string
  is_primary: boolean
  created_at: Date
}

export interface ProductAsset {
  id: string
  product_id: string
  asset_type: 'COVER' | 'THUMBNAIL' | 'PREVIEW' | 'BANNER' | 'SOCIAL'
  file_name: string
  file_path: string
  width: number | null
  height: number | null
  created_at: Date
}

// ── RESEARCH ─────────────────────────────────────────────────
export interface ResearchSource {
  id: string
  keyword: string
  niche: string
  problem: string
  target_customer: string
  source: string
  source_url: string | null
  evidence: string
  demand_signal: number
  competition_signal: number
  date_discovered: Date
  raw_data: Record<string, unknown>
}

export interface MarketSignal {
  id: string
  research_source_id: string
  signal_type: 'TREND' | 'SEARCH' | 'FORUM' | 'MARKETPLACE' | 'SEASONAL'
  signal_value: string
  strength: number
  created_at: Date
}

// ── OPPORTUNITY SCORING ──────────────────────────────────────
export interface OpportunityScore {
  id: string
  research_source_id: string
  product_idea_id: string | null
  demand_score: number
  competition_score: number
  problem_severity: number
  buyer_intent: number
  creation_difficulty: number
  production_cost: number
  price_potential: number
  differentiation_potential: number
  seasonality: number
  trend_momentum: number
  total_score: number
  weights: ScoringWeights
  calculated_at: Date
}

export interface ScoringWeights {
  demand: number
  buyer_intent: number
  problem_severity: number
  differentiation: number
  price_potential: number
  trend_momentum: number
  competition_opportunity: number
}

// ── PRODUCT IDEAS ─────────────────────────────────────────────
export interface ProductIdea {
  id: string
  research_source_id: string
  opportunity_score_id: string | null
  title: string
  product_type: ProductType
  niche: string
  problem: string
  target_customer: string
  unique_value: string
  estimated_price: number
  estimated_creation_time: number
  difficulty: number
  differentiation_strategy: string
  required_assets: string[]
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_PRODUCTION'
  created_at: Date
}

// ── QA ───────────────────────────────────────────────────────
export type QACheckType =
  | 'CONTENT_COMPLETENESS'
  | 'READABILITY'
  | 'GRAMMAR'
  | 'STRUCTURE'
  | 'DUPLICATE_CONTENT'
  | 'BROKEN_LINKS'
  | 'MISSING_FILES'
  | 'MISSING_IMAGES'
  | 'MISSING_METADATA'
  | 'INSTRUCTION_CLARITY'
  | 'FILE_OPENABILITY'
  | 'FORMAT_VALIDITY'
  | 'COPYRIGHT_RISK'
  | 'TRADEMARK_RISK'
  | 'MISLEADING_CLAIMS'
  | 'SAFETY_RISK'

export interface QAResult {
  id: string
  product_id: string
  run_number: number
  overall_score: number
  passed: boolean
  checks: QACheckResult[]
  ai_feedback: string | null
  created_at: Date
}

export interface QACheckResult {
  check_type: QACheckType
  passed: boolean
  score: number
  message: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
}

export interface QAIssue {
  id: string
  qa_result_id: string
  product_id: string
  check_type: QACheckType
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
  description: string
  suggestion: string | null
  resolved: boolean
  resolved_at: Date | null
}

// ── PUBLISHING ───────────────────────────────────────────────
export type ChannelType = 'GUMROAD' | 'PAYHIP' | 'SHOPIFY' | 'ETSY' | 'OWN_STORE' | 'MANUAL'

export interface PublishingChannel {
  id: string
  name: string
  channel_type: ChannelType
  enabled: boolean
  config: Record<string, unknown>
  created_at: Date
}

export interface PublishedProduct {
  id: string
  product_id: string
  channel_id: string
  external_product_id: string | null
  product_url: string | null
  published_at: Date | null
  publication_status: 'PENDING' | 'PUBLISHED' | 'FAILED' | 'MANUAL_REQUIRED' | 'UNPUBLISHED'
  price: number
  currency: string
  last_sync_at: Date | null
  sync_status: 'SYNCED' | 'PENDING' | 'ERROR' | 'NEVER'
  error_message: string | null
}

// ── TRANSACTIONS ─────────────────────────────────────────────
export interface Transaction {
  id: string
  product_id: string
  channel_id: string
  external_order_id: string | null
  customer_country: string | null
  sale_date: Date
  quantity: number
  gross_amount: number
  discount: number
  refund_amount: number
  platform_fee: number
  payment_processing_fee: number
  other_fee: number
  net_revenue: number
  currency: string
  created_at: Date
}

// ── FINANCIALS ───────────────────────────────────────────────
export interface Expense {
  id: string
  product_id: string | null
  category: 'AI_COST' | 'HOSTING' | 'STORAGE' | 'API' | 'MARKETING' | 'OTHER'
  description: string
  amount: number
  currency: string
  expense_date: Date
  created_at: Date
}

export interface FinancialSummary {
  gross_revenue: number
  total_discounts: number
  total_refunds: number
  total_platform_fees: number
  total_payment_fees: number
  net_revenue: number
  total_expenses: number
  net_profit: number
  profit_margin: number
  units_sold: number
  average_order_value: number
  refund_rate: number
}

export interface DailyMetric {
  id: string
  date: Date
  products_created: number
  products_published: number
  units_sold: number
  gross_revenue: number
  net_revenue: number
  net_profit: number
  ai_requests_used: number
  research_jobs_run: number
}

export interface MonthlyMetric {
  id: string
  year: number
  month: number
  products_created: number
  products_published: number
  units_sold: number
  gross_revenue: number
  net_revenue: number
  net_profit: number
  profit_margin: number
  top_product_id: string | null
  top_channel_id: string | null
}

// ── WORKFLOWS ────────────────────────────────────────────────
export type WorkflowName =
  | 'DAILY_MARKET_RESEARCH'
  | 'OPPORTUNITY_SCORING'
  | 'PRODUCT_IDEA_SELECTION'
  | 'PRODUCT_CREATION'
  | 'ASSET_CREATION'
  | 'PRODUCT_QA'
  | 'REVISION_LOOP'
  | 'HUMAN_APPROVAL'
  | 'MARKETPLACE_PUBLISHING'
  | 'SALES_SYNCHRONIZATION'
  | 'FINANCIAL_CALCULATION'
  | 'DAILY_DASHBOARD_AGGREGATION'
  | 'WEEKLY_PERFORMANCE_ANALYSIS'
  | 'PRODUCT_OPTIMIZATION'
  | 'FAILURE_MONITORING'

export interface WorkflowRun {
  id: string
  workflow_name: WorkflowName
  product_id: string | null
  started_at: Date
  completed_at: Date | null
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT' | 'CANCELLED'
  error: string | null
  input_reference: string | null
  output_reference: string | null
  duration_ms: number | null
  retry_count: number
}

export interface WorkflowError {
  id: string
  workflow_run_id: string
  workflow_name: WorkflowName
  error_message: string
  error_stack: string | null
  product_id: string | null
  created_at: Date
  resolved: boolean
}

// ── AUDIT LOG ────────────────────────────────────────────────
export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: string
  changed_by: string | null
  workflow: string | null
  ai_model: string | null
  prompt_version: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  timestamp: Date
}

// ── PROMPT TEMPLATES ─────────────────────────────────────────
export interface PromptTemplate {
  id: string
  name: string
  version: number
  purpose: string
  template: string
  model: string | null
  temperature: number
  active: boolean
  created_at: Date
}

// ── AI USAGE ─────────────────────────────────────────────────
export interface AIUsage {
  id: string
  provider: string
  model: string
  purpose: string
  product_id: string | null
  workflow_run_id: string | null
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost: number
  created_at: Date
}

// ── NOTIFICATIONS ────────────────────────────────────────────
export type NotificationEvent =
  | 'product.created'
  | 'product.updated'
  | 'product.qa_passed'
  | 'product.qa_failed'
  | 'product.published'
  | 'sale.received'
  | 'refund.received'
  | 'workflow.failed'
  | 'quota.exceeded'
  | 'approval.required'

export interface Notification {
  id: string
  event: NotificationEvent
  title: string
  message: string
  product_id: string | null
  read: boolean
  created_at: Date
}

// ── SETTINGS ─────────────────────────────────────────────────
export interface Settings {
  ai_provider: 'ollama' | 'cloudflare' | 'manual'
  ai_base_url: string
  ai_model: string
  embedding_model: string
  image_model: string
  research_frequency: string
  products_per_day: number
  auto_research: boolean
  auto_create: boolean
  auto_qa: boolean
  auto_publish: boolean
  auto_price: boolean
  max_daily_ai_calls: number
  max_daily_products: number
  default_currency: string
  default_product_price: number
  min_opportunity_score: number
  min_qa_score: number
  max_revisions: number
  scoring_weights: ScoringWeights
  notification_email: boolean
  notification_webhook: boolean
  storage_provider: 'local' | 's3'
}

// ── DASHBOARD ────────────────────────────────────────────────
export interface DashboardKPIs {
  total_products: number
  products_in_production: number
  published_products: number
  total_units_sold: number
  gross_revenue: number
  net_revenue: number
  total_expenses: number
  net_profit: number
  profit_margin: number
}

export interface AutomationStatus {
  research: 'RUNNING' | 'IDLE' | 'PAUSED' | 'ERROR'
  creation: 'RUNNING' | 'IDLE' | 'PAUSED' | 'ERROR'
  qa: 'RUNNING' | 'IDLE' | 'PAUSED' | 'ERROR'
  publishing: 'RUNNING' | 'IDLE' | 'PAUSED' | 'ERROR'
  sales_sync: 'RUNNING' | 'IDLE' | 'PAUSED' | 'ERROR'
}

export interface ResourceUsage {
  ai_requests_used: number
  ai_requests_limit: number
  storage_used_gb: number
  storage_limit_gb: number
  api_requests_used: number
  api_requests_limit: number
}

// ── API RESPONSES ────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ── INSIGHT LABELS ───────────────────────────────────────────
export type InsightLabel = 'OBSERVATION' | 'POSSIBLE_PATTERN' | 'REQUIRES_MORE_DATA'

export interface PerformanceInsight {
  id: string
  label: InsightLabel
  category: string
  title: string
  description: string
  supporting_data: Record<string, unknown>
  generated_at: Date
}
