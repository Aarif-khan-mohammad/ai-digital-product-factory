#!/usr/bin/env node
// scripts/clean.js — Remove ALL demo/test products and transactions
// Keeps: settings, publishing_channels, prompt_templates, users

const { Client } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function clean() {
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
    console.log('✅ Connected')

    await client.query('BEGIN')

    // Delete in dependency order
    await client.query(`DELETE FROM transactions`)
    await client.query(`DELETE FROM expenses`)
    await client.query(`DELETE FROM qa_results`)
    await client.query(`DELETE FROM product_timeline_events`)
    await client.query(`DELETE FROM published_products`)
    await client.query(`DELETE FROM products`)
    await client.query(`DELETE FROM product_ideas`)
    await client.query(`DELETE FROM opportunity_scores`)
    await client.query(`DELETE FROM research_sources`)
    await client.query(`DELETE FROM workflow_runs`)

    await client.query('COMMIT')

    console.log('✅ All demo data removed.')
    console.log('')
    console.log('Your factory is clean. Create your first real product at:')
    console.log('  http://localhost:3000/dashboard/products/new')

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('❌ Clean failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

clean()
