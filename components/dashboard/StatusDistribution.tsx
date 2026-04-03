'use client'

import { useReservations } from '@/lib/hooks/use-reservations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RESERVATION_STATUSES, RESERVATION_STATUS_COLORS } from '@/lib/constants'
import { useMemo } from 'react'

export function StatusDistribution() {
  const { data: reservations, isLoading } = useReservations()

  const distribution = useMemo(() => {
    if (!reservations) return []

    const counts: Record<string, number> = {}
    reservations.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1
    })

    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      percentage: (count / reservations.length) * 100,
    }))
  }, [reservations])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>توزيع الحجوزات حسب الحالة</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>توزيع الحجوزات حسب الحالة</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {distribution.map(({ status, count, percentage }) => (
            <div key={status} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      RESERVATION_STATUS_COLORS[status as keyof typeof RESERVATION_STATUS_COLORS]?.split(' ')[0] || 'bg-gray-200'
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {RESERVATION_STATUSES[status as keyof typeof RESERVATION_STATUSES]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {percentage.toFixed(1)}%
                  </span>
                  <span className="text-sm font-semibold">{count}</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    RESERVATION_STATUS_COLORS[status as keyof typeof RESERVATION_STATUS_COLORS]?.split(' ')[0] || 'bg-gray-200'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          ))}
          {distribution.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد بيانات
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

