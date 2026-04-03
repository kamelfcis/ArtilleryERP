'use client'

import { useReservations } from '@/lib/hooks/use-reservations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { useMemo } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'

interface RevenueStatsProps {
  locationId?: string
}

export function RevenueStats({ locationId }: RevenueStatsProps = {}) {
  const { data: reservations, isLoading } = useReservations(
    locationId ? { locationId } : undefined
  )

  const stats = useMemo(() => {
    if (!reservations) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

    const todayRevenue = reservations
      .filter(r => {
        const checkIn = new Date(r.check_in_date)
        checkIn.setHours(0, 0, 0, 0)
        return checkIn.getTime() === today.getTime() && 
               r.status !== 'cancelled' && 
               r.status !== 'no_show'
      })
      .reduce((sum, r) => sum + (r.total_amount || 0), 0)

    const thisMonthRevenue = reservations
      .filter(r => {
        const checkIn = new Date(r.check_in_date)
        return checkIn >= thisMonth && 
               r.status !== 'cancelled' && 
               r.status !== 'no_show'
      })
      .reduce((sum, r) => sum + (r.total_amount || 0), 0)

    const lastMonthRevenue = reservations
      .filter(r => {
        const checkIn = new Date(r.check_in_date)
        return checkIn >= lastMonth && 
               checkIn <= lastMonthEnd &&
               r.status !== 'cancelled' && 
               r.status !== 'no_show'
      })
      .reduce((sum, r) => sum + (r.total_amount || 0), 0)

    const totalRevenue = reservations
      .filter(r => r.status !== 'cancelled' && r.status !== 'no_show')
      .reduce((sum, r) => sum + (r.total_amount || 0), 0)

    const averageRevenue = reservations.length > 0 
      ? totalRevenue / reservations.length 
      : 0

    const monthlyGrowth = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0

    return {
      today: todayRevenue,
      thisMonth: thisMonthRevenue,
      total: totalRevenue,
      average: averageRevenue,
      monthlyGrowth,
    }
  }, [reservations])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>إحصائيات الإيرادات</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/30 dark:to-teal-950/30 backdrop-blur-sm">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
      </div>
      
      <CardHeader className="relative z-10 border-b border-emerald-200/50 dark:border-emerald-800/50">
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
          إحصائيات الإيرادات
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-green-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">إيرادات اليوم</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{formatCurrency(stats.today)}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-blue-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">إيرادات الشهر</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{formatCurrency(stats.thisMonth)}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-purple-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">إجمالي الإيرادات</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{formatCurrency(stats.total)}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-orange-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">متوسط الحجز</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{formatCurrency(stats.average)}</div>
            </motion.div>
          </div>
          <div className="pt-4 border-t border-emerald-200/50 dark:border-emerald-800/50">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-100/50 to-teal-100/50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg">
              <span className="text-sm font-semibold">نمو الإيرادات الشهرية</span>
              <div className="flex items-center gap-2">
                {stats.monthlyGrowth >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
                <span className={`text-lg font-bold ${stats.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.monthlyGrowth >= 0 ? '+' : ''}{stats.monthlyGrowth.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

