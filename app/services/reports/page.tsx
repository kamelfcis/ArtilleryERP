'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { BarChart3, TrendingUp, Utensils, Wrench, Download } from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Button } from '@/components/ui/button'
import { exportServiceReportToCSV } from '@/lib/utils/service-export'

export default function ServicesReportsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [serviceType, setServiceType] = useState<'all' | 'food' | 'service'>('all')

  const { data: report, isLoading } = useQuery({
    queryKey: ['services-report', dateFrom, dateTo, serviceType],
    queryFn: async () => {
      if (!dateFrom || !dateTo) return null

      let query = supabase
        .from('reservation_services')
        .select(`
          *,
          service:services (*),
          reservation:reservations (
            check_in_date,
            check_out_date,
            status
          )
        `)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)

      const { data, error } = await query
      if (error) throw error

      const services = data || []

      // Filter by type
      const filteredServices = serviceType === 'all' 
        ? services 
        : services.filter((s: any) => 
            serviceType === 'food' ? s.service?.is_food : !s.service?.is_food
          )

      // Calculate statistics
      const totalRevenue = filteredServices.reduce((sum, s: any) => sum + s.total_amount, 0)
      const totalQuantity = filteredServices.reduce((sum, s: any) => sum + s.quantity, 0)
      const uniqueServices = new Set(filteredServices.map((s: any) => s.service_id)).size

      // Group by service
      const byService = filteredServices.reduce((acc: any, s: any) => {
        const serviceId = s.service_id
        if (!acc[serviceId]) {
          acc[serviceId] = {
            service: s.service,
            quantity: 0,
            revenue: 0,
            count: 0,
          }
        }
        acc[serviceId].quantity += s.quantity
        acc[serviceId].revenue += s.total_amount
        acc[serviceId].count += 1
        return acc
      }, {})

      // Group by category
      const byCategory = filteredServices.reduce((acc: any, s: any) => {
        const categoryName = s.service?.category?.name_ar || 'غير مصنف'
        if (!acc[categoryName]) {
          acc[categoryName] = {
            quantity: 0,
            revenue: 0,
            count: 0,
          }
        }
        acc[categoryName].quantity += s.quantity
        acc[categoryName].revenue += s.total_amount
        acc[categoryName].count += 1
        return acc
      }, {})

      return {
        totalRevenue,
        totalQuantity,
        uniqueServices,
        totalOrders: filteredServices.length,
        byService: Object.values(byService).sort((a: any, b: any) => b.revenue - a.revenue),
        byCategory: Object.entries(byCategory).map(([name, data]: [string, any]) => ({
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
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            تقارير الخدمات والطعام
          </h1>
          <p className="text-muted-foreground">إحصائيات وتحليلات الخدمات والطعام</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>الفلاتر</CardTitle>
              {report && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportServiceReportToCSV(report)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  تصدير
                </Button>
              )}
            </div>
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
              <div className="space-y-2">
                <Label htmlFor="type">النوع</Label>
                <Select value={serviceType} onValueChange={(value: any) => setServiceType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="food">طعام</SelectItem>
                    <SelectItem value="service">خدمات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : report ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(report.totalRevenue)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي الكمية</CardTitle>
                  <Utensils className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{report.totalQuantity.toFixed(2)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد الطلبات</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{report.totalOrders}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">عدد الخدمات</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{report.uniqueServices}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>الأكثر مبيعاً</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {report.byService.slice(0, 10).map((item: any, index: number) => (
                      <div
                        key={item.service?.id || index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            {item.service?.name_ar || item.service?.name || 'غير معروف'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} {item.service?.unit} • {item.count} طلب
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
                  <CardTitle>حسب الفئة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {report.byCategory.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity} وحدة • {item.count} طلب
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
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              اختر نطاق تاريخ لعرض التقرير
            </CardContent>
          </Card>
        )}
      </div>
    </RoleGuard>
  )
}

