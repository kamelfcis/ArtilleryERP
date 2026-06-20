'use client'

import { useDashboardStats, type DashboardStatsFilters } from '@/lib/hooks/use-dashboard-stats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RESERVATION_STATUSES, RESERVATION_STATUS_COLORS } from '@/lib/constants'
import { useMemo } from 'react'

interface StatusDistributionProps {
  locationId?: string
  filters?: DashboardStatsFilters
}

export function StatusDistribution({ locationId, filters }: StatusDistributionProps = {}) {
  const statsFilters =
    filters ?? (locationId ? { locationId } : undefined)
  const { data: stats, isLoading } = useDashboardStats(statsFilters)

  const distribution = useMemo(() => {
    if (!stats) return []

    const total = stats.totalReservations
    if (total === 0) return []

    return Object.entries(stats.statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        count,
        percentage: (count / total) * 100,
      }))
  }, [stats])

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
