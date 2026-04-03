'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { Utensils, TrendingUp, Package } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface ServicesWidgetProps {
  locationId?: string
}

export function ServicesWidget({ locationId }: ServicesWidgetProps = {}) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['services-stats', locationId],
    queryFn: async () => {
      const today = new Date()
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString()
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString()

      // If filtering by location, first get reservations for that location
      let reservationIds: string[] | undefined
      if (locationId) {
        // Get units for this location
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select('id')
          .eq('location_id', locationId)
          .eq('is_active', true)

        if (unitsError) throw unitsError
        const unitIds = units?.map(u => u.id) || []
        
        if (unitIds.length === 0) {
          return {
            totalRevenue: 0,
            foodRevenue: 0,
            serviceRevenue: 0,
            totalOrders: 0,
          }
        }

        // Get reservations for these units
        const { data: reservations, error: reservationsError } = await supabase
          .from('reservations')
          .select('id')
          .in('unit_id', unitIds)

        if (reservationsError) throw reservationsError
        reservationIds = reservations?.map(r => r.id) || []
        
        if (reservationIds.length === 0) {
          return {
            totalRevenue: 0,
            foodRevenue: 0,
            serviceRevenue: 0,
            totalOrders: 0,
          }
        }
      }

      let query = supabase
        .from('reservation_services')
        .select('total_amount, service:services (is_food), reservation_id')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)

      // Filter by reservation IDs if location filter is applied
      if (reservationIds && reservationIds.length > 0) {
        query = query.in('reservation_id', reservationIds)
      }

      const { data: todayServices, error } = await query

      if (error) throw error

      const totalRevenue = todayServices?.reduce((sum, s: any) => sum + s.total_amount, 0) || 0
      const foodRevenue = todayServices?.filter((s: any) => s.service?.is_food).reduce((sum, s: any) => sum + s.total_amount, 0) || 0
      const serviceRevenue = todayServices?.filter((s: any) => !s.service?.is_food).reduce((sum, s: any) => sum + s.total_amount, 0) || 0
      const totalOrders = todayServices?.length || 0

      return {
        totalRevenue,
        foodRevenue,
        serviceRevenue,
        totalOrders,
      }
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>الخدمات والطعام اليوم</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            الخدمات والطعام اليوم
          </CardTitle>
          <Link href="/services/reports">
            <Button variant="ghost" size="sm">
              عرض التفاصيل
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">إجمالي الإيرادات:</span>
            <span className="text-xl font-bold text-primary">
              {formatCurrency(stats?.totalRevenue || 0)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Utensils className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">طعام</span>
              </div>
              <p className="text-lg font-bold text-orange-600">
                {formatCurrency(stats?.foodRevenue || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">خدمات</span>
              </div>
              <p className="text-lg font-bold text-blue-600">
                {formatCurrency(stats?.serviceRevenue || 0)}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">عدد الطلبات:</span>
              <span className="font-semibold">{stats?.totalOrders || 0}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

