#!/usr/bin/env node

/**
 * SQL Migration Helper Script
 * Provides migration instructions and file information
 */

const fs = require('fs')
const path = require('path')

const supabaseDir = path.join(__dirname, '..', 'supabase')

const migrationOrder = [
  {
    file: 'schema.sql',
    description: 'الملف الأساسي - جميع الجداول الأساسية',
    required: true,
    priority: 1,
  },
  {
    file: 'schema-additional.sql',
    description: 'الجداول الإضافية (خصومات، نقاط الولاء، مدفوعات)',
    required: true,
    priority: 2,
  },
  {
    file: 'audit-log.sql',
    description: 'سجل التدقيق - تتبع جميع التغييرات',
    required: false,
    priority: 3,
  },
  {
    file: 'staff-schema.sql',
    description: 'إدارة الموظفين والجدول الزمني',
    required: false,
    priority: 4,
  },
  {
    file: 'inventory-schema.sql',
    description: 'إدارة المخزون والمواد',
    required: false,
    priority: 5,
  },
  {
    file: 'activity-feed-schema.sql',
    description: 'سجل الأنشطة في النظام',
    required: false,
    priority: 6,
  },
  {
    file: 'services-schema.sql',
    description: 'الخدمات والطعام - مطلوب لنظام الخدمات',
    required: true,
    priority: 7,
  },
  {
    file: 'service-history-schema.sql',
    description: 'سجل الخدمات والتكاليف والباقات',
    required: false,
    priority: 8,
  },
  {
    file: 'service-availability-schema.sql',
    description: 'جدولة توفر الخدمات وإدارة المخزون',
    required: false,
    priority: 9,
  },
  {
    file: 'storage-policies.sql',
    description: 'سياسات التخزين - يحتاج إنشاء Buckets أولاً',
    required: true,
    priority: 10,
    note: '⚠️  يجب إنشاء Buckets في Supabase Dashboard قبل التنفيذ',
  },
  {
    file: 'seed.sql',
    description: 'البيانات الأولية (أدوار، أذونات) - اختياري',
    required: false,
    priority: 11,
  },
  {
    file: 'services-seed.sql',
    description: 'بيانات الخدمات الأولية - اختياري',
    required: false,
    priority: 12,
  },
  {
    file: 'calendar-window-rpc.sql',
    description: 'تسريع التقويم: عرض موحد + RPC + فهارس + عمود created_by_user_id',
    required: true,
    priority: 13,
  },
]

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath)
    return (stats.size / 1024).toFixed(2) + ' KB'
  } catch {
    return 'N/A'
  }
}

function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    return content.split('\n').length
  } catch {
    return 0
  }
}

console.log('🚀 SQL Migration Guide\n')
console.log('=' .repeat(70))
console.log('📋 Migration Order & Instructions\n')

let successCount = 0
let missingCount = 0
let totalSize = 0

migrationOrder.forEach((item, index) => {
  const filePath = path.join(supabaseDir, item.file)
  const exists = fs.existsSync(filePath)
  const status = exists ? '✅' : '❌'
  const required = item.required ? ' [مطلوب]' : ' [اختياري]'
  const size = exists ? getFileSize(filePath) : 'N/A'
  const lines = exists ? countLines(filePath) : 0
  
  console.log(`${(index + 1).toString().padStart(2, ' ')}. ${status} ${item.file}${required}`)
  console.log(`    📝 ${item.description}`)
  
  if (exists) {
    console.log(`    📊 Size: ${size} | Lines: ${lines}`)
    totalSize += parseFloat(size) || 0
  }
  
  if (item.note) {
    console.log(`    ${item.note}`)
  }
  
  if (!exists) {
    console.log(`    ⚠️  File not found`)
    missingCount++
  } else {
    successCount++
  }
  console.log()
})

console.log('=' .repeat(70))
console.log(`\n📊 Summary:`)
console.log(`   ✅ Found: ${successCount}/${migrationOrder.length} files`)
console.log(`   ❌ Missing: ${missingCount} files`)
console.log(`   📦 Total Size: ${totalSize.toFixed(2)} KB\n`)

console.log('📝 Step-by-Step Instructions:\n')
console.log('1️⃣  Open Supabase Dashboard')
console.log('   → Go to: https://supabase.com/dashboard/project/_/sql')
console.log('   → Or: Project Settings → SQL Editor\n')

console.log('2️⃣  Create Storage Buckets (BEFORE running storage-policies.sql)')
console.log('   → Go to: Storage → Create Bucket')
console.log('   → Create: unit-images (Public: Yes)')
console.log('   → Create: reservation-files (Public: No)\n')

console.log('3️⃣  Run SQL Files in Order:')
console.log('   → Copy content from each file')
console.log('   → Paste in SQL Editor')
console.log('   → Click "Run" button')
console.log('   → Check for errors before next file\n')

console.log('4️⃣  Required Files (Minimum):')
migrationOrder
  .filter(item => item.required)
  .forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.file}`)
  })

console.log('\n5️⃣  Verification:')
console.log('   Run this SQL to check tables:')
console.log('   SELECT COUNT(*) FROM information_schema.tables')
console.log('   WHERE table_schema = \'public\';')
console.log('   Expected: ~30+ tables\n')

console.log('🔗 Quick Links:')
console.log('   • Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql')
console.log('   • Storage Management: https://supabase.com/dashboard/project/_/storage/buckets')
console.log('   • Documentation: See README_MIGRATION.md\n')

console.log('💡 Tip: Files marked [مطلوب] are essential for core functionality')
console.log('   Files marked [اختياري] can be skipped if not needed\n')

