'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getEmailInitials } from '@/lib/utils/user-stats'
import type { UserStatsEntry } from '@/lib/hooks/use-user-stats'

interface UserStatsLeaderboardProps {
  users: UserStatsEntry[]
  totalReservations: number
  isLoading?: boolean
}

type SortDir = 'desc' | 'asc'

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white'
  if (rank === 2) return 'bg-gradient-to-br from-slate-300 to-slate-400 text-white'
  if (rank === 3) return 'bg-gradient-to-br from-amber-600 to-orange-700 text-white'
  return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
}

export default function UserStatsLeaderboard({
  users,
  totalReservations,
  isLoading,
}: UserStatsLeaderboardProps) {
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedUsers = useMemo(() => {
    const copy = [...users]
    copy.sort((a, b) => (sortDir === 'desc' ? b.total - a.total : a.total - b.total))
    return copy.map((u, i) => ({ ...u, rank: i + 1 }))
  }, [users, sortDir])

  return (
    <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          لوحة المتصدرين
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
        >
          {sortDir === 'desc' ? (
            <>
              <ArrowDown className="h-3.5 w-3.5" />
              الأعلى أولاً
            </>
          ) : (
            <>
              <ArrowUp className="h-3.5 w-3.5" />
              الأقل أولاً
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">جاري التحميل...</div>
        ) : sortedUsers.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">لا يوجد مستخدمون نشطون</div>
        ) : (
          <div className="space-y-3">
            {sortedUsers.map((user, index) => {
              const share = totalReservations > 0 ? (user.total / totalReservations) * 100 : 0
              return (
                <motion.div
                  key={user.userId}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50"
                >
                  <div
                    className={cn(
                      'h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0',
                      rankBadgeClass(user.rank)
                    )}
                  >
                    #{user.rank}
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {getEmailInitials(user.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{user.email}</p>
                    <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${share}%` }}
                        transition={{ duration: 0.6, delay: index * 0.05 }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                      />
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-lg font-black text-violet-600 dark:text-violet-400">
                      {user.total}
                    </p>
                    <Badge variant="secondary" className="text-[10px]">
                      {share.toFixed(1)}%
                    </Badge>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
