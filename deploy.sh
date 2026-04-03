#!/bin/bash

# سكريبت النشر السريع للمشروع على VPS

echo "🚀 بدء عملية النشر..."

# التحقق من وجود Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js غير مثبت. يرجى تثبيته أولاً."
    exit 1
fi

# التحقق من وجود PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 تثبيت PM2..."
    npm install -g pm2
fi

# تثبيت الحزم
echo "📦 تثبيت الحزم..."
npm install

# بناء المشروع
echo "🔨 بناء المشروع..."
npm run build

# التحقق من وجود مجلد logs
if [ ! -d "logs" ]; then
    mkdir logs
    echo "✅ تم إنشاء مجلد logs"
fi

# إيقاف التطبيق القديم إن كان يعمل
echo "🛑 إيقاف التطبيق القديم..."
pm2 delete artillery-erp 2>/dev/null || true

# بدء التطبيق
echo "▶️  بدء التطبيق على المنفذ 4000..."
pm2 start ecosystem.config.js

# حفظ قائمة PM2
pm2 save

echo "✅ تم النشر بنجاح!"
echo ""
echo "📊 عرض الحالة:"
pm2 status

echo ""
echo "📝 عرض السجلات: pm2 logs artillery-erp"
echo "🔄 إعادة التشغيل: pm2 restart artillery-erp"
echo "🛑 الإيقاف: pm2 stop artillery-erp"

