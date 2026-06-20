'use client'

import { useDashboardStats, type DashboardStatsFilters } from '@/lib/hooks/use-dashboard-stats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'

interface RevenueStatsProps {
  locationId?: string
  filters?: DashboardStatsFilters
}

export function RevenueStats({ locationId, filters }: RevenueStatsProps = {}) {
  const statsFilters =
    filters ?? (locationId ? { locationId } : undefined)
  const { data: stats, isLoading } = useDashboardStats(statsFilters)

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
              <div className="text-2xl font-bold text-white drop-shadow-lg">{formatCurrency(stats.todayRevenue)}</div>
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
              <div className="text-2xl font-bold text-white drop-shadow-lg">{formatCurrency(stats.thisMonthRevenue)}</div>
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
              <div className="text-2xl font-bold text-white drop-shadow-lg">{formatCurrency(stats.totalRevenue)}</div>
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
              <div className="text-2xl font-bold text-white drop-shadow-lg">{formatCurrency(stats.averageRevenue)}</div>
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
