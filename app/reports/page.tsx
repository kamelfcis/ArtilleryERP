'use client'

import { useReservations } from '@/lib/hooks/use-reservations'
import { useUnits } from '@/lib/hooks/use-units'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { RESERVATION_STATUSES } from '@/lib/constants'
import { BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function ReportsPage() {
  const { data: reservations, isLoading: reservationsLoading } = useReservations()
  const { data: units, isLoading: unitsLoading } = useUnits()

  const stats = {
    totalReservations: reservations?.length || 0,
    confirmedReservations: reservations?.filter(r => r.status === 'confirmed').length || 0,
    totalRevenue: reservations?.reduce((sum, r) => sum + r.total_amount, 0) || 0,
    totalUnits: units?.length || 0,
    availableUnits: units?.filter(u => u.status === 'available').length || 0,
  }

  const statusBreakdown = Object.keys(RESERVATION_STATUSES).map(status => ({
    status,
    count: reservations?.filter(r => r.status === status).length || 0,
    label: RESERVATION_STATUSES[status as keyof typeof RESERVATION_STATUSES],
  }))

  if (reservationsLoading || unitsLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-screen w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">التقارير</h1>
          <p className="text-muted-foreground">إحصائيات وتقارير النظام</p>
        </div>
        <Link href="/reports/advanced">
          <Button variant="outline">
            <BarChart3 className="mr-2 h-4 w-4" />
            تقارير متقدمة
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">إجمالي الحجوزات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReservations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">الحجوزات المؤكدة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.confirmedReservations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">الوحدات المتاحة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.availableUnits} / {stats.totalUnits}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>توزيع الحجوزات حسب الحالة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {statusBreakdown.map((item) => (
              <div key={item.status} className="flex items-center justify-between">
                <span>{item.label}</span>
                <div className="flex items-center gap-4">
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${stats.totalReservations > 0 ? (item.count / stats.totalReservations) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="font-medium w-12 text-left">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

