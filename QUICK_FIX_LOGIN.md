# 🔧 إصلاح سريع لمشكلة تسجيل الدخول

## المشكلة: المستخدم موجود لكن لا يستطيع تسجيل الدخول

### ✅ الحل السريع (3 خطوات):

---

## الخطوة 1: التحقق من المستخدم في Supabase

1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اختر مشروعك
3. اذهب إلى **Authentication** > **Users**
4. ابحث عن `admin@hospitality.com`
5. **تحقق من:**
   - ✅ البريد الإلكتروني صحيح
   - ✅ **Email Confirmed** = ✅ (يجب أن يكون مفعل)
   - ✅ **Created At** موجود

---

## الخطوة 2: إصلاح تأكيد البريد الإلكتروني

إذا كان **Email Confirmed** = ❌، قم بالتالي:

### الطريقة 1: من Dashboard
1. اضغط على المستخدم
2. اضغط **Confirm Email** أو **Resend Confirmation Email**

### الطريقة 2: من SQL Editor
```sql
-- تأكيد البريد الإلكتروني
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'admin@hospitality.com'
  AND email_confirmed_at IS NULL;
```

---

## الخطوة 3: تعيين الدور

افتح **SQL Editor** في Supabase وشغّل:

```sql
-- التحقق من وجود المستخدم والدور
SELECT 
  u.email,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '❌ NOT Confirmed'
  END as email_status,
  r.name as role_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@hospitality.com';

-- إذا لم يكن هناك دور، عيّنه:
INSERT INTO user_roles (user_id, role_id)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'admin@hospitality.com'),
  (SELECT id FROM roles WHERE name = 'SuperAdmin')
ON CONFLICT (user_id, role_id) DO NOTHING;
```

---

## 🔍 التحقق النهائي

شغّل هذا SQL للتحقق من كل شيء:

```sql
-- التحقق الكامل
SELECT 
  u.email,
  u.email_confirmed_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅'
    ELSE '❌ FIX NEEDED'
  END as email_confirmed,
  r.name as role_name,
  CASE 
    WHEN r.name IS NOT NULL THEN '✅'
    ELSE '❌ FIX NEEDED'
  END as role_assigned
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@hospitality.com';
```

**يجب أن ترى:**
- ✅ email_confirmed
- ✅ role_assigned (SuperAdmin)

---

## 🚨 إذا استمرت المشكلة

### 1. تحقق من Console في المتصفح:
- اضغط F12
- اذهب إلى Console
- ابحث عن أخطاء
- انسخ رسالة الخطأ الكاملة

### 2. تحقق من كلمة المرور:
- تأكد من كتابتها بشكل صحيح
- لا توجد مسافات قبل أو بعد
- الحروف الكبيرة/الصغيرة مهمة

### 3. أنشئ مستخدم جديد للاختبار:
```sql
-- في Supabase Dashboard:
-- Authentication > Users > Add User
-- Email: test@test.com
-- Password: Test123!@#
-- Auto Confirm User: ✅
```

### 4. استخدم ملف SQL المخصص:
شغّل ملف `supabase/verify-and-fix-user.sql` في SQL Editor

---

## 📝 ملاحظات مهمة

1. **Auto Confirm User** يجب أن يكون مفعل عند إنشاء المستخدم
2. **email_confirmed_at** يجب ألا يكون NULL
3. **الدور** يجب أن يكون معين في `user_roles`
4. **كلمة المرور** يجب أن تكون صحيحة تماماً

---

## ✅ بعد الإصلاح

1. أعد تحميل الصفحة (F5)
2. جرّب تسجيل الدخول مرة أخرى
3. إذا نجح، ستنتقل إلى `/dashboard`

