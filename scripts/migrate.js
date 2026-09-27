#!/usr/bin/env node
// scripts/migrate.js — Run database migrations

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

require('dotenv').config({ path: '.env.local' })

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'digital_factory',
    user:     process.env.DB_USER     || 'factory_user',
    password: process.env.DB_PASSWORD || 'factory_pass',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  })

  try {
    await client.connect()
    console.log('✅ Connected to database')

    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    await client.query(schema)
    console.log('✅ Schema applied')

    const seedPath = path.join(__dirname, '..', 'database', 'seeds', '001_defaults.sql')
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8')
      await client.query(seed)
      console.log('✅ Seed data applied')
    }

    // Run additional migration files
    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations')
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql') && f !== '001_initial_schema.sql').sort()
    for (const file of files) {
      try {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
        await client.query(sql)
        console.log(`✅ Migration applied: ${file}`)
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`⏭️  Skipped (already applied): ${file}`)
        } else {
          throw e
        }
      }
    }

    console.log('✅ Migration complete')
  } catch (err) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

migrate()
