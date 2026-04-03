'use client'

import { useUnits } from '@/lib/hooks/use-units'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMemo } from 'react'
import { Home, CheckCircle, XCircle, Clock } from 'lucide-react'
import { motion } from 'framer-motion'

interface UnitsStatsProps {
  locationId?: string
}

export function UnitsStats({ locationId }: UnitsStatsProps = {}) {
  const { data: units, isLoading } = useUnits(
    locationId ? { locationId } : undefined
  )

  const stats = useMemo(() => {
    if (!units) return null

    const total = units.length
    const available = units.filter(u => u.status === 'available').length
    const occupied = units.filter(u => u.status === 'occupied').length
    const maintenance = units.filter(u => u.status === 'maintenance').length
    const occupancyRate = total > 0 ? ((occupied / total) * 100).toFixed(1) : '0'

    return {
      total,
      available,
      occupied,
      maintenance,
      occupancyRate,
    }
  }, [units])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>إحصائيات الوحدات</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
      </div>
      
      <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50">
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          إحصائيات الوحدات
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-blue-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">إجمالي الوحدات</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.total}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-green-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">متاحة</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.available}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-orange-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">مشغولة</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.occupied}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-red-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <XCircle className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">صيانة</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.maintenance}</div>
            </motion.div>
          </div>
          <div className="pt-4 border-t border-blue-200/50 dark:border-blue-800/50">
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-100/50 to-indigo-100/50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg mb-2">
              <span className="text-sm font-semibold">معدل الإشغال</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{stats.occupancyRate}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.occupancyRate}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-lg"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

