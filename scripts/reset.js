#!/usr/bin/env node
// scripts/reset.js — Drop and recreate the database (DESTRUCTIVE)

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

async function reset() {
  console.log('⚠️  WARNING: This will DELETE all data. Press Ctrl+C to cancel.')
  await new Promise((r) => setTimeout(r, 3000))

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'digital_factory',
    user:     process.env.DB_USER     || 'factory_user',
    password: process.env.DB_PASSWORD || 'factory_pass',
  })

  try {
    await client.connect()

    // Drop all tables
    await client.query(`
      DROP TABLE IF EXISTS
        product_timeline_events, ai_usage, notifications, prompt_templates,
        audit_logs, workflow_errors, workflow_runs, monthly_metrics, daily_metrics,
        expenses, transactions, published_products, publishing_channels, qa_issues,
        qa_results, product_generation_jobs, product_assets, product_files,
        product_versions, products, product_ideas, opportunity_scores,
        market_signals, research_sources, settings, users
      CASCADE
    `)
    console.log('✅ All tables dropped')

    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8')
    await client.query(schema)
    console.log('✅ Schema recreated')

    const seed = fs.readFileSync(path.join(__dirname, '..', 'database', 'seeds', '001_defaults.sql'), 'utf8')
    await client.query(seed)
    console.log('✅ Default seed applied')

    console.log('✅ Database reset complete')
  } catch (err) {
    console.error('❌ Reset failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

reset()
