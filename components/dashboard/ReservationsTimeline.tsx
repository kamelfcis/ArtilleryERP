'use client'

import { useReservations } from '@/lib/hooks/use-reservations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateShort } from '@/lib/utils'
import { RESERVATION_STATUS_COLORS } from '@/lib/constants'
import { useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlowEffect } from '@/components/ui/glow-effect'

interface ReservationsTimelineProps {
  locationId?: string
}

export function ReservationsTimeline({ locationId }: ReservationsTimelineProps = {}) {
  const { data: reservations, isLoading } = useReservations(
    locationId ? { locationId } : undefined
  )

  const upcomingReservations = useMemo(() => {
    if (!reservations) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return reservations
      .filter(r => {
        const checkIn = new Date(r.check_in_date)
        checkIn.setHours(0, 0, 0, 0)
        return checkIn >= today && r.status !== 'cancelled' && r.status !== 'checked_out'
      })
      .sort((a, b) => {
        const dateA = new Date(a.check_in_date)
        const dateB = new Date(b.check_in_date)
        return dateA.getTime() - dateB.getTime()
      })
      .slice(0, 10)
  }, [reservations])

  const recentCheckouts = useMemo(() => {
    if (!reservations) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return reservations
      .filter(r => {
        const checkOut = new Date(r.check_out_date)
        checkOut.setHours(0, 0, 0, 0)
        return checkOut < today && r.status === 'checked_out'
      })
      .sort((a, b) => {
        const dateA = new Date(a.check_out_date)
        const dateB = new Date(b.check_out_date)
        return dateB.getTime() - dateA.getTime()
      })
      .slice(0, 5)
  }, [reservations])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>الحجوزات القادمة</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 backdrop-blur-sm">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
      </div>

      <CardHeader className="relative z-10 border-b border-blue-200/50 dark:border-blue-800/50">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <Calendar className="h-6 w-6 text-blue-600" />
          </motion.div>
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            الحجوزات القادمة
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="space-y-4">
          <AnimatePresence>
            {upcomingReservations.length > 0 ? (
              <div className="space-y-3">
                {upcomingReservations.map((reservation, index) => {
                  const statusColor = RESERVATION_STATUS_COLORS[reservation.status] || 'bg-gray-200'
                  const daysUntil = Math.ceil(
                    (new Date(reservation.check_in_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  )
                  
                  return (
                    <motion.div
                      key={reservation.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, x: 5 }}
                    >
                      <Link
                        href={`/reservations/${reservation.id}`}
                        className="block p-4 border-2 rounded-xl hover:border-primary/50 transition-all bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm hover:shadow-lg group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <motion.span
                                className="font-bold text-lg"
                                whileHover={{ scale: 1.1 }}
                              >
                                {reservation.reservation_number}
                              </motion.span>
                              <motion.span
                                className={`px-3 py-1 rounded-lg text-xs font-semibold ${statusColor} text-white shadow-md`}
                                whileHover={{ scale: 1.1 }}
                              >
                                {reservation.status}
                              </motion.span>
                            </div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              {reservation.guest?.first_name} {reservation.guest?.last_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>
                                {formatDateShort(reservation.check_in_date)} - {formatDateShort(reservation.check_out_date)}
                              </span>
                            </div>
                          </div>
                          <motion.div
                            className="text-left ml-4 p-3 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg"
                            whileHover={{ scale: 1.1, rotate: 5 }}
                          >
                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {daysUntil === 0 ? 'اليوم' : daysUntil === 1 ? 'غداً' : `بعد ${daysUntil} أيام`}
                            </p>
                          </motion.div>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد حجوزات قادمة</p>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link href="/reservations">
              <Button
                variant="outline"
                className="w-full border-2 hover:border-primary hover:bg-primary/5 transition-all"
              >
                <motion.span
                  animate={{ x: [0, 5, 0] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4 inline" />
                </motion.span>
                عرض جميع الحجوزات
              </Button>
            </Link>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}

