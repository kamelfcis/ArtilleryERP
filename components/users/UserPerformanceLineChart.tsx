'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMonthLabel } from '@/lib/utils/user-stats'
import type { ChartSeriesEntry } from '@/lib/hooks/use-user-stats'

interface UserPerformanceLineChartProps {
  months: string[]
  chartSeries: ChartSeriesEntry[]
  isLoading?: boolean
}

interface ChartRow {
  month: string
  monthLabel: string
  [key: string]: string | number
}

function truncateEmail(email: string, max = 18): string {
  if (email.length <= max) return email
  return `${email.slice(0, max - 3)}...`
}

export default function UserPerformanceLineChart({
  months,
  chartSeries,
  isLoading,
}: UserPerformanceLineChartProps) {
  const chartData: ChartRow[] = months.map((month) => {
    const row: ChartRow = {
      month,
      monthLabel: formatMonthLabel(month),
    }
    for (const series of chartSeries) {
      const point = series.data.find((d) => d.month === month)
      row[series.userId] = point?.count ?? 0
    }
    return row
  })

  const hasData = chartSeries.some((s) => s.data.some((d) => d.count > 0))

  return (
    <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-violet-500" />
          أداء أفضل المستخدمين
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground">
            جاري التحميل...
          </div>
        ) : !hasData ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-72 flex flex-col items-center justify-center text-center"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <BarChart3 className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
            </motion.div>
            <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">
              لا توجد حجوزات في هذه الفترة
            </p>
          </motion.div>
        ) : (
          <div className="h-80 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fontSize: 11 }}
                  className="text-slate-500"
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="rounded-xl border bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-3 shadow-lg text-sm" dir="rtl">
                        <p className="font-semibold mb-2">{label}</p>
                        {payload.map((entry) => {
                          const series = chartSeries.find((s) => s.userId === entry.dataKey)
                          return (
                            <p key={String(entry.dataKey)} style={{ color: entry.color }}>
                              {series?.email}: {entry.value} حجز
                            </p>
                          )
                        })}
                      </div>
                    )
                  }}
                />
                <Legend
                  formatter={(value) => {
                    const series = chartSeries.find((s) => s.userId === value)
                    return truncateEmail(series?.email ?? String(value))
                  }}
                />
                {chartSeries.map((series) => (
                  <Line
                    key={series.userId}
                    type="monotone"
                    dataKey={series.userId}
                    name={series.userId}
                    stroke={series.color}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
