# ✅ SQL Migration Checklist

## الترتيب الصحيح لتنفيذ ملفات SQL

### المرحلة 1: الأساسيات (مطلوبة)

- [ ] **1. schema.sql** ⭐ **يجب تنفيذه أولاً**
  - الجداول الأساسية (locations, units, guests, reservations)
  - Functions و Triggers
  - RLS Policies الأساسية

- [ ] **2. schema-additional.sql**
  - discount_codes, loyalty_points, payment_transactions
  - recurring_reservations, housekeeping_logs

- [ ] **3. services-schema.sql**
  - service_categories, services
  - reservation_services

- [ ] **4. storage-policies.sql** ⚠️
  - **قبل التنفيذ:** أنشئ Buckets في Dashboard
  - unit-images (public)
  - reservation-files (private)

### المرحلة 2: الميزات الإضافية (اختيارية)

- [ ] **5. audit-log.sql**
  - سجل التدقيق

- [ ] **6. staff-schema.sql**
  - إدارة الموظفين

- [ ] **7. inventory-schema.sql**
  - إدارة المخزون

- [ ] **8. activity-feed-schema.sql**
  - سجل الأنشطة

- [ ] **9. service-history-schema.sql**
  - سجل الخدمات والتكاليف

- [ ] **10. service-availability-schema.sql**
  - جدولة توفر الخدمات

### المرحلة 3: البيانات الأولية (اختياري)

- [ ] **11. seed.sql**
  - بيانات تجريبية

- [ ] **12. services-seed.sql**
  - بيانات خدمات تجريبية

## استخدام npm

```bash
# عرض ترتيب الملفات
npm run migrate:list
```

## ملاحظات مهمة

1. ✅ نفذ الملفات بالترتيب المذكور أعلاه
2. ✅ تحقق من عدم وجود أخطاء قبل الانتقال للملف التالي
3. ✅ أنشئ Storage Buckets قبل تنفيذ storage-policies.sql
4. ✅ الملفات المميزة بـ ⭐ مطلوبة للعمل الأساسي

## بعد التنفيذ

تحقق من:
- [ ] جميع الجداول تم إنشاؤها
- [ ] RLS Policies مفعلة
- [ ] Functions و Triggers تعمل
- [ ] Storage Buckets موجودة

