# دليل النشر على VPS

## المتطلبات الأساسية

- Node.js 18+ 
- PM2 مثبت عالمياً: `npm install -g pm2`
- Git

## خطوات النشر

### 1. بناء المشروع

```bash
# بناء المشروع للإنتاج
npm run build
```

### 2. إعداد PM2

#### الطريقة الأولى: استخدام ملف ecosystem.config.js

```bash
# تشغيل المشروع على المنفذ 4000
pm2 start ecosystem.config.js

# أو مباشرة:
pm2 start npm --name "artillery-erp" -- start
```

#### الطريقة الثانية: تشغيل مباشر

```bash
pm2 start npm --name "artillery-erp" -- start
```

### 3. إدارة PM2

```bash
# عرض جميع التطبيقات
pm2 list

# عرض السجلات
pm2 logs artillery-erp

# إعادة تشغيل
pm2 restart artillery-erp

# إيقاف
pm2 stop artillery-erp

# حذف من PM2
pm2 delete artillery-erp

# حفظ قائمة PM2 (لإعادة التشغيل التلقائي)
pm2 save

# إعداد PM2 للبدء عند إعادة تشغيل النظام
pm2 startup
```

### 4. إعداد Nginx (اختياري - للوصول عبر نطاق)

إنشاء ملف `/etc/nginx/sites-available/artillery-erp`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

تفعيل الموقع:
```bash
sudo ln -s /etc/nginx/sites-available/artillery-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. متغيرات البيئة

تأكد من وجود ملف `.env.local` في مجلد المشروع:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**مهم**: لا تضع ملف `.env.local` في Git! استخدم `.env.local.example` كقالب.

### 6. تحديث المشروع

```bash
# سحب التحديثات
git pull

# تثبيت الحزم الجديدة (إن وجدت)
npm install

# إعادة بناء المشروع
npm run build

# إعادة تشغيل PM2
pm2 restart artillery-erp
```

### 7. مراقبة الأداء

```bash
# عرض معلومات مفصلة
pm2 monit

# عرض استخدام الموارد
pm2 status
```

## استكشاف الأخطاء

### المشروع لا يعمل على المنفذ 4000

```bash
# تحقق من أن المنفذ 4000 متاح
sudo lsof -i :4000

# أو
netstat -tulpn | grep 4000
```

### PM2 لا يبدأ تلقائياً

```bash
# إعادة إعداد PM2 startup
pm2 unstartup
pm2 startup
pm2 save
```

### المشروع يعمل لكن الصفحة لا تظهر

- تحقق من جدار الحماية (Firewall)
- تحقق من إعدادات Nginx (إن كنت تستخدمه)
- تحقق من السجلات: `pm2 logs artillery-erp`

## ملاحظات مهمة

1. **المنفذ 4000**: المشروع يعمل الآن على المنفذ 4000 بدلاً من 3000
2. **PM2**: يحافظ على تشغيل المشروع حتى بعد إغلاق Terminal
3. **السجلات**: موجودة في مجلد `./logs/` (سيتم إنشاؤه تلقائياً)
4. **الذاكرة**: تم تحديد حد أقصى 1GB - يمكن تعديله في `ecosystem.config.js`

## الأوامر السريعة

```bash
# بناء وتشغيل
npm run build && pm2 restart artillery-erp

# عرض السجلات الحية
pm2 logs artillery-erp --lines 50

# إعادة تشغيل مع مسح الكاش
pm2 restart artillery-erp --update-env
```

