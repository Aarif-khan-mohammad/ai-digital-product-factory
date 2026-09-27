# AI Digital Product Factory

A production-ready, **free-first** automation platform that discovers digital product opportunities, creates products with AI, runs quality control, publishes to marketplaces, and tracks revenue — all with zero required monthly subscription.

---

## Core Principle

> **ZERO required paid AI API. ZERO automatic spending. LOCAL AI FIRST.**

| Level | Provider | Cost |
|-------|----------|------|
| 1 — Local AI | Ollama + open-source LLMs | $0.00 |
| 2 — Free Cloud | Cloudflare Workers AI | $0.00 (free tier) |
| 3 — Manual | Human input | $0.00 |

---

## Quick Start (Docker)

```bash
# 1. Clone and configure
cp .env.example .env.local
# Edit .env.local with your settings

# 2. Start everything
docker compose up -d

# 3. Run database migrations
npm run db:migrate

# 4. Load demo data (optional)
npm run db:seed

# 5. Pull an AI model into Ollama
docker exec factory_ollama ollama pull llama3.2

# 6. Open the dashboard
open http://localhost:3000
```

---

## Manual Installation

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Ollama (https://ollama.ai) — for local AI

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
# Edit .env.local
npm run db:migrate
npm run dev
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Dashboard                  │
│         (React + TypeScript + Tailwind CSS)          │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────────┐
│                  API Routes (/api/*)                  │
└──┬──────────┬──────────┬──────────┬─────────────────┘
   │          │          │          │
┌──▼──┐  ┌───▼──┐  ┌────▼──┐  ┌───▼────┐
│ AI  │  │ QA   │  │ Pub.  │  │Finance │
│Prov.│  │Engine│  │Engine │  │Engine  │
└──┬──┘  └───┬──┘  └────┬──┘  └───┬────┘
   │          │          │          │
┌──▼──────────▼──────────▼──────────▼────┐
│              PostgreSQL                  │
└─────────────────────────────────────────┘
   │
┌──▼──────────┐    ┌──────────────┐
│  n8n (self- │    │  Ollama      │
│  hosted)    │    │  (local AI)  │
└─────────────┘    └──────────────┘
```

---

## Product Lifecycle

```
IDEA_DISCOVERED → RESEARCHING → OPPORTUNITY_SCORED → APPROVED_FOR_CREATION
→ CREATING → CONTENT_GENERATED → ASSETS_GENERATED → QA_IN_PROGRESS
→ QA_FAILED → REVISION_REQUIRED → READY_TO_PUBLISH → PUBLISHING
→ PUBLISHED → SALES_TRACKING
```

---

## Key Features

- **Market Research Engine** — Reddit, RSS, AI analysis
- **Opportunity Scoring** — 10-dimension weighted scoring (0–100)
- **AI Product Generation** — Content, marketing copy, PDF, ZIP
- **QA Engine** — 16 automated checks, min score 85/100
- **Revision Loop** — Auto-retry up to 3 times
- **Publishing Adapters** — Gumroad, Payhip, Own Store, Manual
- **Financial Engine** — Revenue, fees, expenses, profit, margin
- **Dashboard** — KPIs, Kanban pipeline, revenue charts
- **Free-Tier Protection** — Hard limits, never auto-upgrades
- **Audit Log** — Complete history of every change
- **Prompt Versioning** — Prompts stored in DB, not code

---

## Environment Variables

See `.env.example` for all options. Key variables:

```env
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL=llama3.2
AUTO_PUBLISH=false
MAX_DAILY_AI_REQUESTS=200
MIN_OPPORTUNITY_SCORE=70
MIN_QA_SCORE=85
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard | Full dashboard data |
| GET | /api/products | List products |
| POST | /api/products | Create product |
| GET | /api/products/:id | Product detail |
| POST | /api/products/:id/generate | AI generate |
| POST | /api/products/:id/qa | Run QA |
| POST | /api/products/:id/publish | Publish |
| GET | /api/products/:id/sales | Sales data |
| GET | /api/products/:id/financials | Financials |
| GET | /api/products/:id/timeline | Timeline |
| POST | /api/research/run | Run research |
| GET | /api/workflows | Workflow logs |
| GET | /api/financials | Analytics |
| POST | /api/transactions | Import sale |
| GET | /api/settings | Get settings |
| PATCH | /api/settings | Update settings |
| GET | /api/health | Health check |

---

## n8n Workflows

Import JSON files from `n8n-workflows/` into your n8n instance:

| File | Trigger |
|------|---------|
| 01_daily_market_research.json | 06:00 daily |
| 04_product_creation.json | Webhook |
| 10_sales_sync_financials.json | Every 4 hours |

---

## Adding a New Marketplace

1. Open `src/lib/publishing/engine.ts`
2. Create a class implementing `PublishingAdapter`
3. Add it to the `createAdapter()` factory
4. Add the channel type to the DB enum
5. Enable in Settings

---

## Security

- All secrets in environment variables
- Never commit `.env.local`
- `AUTO_PUBLISH=false` by default
- No automatic spending of any kind

---

## Backup

```bash
docker exec factory_postgres pg_dump -U factory_user digital_factory > backup.sql
tar -czf products_backup.tar.gz ./products/
```

---

## Troubleshooting

**Ollama not connecting:**
```bash
curl http://localhost:11434/api/tags
ollama pull llama3.2
```

**Database connection failed:**
```bash
docker compose ps postgres
docker compose logs postgres
```

**AI quota reached:**
- Automation pauses automatically
- Increase `MAX_DAILY_AI_REQUESTS` in Settings
- Or switch to `AI_PROVIDER=manual`

---

## License

MIT — Free to use, modify, and deploy.
