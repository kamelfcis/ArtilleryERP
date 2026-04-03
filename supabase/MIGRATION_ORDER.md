# SQL Migration Order

## ترتيب تنفيذ ملفات SQL

يجب تنفيذ ملفات SQL بالترتيب التالي:

### 1. schema.sql
**الملف الأساسي - يجب تنفيذه أولاً**
- إنشاء جميع الجداول الأساسية
- Roles, Permissions, Locations, Units, Guests, Reservations
- Functions و Triggers الأساسية
- RLS Policies الأساسية

### 2. schema-additional.sql
**الجداول الإضافية**
- discount_codes, discount_usage
- housekeeping_logs
- email_logs
- loyalty_points, loyalty_transactions
- recurring_reservations
- payment_transactions

### 3. audit-log.sql
**سجل التدقيق**
- audit_logs table
- Triggers لتسجيل التغييرات

### 4. staff-schema.sql
**إدارة الموظفين**
- staff, shifts, shift_requests
- يعتمد على: locations, auth.users

### 5. inventory-schema.sql
**إدارة المخزون**
- inventory_categories, inventory_items
- inventory_transactions, inventory_requests
- يعتمد على: locations

### 6. activity-feed-schema.sql
**سجل الأنشطة**
- activity_logs
- log_activity function
- يعتمد على: auth.users

### 7. services-schema.sql
**الخدمات والطعام**
- service_categories, services
- reservation_services
- يعتمد على: reservations, services

### 8. service-history-schema.sql
**سجل الخدمات والتكاليف**
- service_history
- service_bundles, service_bundle_items
- service_costs
- يعتمد على: reservation_services, services

### 9. service-availability-schema.sql
**جدولة توفر الخدمات**
- service_availability
- service_bookings
- service_stock
- يعتمد على: services, locations

### 10. storage-policies.sql
**سياسات التخزين**
- Storage bucket policies
- يجب إنشاء Buckets في Supabase Dashboard أولاً:
  - `unit-images` (public)
  - `reservation-files` (private)

### 11. seed.sql
**البيانات الأولية**
- Roles, Permissions
- Sample data (اختياري)

### 12. services-seed.sql
**بيانات الخدمات الأولية**
- Service categories
- Sample services
- يعتمد على: services-schema.sql

## ملاحظات مهمة

1. **قبل التنفيذ:**
   - تأكد من إنشاء Storage Buckets في Supabase Dashboard
   - تأكد من تفعيل Row Level Security في Supabase Settings

2. **بعد التنفيذ:**
   - تحقق من إنشاء جميع الجداول
   - تحقق من RLS Policies
   - تحقق من Functions و Triggers

3. **في حالة الأخطاء:**
   - تحقق من الترتيب
   - تحقق من التبعيات (Foreign Keys)
   - تحقق من وجود الجداول المطلوبة

