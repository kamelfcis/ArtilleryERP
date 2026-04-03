# 🔐 بيانات تسجيل الدخول - Login Credentials

## 📋 المستخدمون التجريبيون - Test Users

### 1. SuperAdmin (مدير النظام)
- **Email**: `admin@hospitality.com`
- **Password**: `Admin123!@#`
- **الصلاحيات**: صلاحيات كاملة على النظام

### 2. BranchManager (مدير الفرع)
- **Email**: `manager@hospitality.com`
- **Password**: `Manager123!@#`
- **الصلاحيات**: إدارة فرع محدد

### 3. Receptionist (موظف الاستقبال)
- **Email**: `receptionist@hospitality.com`
- **Password**: `Receptionist123!@#`
- **الصلاحيات**: إنشاء وإدارة الحجوزات

### 4. Accountant (محاسب)
- **Email**: `accountant@hospitality.com`
- **Password**: `Accountant123!@#`
- **الصلاحيات**: إدارة الحسابات والخدمات

---

## 🚀 خطوات إنشاء المستخدمين

### الطريقة 1: من Supabase Dashboard (موصى بها)

1. افتح [Supabase Dashboard](https://app.supabase.com)
2. اختر مشروعك
3. اذهب إلى **Authentication** > **Users**
4. اضغط **Add User** > **Create new user**
5. أنشئ كل مستخدم بالبيانات التالية:

#### SuperAdmin
- Email: `admin@hospitality.com`
- Password: `Admin123!@#`
- Auto Confirm User: ✅ (مفعل)

#### BranchManager
- Email: `manager@hospitality.com`
- Password: `Manager123!@#`
- Auto Confirm User: ✅

#### Receptionist
- Email: `receptionist@hospitality.com`
- Password: `Receptionist123!@#`
- Auto Confirm User: ✅

#### Accountant
- Email: `accountant@hospitality.com`
- Password: `Accountant123!@#`
- Auto Confirm User: ✅

### الطريقة 2: من SQL Editor

1. افتح **SQL Editor** في Supabase Dashboard
2. أنشئ المستخدمين يدوياً باستخدام SQL:

```sql
-- Create SuperAdmin user
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'admin@hospitality.com',
  crypt('Admin123!@#', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Repeat for other users...
```

**ملاحظة**: هذه الطريقة معقدة، استخدم الطريقة 1 بدلاً منها.

---

## 🔗 تعيين الأدوار للمستخدمين

بعد إنشاء المستخدمين، قم بتشغيل ملف SQL التالي:

### من SQL Editor:

1. افتح **SQL Editor**
2. انسخ محتوى ملف `supabase/create-test-users.sql`
3. الصق في SQL Editor
4. اضغط **Run**

أو استخدم هذا SQL مباشرة:

```sql
-- Get user IDs first
SELECT id, email FROM auth.users 
WHERE email IN (
  'admin@hospitality.com',
  'manager@hospitality.com',
  'receptionist@hospitality.com',
  'accountant@hospitality.com'
);

-- Then assign roles (replace USER_ID with actual IDs)
INSERT INTO user_roles (user_id, role_id)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'admin@hospitality.com'),
  (SELECT id FROM roles WHERE name = 'SuperAdmin')
ON CONFLICT DO NOTHING;

-- Repeat for other users...
```

---

## ✅ التحقق من المستخدمين

بعد تعيين الأدوار، تحقق من المستخدمين:

```sql
SELECT 
  u.email,
  u.email_confirmed_at,
  r.name as role_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email IN (
  'admin@hospitality.com',
  'manager@hospitality.com',
  'receptionist@hospitality.com',
  'accountant@hospitality.com'
)
ORDER BY u.email;
```

---

## 🔒 ملاحظات أمنية

1. **لا تستخدم هذه البيانات في الإنتاج!**
2. **غيّر كلمات المرور فوراً بعد الاختبار**
3. **استخدم كلمات مرور قوية في الإنتاج**
4. **فعّل 2FA للمستخدمين المهمين**

---

## 🆘 استكشاف الأخطاء

### المستخدم لا يستطيع تسجيل الدخول؟

1. تحقق من أن المستخدم موجود في `auth.users`
2. تحقق من أن `email_confirmed_at` ليس NULL
3. تحقق من أن الدور معين في `user_roles`
4. تحقق من أن RLS policies تسمح بالوصول

### خطأ "User not found"?

```sql
-- تحقق من وجود المستخدم
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'admin@hospitality.com';
```

### خطأ "No role assigned"?

```sql
-- تحقق من الأدوار المعينة
SELECT 
  u.email,
  r.name as role_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@hospitality.com';
```

---

## 📞 الدعم

إذا واجهت أي مشاكل، تحقق من:
- ملف `supabase/create-test-users.sql`
- ملف `supabase/seed.sql` (يجب تشغيله أولاً)
- ملف `supabase/schema.sql` (يجب تشغيله أولاً)

