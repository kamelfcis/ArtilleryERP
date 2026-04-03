'use client'

import { useGuests } from '@/lib/hooks/use-guests'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMemo } from 'react'
import { Users, UserCheck, UserX, Home, Heart, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

export function GuestsStats() {
  const { data: guests, isLoading } = useGuests()

  const stats = useMemo(() => {
    if (!guests) return null

    const total = guests.length
    const military = guests.filter(g => g.guest_type === 'military').length
    const civilian = guests.filter(g => g.guest_type === 'civilian').length
    const clubMember = guests.filter(g => g.guest_type === 'club_member').length
    const artilleryFamily = guests.filter(g => g.guest_type === 'artillery_family').length

    return {
      total,
      military,
      civilian,
      clubMember,
      artilleryFamily,
    }
  }, [guests])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>إحصائيات الضيوف</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  return (
    <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-rose-950/30 backdrop-blur-sm">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
      </div>
      
      <CardHeader className="relative z-10 border-b border-purple-200/50 dark:border-purple-800/50">
        <CardTitle className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          إحصائيات الضيوف
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-purple-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">إجمالي الضيوف</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.total}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-blue-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">عسكري</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.military}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-green-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <UserX className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">مدني</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.civilian}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-indigo-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Home className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">عضو دار</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.clubMember}</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -4 }}
              className="col-span-2 p-4 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg hover:shadow-xl transition-all border border-red-400/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Heart className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-white/90">ابناء مدفعية</span>
              </div>
              <div className="text-2xl font-bold text-white drop-shadow-lg">{stats.artilleryFamily}</div>
            </motion.div>
          </div>
          <div className="pt-4 border-t border-purple-200/50 dark:border-purple-800/50">
            <div className="space-y-3 p-3 bg-gradient-to-r from-purple-100/50 to-pink-100/50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">عسكري</span>
                <span className="font-bold text-blue-600">
                  {stats.total > 0 ? ((stats.military / stats.total) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">مدني</span>
                <span className="font-bold text-green-600">
                  {stats.total > 0 ? ((stats.civilian / stats.total) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">عضو دار</span>
                <span className="font-bold text-purple-600">
                  {stats.total > 0 ? ((stats.clubMember / stats.total) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">ابناء مدفعية</span>
                <span className="font-bold text-red-600">
                  {stats.total > 0 ? ((stats.artilleryFamily / stats.total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

