#!/usr/bin/env node

/**
 * Supabase SQL Migration Script
 * Reads SQL files and provides instructions for manual execution
 */

const fs = require('fs')
const path = require('path')

const supabaseDir = path.join(__dirname, '..', 'supabase')

const migrationOrder = [
  {
    file: 'schema.sql',
    description: 'الملف الأساسي - جميع الجداول الأساسية',
    required: true,
  },
  {
    file: 'schema-additional.sql',
    description: 'الجداول الإضافية (خصومات، نقاط الولاء، إلخ)',
    required: true,
  },
  {
    file: 'audit-log.sql',
    description: 'سجل التدقيق - تتبع التغييرات',
    required: true,
  },
  {
    file: 'staff-schema.sql',
    description: 'إدارة الموظفين والجدول الزمني',
    required: false,
  },
  {
    file: 'inventory-schema.sql',
    description: 'إدارة المخزون',
    required: false,
  },
  {
    file: 'activity-feed-schema.sql',
    description: 'سجل الأنشطة',
    required: false,
  },
  {
    file: 'services-schema.sql',
    description: 'الخدمات والطعام',
    required: true,
  },
  {
    file: 'service-history-schema.sql',
    description: 'سجل الخدمات والتكاليف',
    required: false,
  },
  {
    file: 'service-availability-schema.sql',
    description: 'جدولة توفر الخدمات والمخزون',
    required: false,
  },
  {
    file: 'storage-policies.sql',
    description: 'سياسات التخزين (يحتاج إنشاء Buckets أولاً)',
    required: true,
    note: '⚠️  يجب إنشاء Buckets في Supabase Dashboard أولاً',
  },
  {
    file: 'seed.sql',
    description: 'البيانات الأولية (اختياري)',
    required: false,
  },
  {
    file: 'services-seed.sql',
    description: 'بيانات الخدمات الأولية (اختياري)',
    required: false,
  },
]

console.log('📋 SQL Migration Order\n')
console.log('=' .repeat(60))
console.log('Run these files in Supabase SQL Editor in this order:\n')

let successCount = 0
let missingCount = 0

migrationOrder.forEach((item, index) => {
  const filePath = path.join(supabaseDir, item.file)
  const exists = fs.existsSync(filePath)
  const status = exists ? '✅' : '❌'
  const required = item.required ? ' [مطلوب]' : ' [اختياري]'
  
  console.log(`${(index + 1).toString().padStart(2, ' ')}. ${status} ${item.file}${required}`)
  console.log(`    ${item.description}`)
  
  if (item.note) {
    console.log(`    ${item.note}`)
  }
  
  if (!exists) {
    console.log(`    ⚠️  File not found: ${item.file}`)
    missingCount++
  } else {
    successCount++
  }
  console.log()
})

console.log('=' .repeat(60))
console.log(`\n📊 Summary: ${successCount}/${migrationOrder.length} files found`)

if (missingCount > 0) {
  console.log(`⚠️  ${missingCount} file(s) missing\n`)
}

console.log('📝 Instructions:')
console.log('1. Go to Supabase Dashboard → SQL Editor')
console.log('2. Copy and paste each SQL file content in order')
console.log('3. Click "Run" after each file')
console.log('4. Check for errors before proceeding to next file\n')

console.log('🔗 Supabase SQL Editor:')
console.log('   https://supabase.com/dashboard/project/_/sql\n')

console.log('⚠️  Important:')
console.log('   - Create Storage Buckets BEFORE running storage-policies.sql:')
console.log('     • unit-images (public bucket)')
console.log('     • reservation-files (private bucket)')
console.log('   - Files marked [مطلوب] are essential for core functionality')
console.log('   - Files marked [اختياري] can be skipped if not needed\n')

// Generate combined SQL file for reference
console.log('💡 Tip: You can also copy all SQL content into one file')
console.log('   and run it in Supabase SQL Editor (if no errors occur)\n')

