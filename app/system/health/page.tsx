'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertCircle, Database, Server, Clock } from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function SystemHealthPage() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const checks = {
        database: { status: 'unknown', message: '', responseTime: 0 },
        storage: { status: 'unknown', message: '', responseTime: 0 },
        auth: { status: 'unknown', message: '', responseTime: 0 },
      }

      // Check database
      const dbStart = Date.now()
      try {
        const { error } = await supabase.from('locations').select('id').limit(1)
        checks.database = {
          status: error ? 'error' : 'healthy',
          message: error ? error.message : 'قاعدة البيانات تعمل بشكل طبيعي',
          responseTime: Date.now() - dbStart,
        }
      } catch (e: any) {
        checks.database = {
          status: 'error',
          message: e.message || 'خطأ في الاتصال بقاعدة البيانات',
          responseTime: Date.now() - dbStart,
        }
      }

      // Check storage
      const storageStart = Date.now()
      try {
        const { error } = await supabase.storage.from('unit-images').list('', { limit: 1 })
        checks.storage = {
          status: error ? 'error' : 'healthy',
          message: error ? error.message : 'التخزين يعمل بشكل طبيعي',
          responseTime: Date.now() - storageStart,
        }
      } catch (e: any) {
        checks.storage = {
          status: 'error',
          message: e.message || 'خطأ في الاتصال بالتخزين',
          responseTime: Date.now() - storageStart,
        }
      }

      // Check auth
      const authStart = Date.now()
      try {
        const { data } = await supabase.auth.getSession()
        checks.auth = {
          status: 'healthy',
          message: 'نظام المصادقة يعمل بشكل طبيعي',
          responseTime: Date.now() - authStart,
        }
      } catch (e: any) {
        checks.auth = {
          status: 'error',
          message: e.message || 'خطأ في نظام المصادقة',
          responseTime: Date.now() - authStart,
        }
      }

      return checks
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  function getStatusIcon(status: string) {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">سليم</Badge>
      case 'error':
        return <Badge variant="destructive">خطأ</Badge>
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">غير معروف</Badge>
    }
  }

  return (
    <RoleGuard allowedRoles={['SuperAdmin']}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Server className="h-8 w-8" />
            صحة النظام
          </h1>
          <p className="text-muted-foreground">مراقبة حالة النظام والخدمات</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : health ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    قاعدة البيانات
                  </div>
                  {getStatusIcon(health.database.status)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getStatusBadge(health.database.status)}
                  <p className="text-sm text-muted-foreground">
                    {health.database.message}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {health.database.responseTime}ms
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    التخزين
                  </div>
                  {getStatusIcon(health.storage.status)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getStatusBadge(health.storage.status)}
                  <p className="text-sm text-muted-foreground">
                    {health.storage.message}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {health.storage.responseTime}ms
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    المصادقة
                  </div>
                  {getStatusIcon(health.auth.status)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {getStatusBadge(health.auth.status)}
                  <p className="text-sm text-muted-foreground">
                    {health.auth.message}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {health.auth.responseTime}ms
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </RoleGuard>
  )
}

