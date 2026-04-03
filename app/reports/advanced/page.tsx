'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { exportReservationsToCSV } from '@/lib/utils/export'
import { Download, Calendar, TrendingUp, Users, Home, DollarSign, Moon } from 'lucide-react'
import { useLocations } from '@/lib/hooks/use-locations'
import { motion } from 'framer-motion'

export default function AdvancedReportsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [locationId, setLocationId] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { data: locations } = useLocations()

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['advanced-reports', dateFrom, dateTo, locationId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('reservations')
        .select(`
          *,
          unit:units (
            *,
            location:locations (*)
          ),
          guest:guests (*)
        `)

      if (dateFrom) {
        query = query.gte('check_in_date', dateFrom)
      }
      if (dateTo) {
        query = query.lte('check_out_date', dateTo)
      }
      if (locationId !== 'all') {
        query = query.eq('unit.location_id', locationId)
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error

      const reservations = data || []

      // Calculate statistics
      const totalReservations = reservations.length
      const totalRevenue = reservations.reduce((sum, r) => sum + r.total_amount, 0)
      const totalPaid = reservations.reduce((sum, r) => sum + r.paid_amount, 0)
      const totalDiscounts = reservations.reduce((sum, r) => sum + r.discount_amount, 0)
      const totalGuests = new Set(reservations.map(r => r.guest_id)).size
      const totalNights = reservations.reduce((sum, r) => {
        const checkIn = new Date(r.check_in_date)
        const checkOut = new Date(r.check_out_date)
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
        return sum + nights
      }, 0)
      const averageStay = totalReservations > 0 ? totalNights / totalReservations : 0
      const averageRevenue = totalReservations > 0 ? totalRevenue / totalReservations : 0

      // Status breakdown
      const statusBreakdown = reservations.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Unit type breakdown
      const unitTypeBreakdown = reservations.reduce((acc, r) => {
        const type = r.unit?.type || 'unknown'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Daily revenue
      const dailyRevenue = reservations.reduce((acc, r) => {
        const date = r.check_in_date
        acc[date] = (acc[date] || 0) + r.total_amount
        return acc
      }, {} as Record<string, number>)

      return {
        reservations,
        statistics: {
          totalReservations,
          totalRevenue,
          totalPaid,
          totalDiscounts,
          totalGuests,
          totalNights,
          averageStay,
          averageRevenue,
          remaining: totalRevenue - totalPaid - totalDiscounts,
        },
        statusBreakdown,
        unitTypeBreakdown,
        dailyRevenue,
      }
    },
    enabled: !!dateFrom && !!dateTo,
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">التقارير المتقدمة</h1>
        <p className="text-muted-foreground">تقارير مفصلة مع فلاتر متقدمة</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الفلاتر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
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
              <Label htmlFor="location">الموقع</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع المواقع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المواقع</SelectItem>
                  {locations?.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">الحالة</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="جميع الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحالات</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="confirmed">مؤكد</SelectItem>
                  <SelectItem value="checked_in">تم تسجيل الدخول</SelectItem>
                  <SelectItem value="checked_out">تم تسجيل الخروج</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {reportData && (
            <div className="mt-4">
              <Button
                onClick={() => exportReservationsToCSV(reportData.reservations)}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                تصدير التقرير
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : reportData ? (
        <>
          {/* Premium Stats Cards - Same Design as Dashboard */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'إجمالي الحجوزات',
                value: reportData.statistics.totalReservations,
                icon: Calendar,
                gradient: 'from-blue-500 via-blue-600 to-indigo-600',
                iconBg: 'bg-blue-500/10',
                iconColor: 'text-white',
                shadow: 'shadow-blue-500/20',
                hoverShadow: 'hover:shadow-blue-500/30',
              },
              {
                title: 'إجمالي الإيرادات',
                value: formatCurrency(reportData.statistics.totalRevenue),
                icon: TrendingUp,
                gradient: 'from-emerald-500 via-green-600 to-teal-600',
                iconBg: 'bg-emerald-500/10',
                iconColor: 'text-white',
                shadow: 'shadow-emerald-500/20',
                hoverShadow: 'hover:shadow-emerald-500/30',
              },
              {
                title: 'إجمالي الضيوف',
                value: reportData.statistics.totalGuests,
                icon: Users,
                gradient: 'from-purple-500 via-violet-600 to-purple-600',
                iconBg: 'bg-purple-500/10',
                iconColor: 'text-white',
                shadow: 'shadow-purple-500/20',
                hoverShadow: 'hover:shadow-purple-500/30',
              },
              {
                title: 'متوسط الإقامة',
                value: `${reportData.statistics.averageStay.toFixed(1)} ليلة`,
                icon: Moon,
                gradient: 'from-orange-500 via-amber-600 to-yellow-600',
                iconBg: 'bg-orange-500/10',
                iconColor: 'text-white',
                shadow: 'shadow-orange-500/20',
                hoverShadow: 'hover:shadow-orange-500/30',
              },
            ].map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="relative group"
                >
                  <Card className={`relative overflow-hidden border-0 ${stat.shadow} ${stat.hoverShadow} transition-all duration-300 bg-gradient-to-br ${stat.gradient} backdrop-blur-sm`}>
                    {/* Animated Background Pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:20px_20px]" />
                    </div>
                    
                    {/* Shine Effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                        repeatDelay: 2,
                      }}
                    />

                    {/* Glowing Orb */}
                    <motion.div
                      className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />

                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                      <CardTitle className="text-sm font-semibold text-white/90 drop-shadow-md">
                        {stat.title}
                      </CardTitle>
                      <motion.div
                        className={`${stat.iconBg} p-2.5 rounded-xl backdrop-blur-sm border border-white/20 shadow-lg`}
                        whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <motion.div
                          animate={{
                            y: [0, -4, 0],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: index * 0.2,
                          }}
                        >
                          <Icon className={`h-5 w-5 ${stat.iconColor} drop-shadow-md`} />
                        </motion.div>
                      </motion.div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 + 0.3 }}
                        className="text-2xl font-bold text-white drop-shadow-lg"
                      >
                        {stat.value}
                      </motion.div>
                    </CardContent>

                    {/* Decorative Corner */}
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-tl-full blur-xl" />
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-br-full blur-xl" />
                  </Card>
                </motion.div>
              )
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/30 dark:to-teal-950/30 backdrop-blur-sm">
              {/* Decorative Background */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              
              <CardHeader className="relative z-10 border-b border-emerald-200/50 dark:border-emerald-800/50">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    تفاصيل مالية
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 space-y-3 pt-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex justify-between p-2 rounded-lg bg-white/50 dark:bg-slate-800/50"
                >
                  <span className="text-muted-foreground font-medium">إجمالي الإيرادات:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(reportData.statistics.totalRevenue)}</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-between p-2 rounded-lg bg-white/50 dark:bg-slate-800/50"
                >
                  <span className="text-muted-foreground font-medium">المبلغ المدفوع:</span>
                  <span className="font-bold text-green-600">{formatCurrency(reportData.statistics.totalPaid)}</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex justify-between p-2 rounded-lg bg-white/50 dark:bg-slate-800/50"
                >
                  <span className="text-muted-foreground font-medium">الخصومات:</span>
                  <span className="font-bold text-orange-600">{formatCurrency(reportData.statistics.totalDiscounts)}</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex justify-between pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50 p-2 rounded-lg bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20"
                >
                  <span className="text-muted-foreground font-semibold">المتبقي:</span>
                  <span className="font-bold text-red-600 text-lg">{formatCurrency(reportData.statistics.remaining)}</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex justify-between pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50 p-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20"
                >
                  <span className="text-muted-foreground font-semibold">متوسط قيمة الحجز:</span>
                  <span className="font-bold text-blue-600 text-lg">{formatCurrency(reportData.statistics.averageRevenue)}</span>
                </motion.div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-rose-950/30 backdrop-blur-sm">
              {/* Decorative Background */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>
              
              <CardHeader className="relative z-10 border-b border-purple-200/50 dark:border-purple-800/50">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    توزيع حسب الحالة
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="relative z-10 pt-4">
                <div className="space-y-3">
                  {Object.entries(reportData.statusBreakdown).map(([status, count], index) => {
                    const statusColors: Record<string, string> = {
                      pending: 'from-yellow-500 to-amber-500',
                      confirmed: 'from-green-500 to-emerald-500',
                      checked_in: 'from-blue-500 to-indigo-500',
                      checked_out: 'from-gray-500 to-slate-500',
                      cancelled: 'from-red-500 to-rose-500',
                      no_show: 'from-gray-400 to-gray-500',
                    }
                    const gradient = statusColors[status] || 'from-gray-500 to-slate-500'
                    
                    return (
                      <motion.div
                        key={status}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex justify-between items-center p-3 rounded-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50"
                      >
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{status}</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${gradient}`} />
                          <span className="font-bold text-slate-900 dark:text-slate-100">{count as number}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm">
            {/* Decorative Background */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            
            <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  توزيع حسب نوع الوحدة
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(reportData.unitTypeBreakdown).map(([type, count], index) => (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -4 }}
                    className="text-center p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all"
                  >
                    <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                      {count as number}
                    </p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{type}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            اختر نطاق تاريخ لعرض التقرير
          </CardContent>
        </Card>
      )}
    </div>
  )
}

