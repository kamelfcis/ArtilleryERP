'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/use-toast'
import { Save, Bell, Globe, Shield, Database } from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    // General
    siteName: 'نظام الحجوزات',
    siteNameAr: 'نظام الحجوزات',
    defaultCurrency: 'EGP',
    timezone: 'Asia/Riyadh',
    
    // Notifications
    emailNotifications: true,
    smsNotifications: false,
    checkInReminder: true,
    checkOutReminder: true,
    paymentReminder: true,
    
    // Reservations
    autoConfirm: false,
    allowCancellation: true,
    cancellationDeadline: 24, // hours
    defaultCheckInTime: '14:00',
    defaultCheckOutTime: '12:00',
    
    // Pricing
    defaultPrice: 200,
    weekendMultiplier: 1.2,
    holidayMultiplier: 1.5,
    
    // Security
    sessionTimeout: 60, // minutes
    requireStrongPassword: true,
    twoFactorAuth: false,
  })

  function handleSave() {
    // In production, save to database
    localStorage.setItem('app-settings', JSON.stringify(settings))
    toast({
      title: 'نجح',
      description: 'تم حفظ الإعدادات بنجاح',
    })
  }

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">الإعدادات</h1>
          <p className="text-muted-foreground">إعدادات النظام العامة</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              الإعدادات العامة
            </CardTitle>
            <CardDescription>إعدادات الموقع الأساسية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site-name">اسم الموقع (إنجليزي)</Label>
                <Input
                  id="site-name"
                  value={settings.siteName}
                  onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-name-ar">اسم الموقع (عربي)</Label>
                <Input
                  id="site-name-ar"
                  value={settings.siteNameAr}
                  onChange={(e) => setSettings({ ...settings, siteNameAr: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">العملة الافتراضية</Label>
                <Select
                  value={settings.defaultCurrency}
                  onValueChange={(value) => setSettings({ ...settings, defaultCurrency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                    <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    <SelectItem value="EUR">يورو (EUR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">المنطقة الزمنية</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Riyadh">الرياض (GMT+3)</SelectItem>
                    <SelectItem value="Asia/Dubai">دبي (GMT+4)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              الإشعارات
            </CardTitle>
            <CardDescription>إعدادات الإشعارات والتنبيهات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>إشعارات البريد الإلكتروني</Label>
                <p className="text-sm text-muted-foreground">إرسال إشعارات عبر البريد الإلكتروني</p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>إشعارات SMS</Label>
                <p className="text-sm text-muted-foreground">إرسال إشعارات عبر الرسائل النصية</p>
              </div>
              <Switch
                checked={settings.smsNotifications}
                onCheckedChange={(checked) => setSettings({ ...settings, smsNotifications: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>تذكير تسجيل الدخول</Label>
                <p className="text-sm text-muted-foreground">إرسال تذكير قبل 24 ساعة من تسجيل الدخول</p>
              </div>
              <Switch
                checked={settings.checkInReminder}
                onCheckedChange={(checked) => setSettings({ ...settings, checkInReminder: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>تذكير تسجيل الخروج</Label>
                <p className="text-sm text-muted-foreground">إرسال تذكير قبل 24 ساعة من تسجيل الخروج</p>
              </div>
              <Switch
                checked={settings.checkOutReminder}
                onCheckedChange={(checked) => setSettings({ ...settings, checkOutReminder: checked })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              إعدادات الحجوزات
            </CardTitle>
            <CardDescription>إعدادات الحجوزات والمواعيد</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>التأكيد التلقائي</Label>
                <p className="text-sm text-muted-foreground">تأكيد الحجوزات تلقائياً عند الإنشاء</p>
              </div>
              <Switch
                checked={settings.autoConfirm}
                onCheckedChange={(checked) => setSettings({ ...settings, autoConfirm: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>السماح بالإلغاء</Label>
                <p className="text-sm text-muted-foreground">السماح للعملاء بإلغاء الحجوزات</p>
              </div>
              <Switch
                checked={settings.allowCancellation}
                onCheckedChange={(checked) => setSettings({ ...settings, allowCancellation: checked })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="check-in-time">وقت تسجيل الدخول الافتراضي</Label>
                <Input
                  id="check-in-time"
                  type="time"
                  value={settings.defaultCheckInTime}
                  onChange={(e) => setSettings({ ...settings, defaultCheckInTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check-out-time">وقت تسجيل الخروج الافتراضي</Label>
                <Input
                  id="check-out-time"
                  type="time"
                  value={settings.defaultCheckOutTime}
                  onChange={(e) => setSettings({ ...settings, defaultCheckOutTime: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              الأمان
            </CardTitle>
            <CardDescription>إعدادات الأمان والخصوصية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>كلمة مرور قوية مطلوبة</Label>
                <p className="text-sm text-muted-foreground">تطلب كلمة مرور قوية عند التسجيل</p>
              </div>
              <Switch
                checked={settings.requireStrongPassword}
                onCheckedChange={(checked) => setSettings({ ...settings, requireStrongPassword: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-timeout">انتهاء الجلسة (دقائق)</Label>
              <Input
                id="session-timeout"
                type="number"
                min="15"
                max="480"
                value={settings.sessionTimeout}
                onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 60 })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} size="lg">
            <Save className="mr-2 h-4 w-4" />
            حفظ الإعدادات
          </Button>
        </div>
      </div>
    </RoleGuard>
  )
}

