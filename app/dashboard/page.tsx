'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReservations } from '@/lib/hooks/use-reservations'
import { useUnits } from '@/lib/hooks/use-units'
import { useGuests } from '@/lib/hooks/use-guests'
import { useLocations } from '@/lib/hooks/use-locations'
import { useCurrentStaff } from '@/lib/hooks/use-staff'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar, Users, Home, DollarSign, TrendingUp, AlertCircle, BarChart3, MapPin, Building2, Waves, Trees, Hotel, Castle, Mountain, Palmtree, Tent, Ship, Anchor } from 'lucide-react'
import { RealtimeProvider } from '@/components/realtime/RealtimeProvider'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { StatusDistribution } from '@/components/dashboard/StatusDistribution'
import { ServicesWidget } from '@/components/dashboard/ServicesWidget'
import { ServiceNotifications } from '@/components/services/ServiceNotifications'
import { DashboardSkeleton } from '@/components/loading/DashboardSkeleton'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { ReservationsTimeline } from '@/components/dashboard/ReservationsTimeline'
import { UnitsStats } from '@/components/dashboard/UnitsStats'
import { GuestsStats } from '@/components/dashboard/GuestsStats'
import { RevenueStats } from '@/components/dashboard/RevenueStats'
import { DashboardShortcuts } from '@/components/dashboard/DashboardShortcuts'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RESERVATION_STATUS_COLORS } from '@/lib/constants'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all')
  
  // Check if user is Staff-only (not admin/manager)
  const { hasRole } = useAuth()
  const { data: currentStaff } = useCurrentStaff()
  const isStaffOnly = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')
  
  // For Staff users, force their location; for admins, use selected location
  const effectiveLocationId = isStaffOnly && currentStaff?.location_id 
    ? currentStaff.location_id 
    : (selectedLocationId !== 'all' ? selectedLocationId : undefined)

  const { data: locations } = useLocations()
  const { data: reservations, isLoading: reservationsLoading } = useReservations(
    effectiveLocationId ? { locationId: effectiveLocationId } : undefined
  )
  const { data: units, isLoading: unitsLoading } = useUnits(
    effectiveLocationId ? { locationId: effectiveLocationId } : undefined
  )
  const { data: guests, isLoading: guestsLoading } = useGuests()

  // Prefetch common routes for instant navigation
  useEffect(() => {
    router.prefetch('/calendar')
    router.prefetch('/reservations')
    router.prefetch('/guests')
    router.prefetch('/units')
  }, [router])

  const isLoading = reservationsLoading || unitsLoading || guestsLoading

  // Calculate today's revenue
  const todayRevenue = useMemo(() => {
    if (!reservations) return 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return reservations
      .filter(r => {
        const checkIn = new Date(r.check_in_date)
        checkIn.setHours(0, 0, 0, 0)
        return checkIn.getTime() === today.getTime() && 
               r.status !== 'cancelled' && 
               r.status !== 'no_show'
      })
      .reduce((sum, r) => sum + (r.total_amount || 0), 0)
  }, [reservations])

  // Calculate total revenue
  const totalRevenue = useMemo(() => {
    if (!reservations) return 0
    return reservations
      .filter(r => r.status !== 'cancelled' && r.status !== 'no_show')
      .reduce((sum, r) => sum + (r.total_amount || 0), 0)
  }, [reservations])

  // Calculate pending reservations count
  const pendingReservations = useMemo(() => {
    if (!reservations) return 0
    return reservations.filter(r => r.status === 'pending').length
  }, [reservations])

  const stats = [
    {
      title: 'إجمالي الحجوزات',
      value: reservations?.length || 0,
      icon: Calendar,
      gradient: 'from-blue-500 via-blue-600 to-indigo-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      shadow: 'shadow-blue-500/20',
      hoverShadow: 'hover:shadow-blue-500/30',
    },
    {
      title: 'الوحدات المتاحة',
      value: units?.filter(u => u.status === 'available').length || 0,
      icon: Home,
      gradient: 'from-green-500 via-emerald-600 to-teal-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      shadow: 'shadow-green-500/20',
      hoverShadow: 'hover:shadow-green-500/30',
    },
    {
      title: 'إيرادات اليوم',
      value: formatCurrency(todayRevenue),
      icon: DollarSign,
      gradient: 'from-orange-500 via-amber-600 to-yellow-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      shadow: 'shadow-orange-500/20',
      hoverShadow: 'hover:shadow-orange-500/30',
    },
    {
      title: 'إجمالي الإيرادات',
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      gradient: 'from-emerald-500 via-green-600 to-teal-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      shadow: 'shadow-emerald-500/20',
      hoverShadow: 'hover:shadow-emerald-500/30',
    },
    {
      title: 'حجوزات قيد الانتظار',
      value: pendingReservations,
      icon: AlertCircle,
      gradient: 'from-yellow-500 via-amber-600 to-orange-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      shadow: 'shadow-yellow-500/20',
      hoverShadow: 'hover:shadow-yellow-500/30',
    },
  ]

  // Show skeleton during initial load for smooth transition
  if (isLoading && !reservations && !units && !guests) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      <RealtimeProvider />
      
      {/* Header - Enhanced UX */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent"
          >
            لوحة التحكم
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground flex items-center gap-2"
          >
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              📊
            </motion.span>
            نظرة عامة شاملة على النظام
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-2"
        >
          <Link href="/reports">
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                className="relative overflow-hidden group border-2 hover:border-primary transition-all"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
                <BarChart3 className="mr-2 h-4 w-4 relative z-10 group-hover:rotate-12 transition-transform" />
                <span className="relative z-10">التقارير المتقدمة</span>
              </Button>
            </motion.div>
          </Link>
        </motion.div>
      </motion.div>

      {/* Staff Location Indicator - Only show for Staff-only users */}
      {isStaffOnly && currentStaff?.location && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-2 border-blue-300 dark:border-blue-700 shadow-lg"
        >
          <div className="p-2 rounded-lg bg-blue-500 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">الموقع الخاص بك</p>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
              {currentStaff.location.name_ar || currentStaff.location.name}
            </p>
          </div>
        </motion.div>
      )}

      {/* Location Filter Toggle Buttons - Only show for admins, not for Staff-only users */}
      {!isStaffOnly && locations && locations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 border border-blue-200/50 dark:border-blue-800/50 shadow-lg"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span>فلترة حسب الموقع:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedLocationId === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedLocationId('all')}
              className={cn(
                "transition-all gap-2",
                selectedLocationId === 'all'
                  ? "bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white shadow-lg"
                  : "hover:bg-slate-50 dark:hover:bg-slate-950/30"
              )}
            >
              <Building2 className="h-4 w-4" />
              جميع المواقع
            </Button>
            {/* Sort locations: Arabic names first, then English */}
            {[...locations]
              .sort((a, b) => {
                const nameA = a.name_ar || a.name
                const nameB = b.name_ar || b.name
                // Check if name starts with Arabic character
                const isArabicA = /^[\u0600-\u06FF]/.test(nameA)
                const isArabicB = /^[\u0600-\u06FF]/.test(nameB)
                if (isArabicA && !isArabicB) return -1
                if (!isArabicA && isArabicB) return 1
                return nameA.localeCompare(nameB, 'ar')
              })
              .map((location) => {
                const name = (location.name_ar || location.name).toLowerCase()
                // Determine icon and color based on location name
                let LocationIcon = MapPin
                let gradient = 'from-blue-600 to-indigo-600'
                let hoverGradient = 'hover:from-blue-700 hover:to-indigo-700'
                let iconColor = 'text-blue-500'
                let hoverBg = 'hover:bg-blue-50 dark:hover:bg-blue-950/30'
                
                if (name.includes('فندق') || name.includes('hotel') || name.includes('كينج') || name.includes('king')) {
                  LocationIcon = Hotel
                  gradient = 'from-amber-500 to-orange-600'
                  hoverGradient = 'hover:from-amber-600 hover:to-orange-700'
                  iconColor = 'text-amber-500'
                  hoverBg = 'hover:bg-amber-50 dark:hover:bg-amber-950/30'
                } else if (name.includes('beach') || name.includes('بيتش') || name.includes('شاطئ')) {
                  LocationIcon = Waves
                  gradient = 'from-cyan-500 to-blue-600'
                  hoverGradient = 'hover:from-cyan-600 hover:to-blue-700'
                  iconColor = 'text-cyan-500'
                  hoverBg = 'hover:bg-cyan-50 dark:hover:bg-cyan-950/30'
                } else if (name.includes('قرية') || name.includes('village') || name.includes('ندي')) {
                  LocationIcon = Trees
                  gradient = 'from-green-500 to-emerald-600'
                  hoverGradient = 'hover:from-green-600 hover:to-emerald-700'
                  iconColor = 'text-green-500'
                  hoverBg = 'hover:bg-green-50 dark:hover:bg-green-950/30'
                } else if (name.includes('منتجع') || name.includes('resort')) {
                  LocationIcon = Palmtree
                  gradient = 'from-teal-500 to-cyan-600'
                  hoverGradient = 'hover:from-teal-600 hover:to-cyan-700'
                  iconColor = 'text-teal-500'
                  hoverBg = 'hover:bg-teal-50 dark:hover:bg-teal-950/30'
                } else if (name.includes('جبل') || name.includes('mountain')) {
                  LocationIcon = Mountain
                  gradient = 'from-slate-500 to-gray-600'
                  hoverGradient = 'hover:from-slate-600 hover:to-gray-700'
                  iconColor = 'text-slate-500'
                  hoverBg = 'hover:bg-slate-50 dark:hover:bg-slate-950/30'
                } else if (name.includes('مخيم') || name.includes('camp')) {
                  LocationIcon = Tent
                  gradient = 'from-orange-500 to-red-600'
                  hoverGradient = 'hover:from-orange-600 hover:to-red-700'
                  iconColor = 'text-orange-500'
                  hoverBg = 'hover:bg-orange-50 dark:hover:bg-orange-950/30'
                } else if (name.includes('مارينا') || name.includes('marina') || name.includes('يخت')) {
                  LocationIcon = Anchor
                  gradient = 'from-indigo-500 to-violet-600'
                  hoverGradient = 'hover:from-indigo-600 hover:to-violet-700'
                  iconColor = 'text-indigo-500'
                  hoverBg = 'hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                } else if (name.includes('قصر') || name.includes('palace') || name.includes('castle')) {
                  LocationIcon = Castle
                  gradient = 'from-purple-500 to-pink-600'
                  hoverGradient = 'hover:from-purple-600 hover:to-pink-700'
                  iconColor = 'text-purple-500'
                  hoverBg = 'hover:bg-purple-50 dark:hover:bg-purple-950/30'
                } else if (name.includes('rocket')) {
                  LocationIcon = Ship
                  gradient = 'from-rose-500 to-pink-600'
                  hoverGradient = 'hover:from-rose-600 hover:to-pink-700'
                  iconColor = 'text-rose-500'
                  hoverBg = 'hover:bg-rose-50 dark:hover:bg-rose-950/30'
                }

                return (
                  <Button
                    key={location.id}
                    variant={selectedLocationId === location.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLocationId(location.id)}
                    className={cn(
                      "transition-all gap-2",
                      selectedLocationId === location.id
                        ? `bg-gradient-to-r ${gradient} ${hoverGradient} text-white shadow-lg`
                        : hoverBg
                    )}
                  >
                    <LocationIcon className={cn("h-4 w-4", selectedLocationId === location.id ? "text-white" : iconColor)} />
                    {location.name_ar || location.name}
                  </Button>
                )
              })}
          </div>
        </motion.div>
      )}

      {/* Main Stats Cards - Premium Design */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon
          const isLoading = reservationsLoading || unitsLoading || guestsLoading

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
                  className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-2xl`}
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
                  {isLoading ? (
                    <Skeleton className="h-8 w-20 bg-white/20" />
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 + 0.3 }}
                      className="text-2xl font-bold text-white drop-shadow-lg"
                    >
                      {stat.value}
                    </motion.div>
                  )}
                </CardContent>

                {/* Decorative Corner */}
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-tl-full blur-xl" />
                <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-br-full blur-xl" />
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Detailed Stats Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RevenueStats locationId={effectiveLocationId} />
        <UnitsStats locationId={effectiveLocationId} />
        <GuestsStats />
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <RevenueChart locationId={effectiveLocationId} />
        <StatusDistribution />
      </div>

      {/* Services and Notifications */}
      <div className="grid gap-4 md:grid-cols-2">
        <ServicesWidget locationId={effectiveLocationId} />
        <ServiceNotifications />
      </div>

      {/* Shortcuts */}
      <DashboardShortcuts />

      {/* Reservations Timeline and Recent */}
      <div className="grid gap-4 md:grid-cols-2">
        <ReservationsTimeline locationId={effectiveLocationId} />
        
        <Card>
          <CardHeader>
            <CardTitle>الحجوزات الأخيرة</CardTitle>
          </CardHeader>
          <CardContent>
            {reservationsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {reservations?.slice(0, 8).map((reservation) => {
                  const statusColor = RESERVATION_STATUS_COLORS[reservation.status] || 'bg-gray-200'
                  return (
                    <Link
                      key={reservation.id}
                      href={`/reservations/${reservation.id}`}
                      className="block p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{reservation.reservation_number}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${statusColor} text-white`}
                            >
                              {reservation.status}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {reservation.guest?.first_name} {reservation.guest?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateShort(reservation.check_in_date)} - {formatDateShort(reservation.check_out_date)}
                          </p>
                        </div>
                        <div className="text-left ml-4">
                          <p className="text-sm font-semibold">{formatCurrency(reservation.total_amount || 0)}</p>
                        </div>
                      </div>
                    </Link>
                  )
                })}
                {(!reservations || reservations.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد حجوزات
                  </div>
                )}
                {reservations && reservations.length > 8 && (
                  <Link href="/reservations">
                    <Button variant="outline" className="w-full mt-4">
                      عرض جميع الحجوزات
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

