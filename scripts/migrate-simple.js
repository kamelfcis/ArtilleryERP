#!/usr/bin/env node

/**
 * Simple Migration Script
 * Lists SQL files in execution order
 */

const fs = require('fs')
const path = require('path')

const supabaseDir = path.join(__dirname, '..', 'supabase')

const migrationOrder = [
  'schema.sql',
  'schema-additional.sql',
  'audit-log.sql',
  'staff-schema.sql',
  'inventory-schema.sql',
  'activity-feed-schema.sql',
  'services-schema.sql',
  'service-history-schema.sql',
  'service-availability-schema.sql',
  'storage-policies.sql',
  'seed.sql',
  'services-seed.sql',
]

console.log('📋 SQL Migration Order:\n')
console.log('Run these files in Supabase SQL Editor in this order:\n')

migrationOrder.forEach((fileName, index) => {
  const filePath = path.join(supabaseDir, fileName)
  const exists = fs.existsSync(filePath)
  const status = exists ? '✅' : '❌'
  
  console.log(`${(index + 1).toString().padStart(2, ' ')}. ${status} ${fileName}`)
  if (!exists) {
    console.log(`    ⚠️  File not found`)
  }
})

console.log('\n📝 Instructions:')
console.log('1. Go to Supabase Dashboard → SQL Editor')
console.log('2. Run each file in the order shown above')
console.log('3. Make sure to create Storage Buckets before running storage-policies.sql:')
console.log('   - unit-images (public)')
console.log('   - reservation-files (private)')
console.log('\n🔗 Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql')

