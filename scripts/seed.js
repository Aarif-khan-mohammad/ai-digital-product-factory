#!/usr/bin/env node
// scripts/seed.js — Insert default configuration only (no demo data)

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

async function seed() {
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

    const sql = fs.readFileSync(
      path.join(__dirname, '../database/seeds/001_defaults.sql'), 'utf8'
    )
    await client.query(sql)
    console.log('✅ Default settings, channels, and prompt templates loaded.')
    console.log('')
    console.log('No demo products inserted. Create your first real product at:')
    console.log('  http://localhost:3000/dashboard/products/new')

  } catch (err) {
    console.error('❌ Seed failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

seed()
