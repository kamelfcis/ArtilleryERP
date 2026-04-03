# 🚀 Quick Start - SQL Migration

## الطريقة السريعة

### 1. عرض ترتيب الملفات:
```bash
npm run migrate:list
```

### 2. تنفيذ الملفات في Supabase:

افتح [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) ونفذ الملفات بالترتيب:

#### الملفات الأساسية (مطلوبة):

1. ✅ **schema.sql** - الملف الأساسي (يجب تنفيذه أولاً)
2. ✅ **schema-additional.sql** - الجداول الإضافية
3. ✅ **services-schema.sql** - الخدمات والطعام
4. ✅ **storage-policies.sql** - سياسات التخزين

#### الملفات الاختيارية:

5. audit-log.sql
6. staff-schema.sql
7. inventory-schema.sql
8. activity-feed-schema.sql
9. service-history-schema.sql
10. service-availability-schema.sql

#### البيانات الأولية (اختياري):

11. seed.sql
12. services-seed.sql

## قبل البدء

### إنشاء Storage Buckets:

1. اذهب إلى Supabase Dashboard → Storage
2. أنشئ bucket: `unit-images` (Public: Yes)
3. أنشئ bucket: `reservation-files` (Public: No)

## التحقق

بعد التنفيذ، تحقق من:

```sql
-- عدد الجداول
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- يجب أن يكون حوالي 30+ جدول
```

## للمساعدة

راجع `MIGRATION_ORDER.md` للتفاصيل الكاملة

