'use client'

import { useDashboardStats } from '@/lib/hooks/use-dashboard-stats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'

interface RevenueChartProps {
  locationId?: string
}

export function RevenueChart({ locationId }: RevenueChartProps = {}) {
  const { data: stats, isLoading } = useDashboardStats(
    locationId ? { locationId } : undefined
  )

  const monthlyRevenue = stats?.monthlyRevenue ?? []
  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>الإيرادات الشهرية</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>الإيرادات الشهرية (آخر 6 أشهر)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {monthlyRevenue.length > 0 ? (
            monthlyRevenue.map(({ month, revenue }) => {
              const percentage = (revenue / maxRevenue) * 100
              const [year, monthNum] = month.split('-')
              const monthNames = [
                'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
              ]
              
              return (
                <div key={month} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {monthNames[parseInt(monthNum) - 1]} {year}
                    </span>
                    <span className="font-semibold">{formatCurrency(revenue)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3">
                    <div
                      className="bg-primary h-3 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد بيانات
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
