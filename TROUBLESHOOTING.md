# 🔧 استكشاف الأخطاء وإصلاحها - Troubleshooting Guide

## 🔐 مشاكل تسجيل الدخول

### خطأ 400 (Bad Request) عند تسجيل الدخول

#### الأسباب المحتملة:

1. **المستخدم غير موجود**
   - تأكد من إنشاء المستخدم في Supabase Dashboard
   - تحقق من البريد الإلكتروني المكتوب بشكل صحيح

2. **كلمة المرور خاطئة**
   - تأكد من كتابة كلمة المرور بشكل صحيح
   - تحقق من وجود مسافات قبل أو بعد كلمة المرور

3. **البريد الإلكتروني غير مؤكد**
   - في Supabase Dashboard، تأكد من تفعيل **Auto Confirm User** عند إنشاء المستخدم
   - أو تحقق من أن `email_confirmed_at` ليس NULL

4. **مشكلة في إعدادات Supabase Auth**
   - تحقق من إعدادات Authentication في Supabase Dashboard
   - تأكد من تفعيل Email/Password provider

#### الحلول:

##### 1. التحقق من وجود المستخدم

```sql
-- في Supabase SQL Editor
SELECT 
  id, 
  email, 
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'admin@hospitality.com';
```

##### 2. التحقق من تأكيد البريد الإلكتروني

```sql
-- إذا كان email_confirmed_at NULL، قم بتحديثه:
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'admin@hospitality.com';
```

##### 3. إعادة تعيين كلمة المرور (إذا لزم الأمر)

في Supabase Dashboard:
1. اذهب إلى **Authentication** > **Users**
2. اختر المستخدم
3. اضغط **Reset Password**
4. أو استخدم **Update User** لتغيير كلمة المرور

##### 4. التحقق من إعدادات Auth

في Supabase Dashboard:
1. اذهب إلى **Authentication** > **Providers**
2. تأكد من تفعيل **Email** provider
3. تحقق من إعدادات **Email Templates**

---

### خطأ "Invalid login credentials"

#### الحل:

1. **تحقق من البريد الإلكتروني**
   - تأكد من كتابته بشكل صحيح
   - تحقق من عدم وجود مسافات

2. **تحقق من كلمة المرور**
   - تأكد من كتابتها بشكل صحيح
   - تحقق من حالة الأحرف (كبيرة/صغيرة)

3. **أنشئ مستخدم جديد للاختبار**
   - استخدم Supabase Dashboard لإنشاء مستخدم جديد
   - تأكد من تفعيل **Auto Confirm User**

---

### خطأ "User not found"

#### الحل:

1. **أنشئ المستخدم في Supabase Dashboard**
   - اذهب إلى **Authentication** > **Users**
   - اضغط **Add User** > **Create new user**
   - أدخل البريد الإلكتروني وكلمة المرور
   - فعّل **Auto Confirm User**

2. **تحقق من وجود المستخدم**
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
   ```

---

### خطأ "Email not confirmed"

#### الحل:

1. **في Supabase Dashboard:**
   - اذهب إلى **Authentication** > **Users**
   - اختر المستخدم
   - اضغط **Confirm Email** أو **Resend Confirmation Email**

2. **أو استخدم SQL:**
   ```sql
   UPDATE auth.users 
   SET email_confirmed_at = NOW()
   WHERE email = 'your-email@example.com';
   ```

---

## 🔑 إنشاء مستخدم جديد بشكل صحيح

### الطريقة الصحيحة:

1. **في Supabase Dashboard:**
   - اذهب إلى **Authentication** > **Users**
   - اضغط **Add User** > **Create new user**
   - أدخل:
     - **Email**: `admin@hospitality.com`
     - **Password**: `Admin123!@#`
     - **Auto Confirm User**: ✅ (مهم جداً!)
   - اضغط **Create User**

2. **تعيين الدور:**
   - افتح **SQL Editor**
   - شغّل هذا SQL:
   ```sql
   INSERT INTO user_roles (user_id, role_id)
   SELECT 
     (SELECT id FROM auth.users WHERE email = 'admin@hospitality.com'),
     (SELECT id FROM roles WHERE name = 'SuperAdmin')
   ON CONFLICT DO NOTHING;
   ```

---

## 🗄️ مشاكل قاعدة البيانات

### خطأ "relation does not exist"

#### الحل:

1. **تأكد من تشغيل schema.sql أولاً**
   - افتح **SQL Editor** في Supabase
   - شغّل `supabase/schema.sql`
   - ثم شغّل `supabase/seed.sql`

2. **تحقق من وجود الجداول:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

---

### خطأ "permission denied"

#### الحل:

1. **تحقق من RLS Policies:**
   - تأكد من تشغيل `schema.sql` كاملاً
   - تحقق من وجود policies للجداول

2. **تحقق من الأدوار:**
   ```sql
   SELECT * FROM roles;
   SELECT * FROM user_roles;
   ```

---

## 🌐 مشاكل الاتصال

### خطأ "Failed to fetch" أو "Network error"

#### الحل:

1. **تحقق من ملف .env.local:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **تحقق من أن المفاتيح صحيحة:**
   - افتح Supabase Dashboard
   - اذهب إلى **Settings** > **API**
   - تحقق من **Project URL** و **anon public** key

3. **أعد تشغيل الخادم:**
   ```bash
   # أوقف الخادم (Ctrl+C)
   npm run dev
   ```

---

## 🔍 التحقق من الإعدادات

### قائمة التحقق:

- [ ] تم تشغيل `schema.sql`
- [ ] تم تشغيل `seed.sql`
- [ ] تم إنشاء المستخدمين في Supabase Dashboard
- [ ] تم تفعيل **Auto Confirm User** للمستخدمين
- [ ] تم تعيين الأدوار للمستخدمين
- [ ] ملف `.env.local` موجود ويحتوي على المفاتيح الصحيحة
- [ ] تم إعادة تشغيل الخادم بعد تغيير `.env.local`

---

## 📞 الحصول على المساعدة

إذا استمرت المشكلة:

1. **تحقق من Console في المتصفح:**
   - افتح Developer Tools (F12)
   - اذهب إلى Console
   - ابحث عن أخطاء

2. **تحقق من Terminal:**
   - ابحث عن أخطاء في terminal حيث يعمل `npm run dev`

3. **تحقق من Supabase Logs:**
   - في Supabase Dashboard
   - اذهب إلى **Logs** > **Postgres Logs** أو **API Logs**

---

## ✅ اختبار الاتصال

### اختبار Supabase Client:

افتح Console في المتصفح (F12) وشغّل:

```javascript
// تحقق من الاتصال
const { data, error } = await supabase.auth.getSession()
console.log('Session:', data)
console.log('Error:', error)
```

### اختبار قاعدة البيانات:

```javascript
// اختبار قراءة البيانات
const { data, error } = await supabase
  .from('roles')
  .select('*')
  .limit(5)

console.log('Roles:', data)
console.log('Error:', error)
```

---

## 🎯 نصائح عامة

1. **استخدم Supabase Dashboard للتحقق:**
   - Authentication > Users: للتحقق من المستخدمين
   - Table Editor: للتحقق من البيانات
   - SQL Editor: لتشغيل استعلامات SQL

2. **تحقق من Console:**
   - افتح Developer Tools دائماً عند التطوير
   - ابحث عن أخطاء JavaScript أو Network

3. **أعد تشغيل الخادم:**
   - بعد تغيير `.env.local`
   - بعد تغيير ملفات مهمة

4. **نظف Cache:**
   ```bash
   # حذف .next folder
   rm -rf .next
   npm run dev
   ```

