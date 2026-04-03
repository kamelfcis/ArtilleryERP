'use client'

import { useReservations } from '@/lib/hooks/use-reservations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { useMemo } from 'react'

interface RevenueChartProps {
  locationId?: string
}

export function RevenueChart({ locationId }: RevenueChartProps = {}) {
  const { data: reservations, isLoading } = useReservations(
    locationId ? { locationId } : undefined
  )

  const monthlyRevenue = useMemo(() => {
    if (!reservations) return []

    const months: Record<string, number> = {}
    
    reservations.forEach(reservation => {
      if (reservation.status !== 'cancelled' && reservation.status !== 'no_show') {
        const date = new Date(reservation.check_in_date)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        months[monthKey] = (months[monthKey] || 0) + reservation.total_amount
      }
    })

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([month, revenue]) => ({
        month,
        revenue,
      }))
  }, [reservations])

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

