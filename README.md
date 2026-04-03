# نظام الحجوزات - Military Hospitality CRM

نظام إدارة الحجوزات للضيافة العسكرية مبني على Next.js 14 و Supabase.

## المميزات

- ✅ **لوحة تحكم عربية** مع RTL كامل
- ✅ **تقويم تفاعلي** مع FullCalendar Resource Timeline
- ✅ **سحب وإفلات** لإنشاء وتعديل الحجوزات
- ✅ **إدارة متعددة الأدوار** (SuperAdmin, BranchManager, Receptionist)
- ✅ **Row Level Security (RLS)** لكل دور
- ✅ **TanStack Query** للتخزين المؤقت والمزامنة
- ✅ **Realtime Sync** مع Supabase
- ✅ **رفع الملفات** للوحدات والمرفقات
- ✅ **واجهة مستخدم حديثة** مع shadcn/ui
- ✅ **Dark/Light Mode** (جاهز للتطبيق)
- ✅ **Skeleton Loaders** للأداء الأفضل

## التقنيات المستخدمة

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- shadcn/ui
- Framer Motion
- TanStack Query v5
- FullCalendar Resource Timeline

### Backend
- Supabase (PostgreSQL + Auth + Storage + Realtime)
- Row Level Security (RLS)
- SQL Migrations

## الإعداد والتشغيل

### 1. متطلبات النظام

- Node.js 18+ 
- npm أو yarn
- حساب Supabase

### 2. تثبيت الحزم

```bash
npm install
```

### 3. إعداد Supabase

1. أنشئ مشروع جديد في [Supabase](https://supabase.com)
2. افتح SQL Editor وقم بتشغيل الملفات بالترتيب:
   - `supabase/schema.sql` - إنشاء الجداول والـ RLS
   - `supabase/seed.sql` - البيانات الأولية
   - `supabase/storage-policies.sql` - سياسات التخزين

3. أنشئ Storage Buckets في Supabase Dashboard:
   - `unit-images` (public)
   - `reservation-files` (private)

4. احصل على API Keys من Supabase Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. إعداد متغيرات البيئة

أنشئ ملف `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase Service Role Key (Server-side only - NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**ملاحظة مهمة**: 
- `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY` متاحان للعميل (client-side)
- `SUPABASE_SERVICE_ROLE_KEY` للاستخدام في API routes فقط (server-side) - لا تعرضه أبداً للعميل

### 5. تشغيل المشروع

```bash
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000)

## هيكل المشروع

```
├── app/                    # Next.js App Router
│   ├── dashboard/         # صفحات لوحة التحكم
│   ├── calendar/          # صفحة التقويم
│   ├── reservations/      # صفحات الحجوزات
│   ├── units/             # صفحات الوحدات
│   ├── guests/            # صفحات الضيوف
│   └── login/             # صفحة تسجيل الدخول
├── components/            # المكونات
│   ├── ui/               # مكونات shadcn/ui
│   ├── layout/           # مكونات التخطيط
│   ├── auth/             # مكونات المصادقة
│   └── upload/           # مكونات رفع الملفات
├── contexts/             # React Contexts
├── lib/                  # المكتبات والأدوات
│   ├── hooks/           # TanStack Query Hooks
│   ├── supabase/        # Supabase Client
│   └── types/           # TypeScript Types
└── supabase/            # SQL Scripts
    ├── schema.sql       # قاعدة البيانات
    ├── seed.sql         # البيانات الأولية
    └── storage-policies.sql
```

## الأدوار والصلاحيات

### SuperAdmin
- وصول كامل لجميع المواقع والوحدات
- إدارة المستخدمين والأدوار
- إدارة الأسعار والتقارير

### BranchManager
- إدارة موقع واحد محدد
- إنشاء وتعديل الحجوزات
- إدارة الوحدات والضيوف في موقعه

### Receptionist
- عرض الحجوزات
- إنشاء وتعديل الحجوزات
- إدارة بيانات الضيوف

## الميزات الرئيسية

### التقويم التفاعلي
- عرض جميع الوحدات كموارد
- سحب وإفلات لإنشاء حجز جديد
- تغيير حجم الحجز لتعديل التواريخ
- فلترة حسب الموقع والنوع
- ألوان مختلفة حسب حالة الحجز

### إدارة الحجوزات
- عرض جميع الحجوزات مع الفلترة
- إنشاء حجز جديد
- تعديل حالة الحجز
- رفع مرفقات للحجز
- منع الحجز المزدوج تلقائياً

### إدارة الوحدات
- عرض الوحدات مع الصور
- إضافة صور متعددة للوحدة
- ربط المرافق بالوحدات
- إدارة حالة الوحدة

### إدارة الضيوف
- البحث السريع عن الضيوف
- إضافة بيانات عسكرية
- سجل الحجوزات لكل ضيف

## التطوير المستقبلي

- [ ] Dark/Light Mode Toggle
- [ ] التقارير والإحصائيات المتقدمة
- [ ] إشعارات البريد الإلكتروني
- [ ] دفع إلكتروني
- [ ] تطبيق موبايل
- [ ] API للطرف الثالث

## الدعم

للأسئلة والدعم، يرجى فتح Issue في المستودع.

## الترخيص

هذا المشروع خاص للاستخدام العسكري.

