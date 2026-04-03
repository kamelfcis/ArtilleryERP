'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Clock } from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function ServiceAnalyticsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [serviceId, setServiceId] = useState<string>('all')

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['service-analytics', dateFrom, dateTo, serviceId],
    queryFn: async () => {
      if (!dateFrom || !dateTo) return null

      let query = supabase
        .from('reservation_services')
        .select(`
          *,
          service:services (*)
        `)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)

      if (serviceId !== 'all') {
        query = query.eq('service_id', serviceId)
      }

      const { data, error } = await query
      if (error) throw error

      const services = data || []

      // Calculate metrics
      const totalRevenue = services.reduce((sum, s: any) => sum + s.total_amount, 0)
      const totalQuantity = services.reduce((sum, s: any) => sum + s.quantity, 0)
      const averageOrderValue = services.length > 0 ? totalRevenue / services.length : 0
      const uniqueServices = new Set(services.map((s: any) => s.service_id)).size
      const uniqueReservations = new Set(services.map((s: any) => s.reservation_id)).size

      // Peak hours analysis
      const hourlyData = services.reduce((acc: any, s: any) => {
        const hour = new Date(s.created_at).getHours()
        acc[hour] = (acc[hour] || 0) + s.total_amount
        return acc
      }, {})

      const peakHour = Object.entries(hourlyData).sort((a: any, b: any) => b[1] - a[1])[0]?.[0]

      // Daily trends
      const dailyData = services.reduce((acc: any, s: any) => {
        const date = s.created_at.split('T')[0]
        acc[date] = (acc[date] || 0) + s.total_amount
        return acc
      }, {})

      // Service performance
      const servicePerformance = services.reduce((acc: any, s: any) => {
        const serviceName = s.service?.name_ar || s.service?.name || 'غير معروف'
        if (!acc[serviceName]) {
          acc[serviceName] = {
            revenue: 0,
            quantity: 0,
            orders: 0,
          }
        }
        acc[serviceName].revenue += s.total_amount
        acc[serviceName].quantity += s.quantity
        acc[serviceName].orders += 1
        return acc
      }, {})

      return {
        totalRevenue,
        totalQuantity,
        averageOrderValue,
        uniqueServices,
        uniqueReservations,
        totalOrders: services.length,
        peakHour,
        dailyData: Object.entries(dailyData).map(([date, revenue]) => ({ date, revenue })),
        servicePerformance: Object.entries(servicePerformance).map(([name, data]: [string, any]) => ({
          name,
          ...data,
        })).sort((a, b) => b.revenue - a.revenue),
      }
    },
    enabled: !!dateFrom && !!dateTo,
  })

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">تحليلات الخدمات</h1>
          <p className="text-muted-foreground">تحليل أداء الخدمات والطعام</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>الفلاتر</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date-from">من تاريخ</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">إلى تاريخ</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : analytics ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">متوسط قيمة الطلب</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(analytics.averageOrderValue)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الكمية</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalQuantity.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد الطلبات</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalOrders}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>أداء الخدمات</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.servicePerformance.slice(0, 10).map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} وحدة • {item.orders} طلب
                          </p>
                        </div>
                        <p className="font-semibold text-primary">
                          {formatCurrency(item.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>الإحصائيات الإضافية</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">عدد الخدمات المختلفة:</span>
                      <span className="font-semibold">{analytics.uniqueServices}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">عدد الحجوزات:</span>
                      <span className="font-semibold">{analytics.uniqueReservations}</span>
                    </div>
                    {analytics.peakHour && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">ساعة الذروة:</span>
                        <span className="font-semibold">{analytics.peakHour}:00</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              اختر نطاق تاريخ لعرض التحليلات
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  )
}

