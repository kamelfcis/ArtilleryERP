'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import {
  BarChart3,
  CalendarRange,
  Crown,
  Medal,
  TrendingUp,
  Users,
  Award,
  Loader2,
} from 'lucide-react'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { useUserStats } from '@/lib/hooks/use-user-stats'
import UserStatsLeaderboard from '@/components/users/UserStatsLeaderboard'
import {
  getArabicMonthName,
  getEmailInitials,
  getPresetRange,
  monthKeyFromParts,
} from '@/lib/utils/user-stats'

const UserPerformanceLineChart = dynamic(
  () => import('@/components/users/UserPerformanceLineChart'),
  {
    ssr: false,
    loading: () => (
      <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <CardContent className="h-80 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </CardContent>
      </Card>
    ),
  }
)

const PODIUM_STYLES = [
  {
    rank: 2,
    height: 'h-28',
    gradient: 'from-slate-300 to-slate-400',
    badge: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
    icon: Medal,
  },
  {
    rank: 1,
    height: 'h-36',
    gradient: 'from-amber-400 to-yellow-500',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    icon: Crown,
  },
  {
    rank: 3,
    height: 'h-24',
    gradient: 'from-amber-600 to-orange-700',
    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    icon: Award,
  },
]

export default function UserStatisticsPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [fromMonth, setFromMonth] = useState(1)
  const [toMonth, setToMonth] = useState(new Date().getMonth() + 1)

  const from = monthKeyFromParts(Number(year), fromMonth)
  const to = monthKeyFromParts(Number(year), toMonth)
  const rangeValid = from <= to

  const { data, isLoading, isFetching } = useUserStats(rangeValid ? from : null, rangeValid ? to : null)

  const topThree = useMemo(() => data?.users.slice(0, 3) ?? [], [data?.users])

  function applyPreset(preset: 'last3' | 'last6' | 'currentYear') {
    const range = getPresetRange(preset)
    const [fromY, fromM] = range.from.split('-').map(Number)
    const [toY, toM] = range.to.split('-').map(Number)
    setYear(String(toY))
    setFromMonth(fromM)
    setToMonth(toM)
    if (fromY !== toY) {
      toast({
        title: 'تنبيه',
        description: 'النطاق يمتد عبر سنتين — اختر السنة المناسبة يدوياً',
      })
    }
  }

  function handleFromMonthChange(value: string) {
    const month = Number(value)
    setFromMonth(month)
    if (month > toMonth) {
      toast({
        title: 'خطأ',
        description: 'شهر البداية يجب أن يكون قبل شهر النهاية',
        variant: 'destructive',
      })
    }
  }

  function handleToMonthChange(value: string) {
    const month = Number(value)
    setToMonth(month)
    if (fromMonth > month) {
      toast({
        title: 'خطأ',
        description: 'شهر النهاية يجب أن يكون بعد شهر البداية',
        variant: 'destructive',
      })
    }
  }

  const summaryCards = [
    {
      label: 'إجمالي الحجوزات',
      value: data?.summary.totalReservations ?? 0,
      icon: BarChart3,
      color: 'from-violet-500 to-purple-500',
      bgColor: 'from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20',
    },
    {
      label: 'مستخدمون نشطون',
      value: data?.summary.activeUsers ?? 0,
      icon: Users,
      color: 'from-blue-500 to-indigo-500',
      bgColor: 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20',
    },
    {
      label: 'الأفضل أداءً',
      value: data?.summary.topPerformerCount ?? 0,
      sub: data?.summary.topPerformerEmail ?? '—',
      icon: Crown,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20',
    },
    {
      label: 'متوسط لكل مستخدم',
      value: data?.summary.avgPerUser ?? 0,
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
    },
  ]

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => current - i)
  }, [])

  return (
    <RoleGuard allowedRoles={['SuperAdmin']}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 dark:from-slate-950 dark:via-blue-950/20 dark:to-purple-950/20">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-violet-400/10 to-fuchsia-400/10 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], x: [0, -20, 0], y: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative z-10 p-6 space-y-6 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-violet-900 dark:from-slate-100 dark:via-blue-200 dark:to-violet-200 bg-clip-text text-transparent">
              إحصائيات المستخدمين
            </h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <BarChart3 className="h-4 w-4 text-violet-500" />
              أداء إنشاء الحجوزات حسب المستخدم
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="sticky top-4 z-20"
          >
            <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <CalendarRange className="h-5 w-5 text-violet-500 flex-shrink-0" />
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="w-28 h-11 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(fromMonth)} onValueChange={handleFromMonthChange}>
                    <SelectTrigger className="w-36 h-11 rounded-xl">
                      <SelectValue placeholder="من" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {getArabicMonthName(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-sm">إلى</span>
                  <Select value={String(toMonth)} onValueChange={handleToMonthChange}>
                    <SelectTrigger className="w-36 h-11 rounded-xl">
                      <SelectValue placeholder="إلى" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {getArabicMonthName(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isFetching && !isLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'last3' as const, label: 'آخر 3 أشهر' },
                    { key: 'last6' as const, label: 'آخر 6 أشهر' },
                    { key: 'currentYear' as const, label: 'السنة الحالية' },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyPreset(preset.key)}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300 transition-all"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {summaryCards.map((stat, index) => {
              const StatIcon = stat.icon
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + index * 0.05 }}
                  whileHover={{ scale: 1.03, y: -3 }}
                >
                  <Card className={cn('border-0 shadow-lg bg-gradient-to-br backdrop-blur-xl', stat.bgColor)}>
                    <CardContent className="p-4">
                      {isLoading ? (
                        <Skeleton className="h-16 w-full" />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                            <p className={cn('text-3xl font-black mt-1 bg-gradient-to-r bg-clip-text text-transparent', stat.color)}>
                              {stat.value}
                            </p>
                            {'sub' in stat && stat.sub && (
                              <p className="text-[10px] text-slate-400 truncate mt-1">{stat.sub}</p>
                            )}
                          </div>
                          <div className={cn('p-2.5 rounded-xl bg-gradient-to-br opacity-80 flex-shrink-0', stat.color)}>
                            <StatIcon className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>

          {!isLoading && topThree.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl overflow-hidden">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold text-center mb-6 flex items-center justify-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    أفضل 3 مستخدمين
                  </h2>
                  <div className="flex items-end justify-center gap-4 md:gap-8">
                    {PODIUM_STYLES.map((style) => {
                      const user = topThree.find((u) => u.rank === style.rank)
                      const Icon = style.icon
                      return (
                        <motion.div
                          key={style.rank}
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + style.rank * 0.1 }}
                          className="flex flex-col items-center flex-1 max-w-[140px]"
                        >
                          {user ? (
                            <>
                              <div className={cn('relative mb-3 h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg bg-gradient-to-br shadow-lg', style.gradient)}>
                                {getEmailInitials(user.email)}
                                {style.rank === 1 && (
                                  <Crown className="absolute -top-3 h-5 w-5 text-amber-400" />
                                )}
                              </div>
                              <p className="text-xs font-semibold truncate w-full text-center mb-1">{user.email}</p>
                              <p className="text-2xl font-black text-violet-600 dark:text-violet-400 mb-2">{user.total}</p>
                            </>
                          ) : (
                            <div className="mb-3 h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800" />
                          )}
                          <div className={cn('w-full rounded-t-2xl flex items-start justify-center pt-3', style.height, style.badge)}>
                            <Icon className="h-5 w-5 opacity-70" />
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <UserPerformanceLineChart
              months={data?.months ?? []}
              chartSeries={data?.chartSeries ?? []}
              isLoading={isLoading}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <UserStatsLeaderboard
              users={data?.users ?? []}
              totalReservations={data?.summary.totalReservations ?? 0}
              isLoading={isLoading}
            />
          </motion.div>
        </div>
      </div>
    </RoleGuard>
  )
}
