# 🗄️ Database Migration Guide

## ترتيب تنفيذ ملفات SQL

### الطريقة الموصى بها: Supabase SQL Editor

1. افتح Supabase Dashboard
2. اذهب إلى SQL Editor
3. نفذ الملفات بالترتيب التالي:

### الترتيب الصحيح:

```bash
# 1. الملف الأساسي (يجب تنفيذه أولاً)
supabase/schema.sql

# 2. الجداول الإضافية
supabase/schema-additional.sql

# 3. سجل التدقيق
supabase/audit-log.sql

# 4. إدارة الموظفين
supabase/staff-schema.sql

# 5. إدارة المخزون
supabase/inventory-schema.sql

# 6. سجل الأنشطة
supabase/activity-feed-schema.sql

# 7. الخدمات والطعام
supabase/services-schema.sql

# 8. سجل الخدمات والتكاليف
supabase/service-history-schema.sql

# 9. جدولة توفر الخدمات
supabase/service-availability-schema.sql

# 10. سياسات التخزين (بعد إنشاء Buckets)
supabase/storage-policies.sql

# 11. البيانات الأولية
supabase/seed.sql

# 12. بيانات الخدمات الأولية
supabase/services-seed.sql
```

## استخدام npm scripts

### عرض ترتيب الملفات:
```bash
npm run migrate:list
```

### محاولة التنفيذ التلقائي (تجريبي):
```bash
npm run migrate
```

**ملاحظة:** التنفيذ التلقائي قد لا يعمل بشكل كامل. يُنصح بتنفيذ الملفات يدوياً في Supabase SQL Editor.

## خطوات ما قبل التنفيذ

### 1. إنشاء Storage Buckets

في Supabase Dashboard → Storage:

1. أنشئ bucket باسم `unit-images`:
   - Public: ✅ Yes
   - File size limit: 10MB
   - Allowed MIME types: image/*

2. أنشئ bucket باسم `reservation-files`:
   - Public: ❌ No (Private)
   - File size limit: 10MB
   - Allowed MIME types: */*

### 2. تفعيل Row Level Security

تأكد من تفعيل RLS في Supabase Settings → Authentication → Policies

## التحقق من التنفيذ

بعد تنفيذ جميع الملفات، تحقق من:

```sql
-- التحقق من الجداول
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- التحقق من Functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- التحقق من Triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
```

## استكشاف الأخطاء

### خطأ: relation does not exist
- تأكد من تنفيذ `schema.sql` أولاً
- تحقق من الترتيب الصحيح

### خطأ: foreign key constraint
- تأكد من وجود الجداول المطلوبة
- تحقق من الترتيب

### خطأ: function does not exist
- تأكد من تنفيذ `schema.sql` الذي يحتوي على Functions الأساسية

## الملفات الاختيارية

- `seed.sql` - بيانات تجريبية (يمكن تخطيها في الإنتاج)
- `services-seed.sql` - بيانات خدمات تجريبية (يمكن تخطيها)

## الدعم

إذا واجهت مشاكل:
1. تحقق من `MIGRATION_ORDER.md` للتفاصيل
2. راجع رسائل الخطأ في Supabase SQL Editor
3. تأكد من تنفيذ الملفات بالترتيب الصحيح

