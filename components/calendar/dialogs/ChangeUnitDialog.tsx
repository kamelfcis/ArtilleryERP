'use client'

import { motion } from 'framer-motion'
import { Home, Search, ChevronLeft } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { CalendarEvent as CalendarEventRow } from '@/lib/types/calendar'

interface Unit {
  id: string
  unit_number?: string
  name?: string
  name_ar?: string
  type?: string
  status?: string
  location_id?: string
}

interface Props {
  open: boolean
  reservation: CalendarEventRow | null
  units: Unit[] | undefined
  filteredUnitIds: Set<string>
  changingUnit: boolean
  search: string
  onSearchChange: (v: string) => void
  onClose: () => void
  onChangeUnit: (unitId: string) => void
}

export function ChangeUnitDialog({
  open,
  reservation,
  units,
  filteredUnitIds,
  changingUnit,
  search,
  onSearchChange,
  onClose,
  onChangeUnit,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="max-w-md border-0 shadow-2xl bg-gradient-to-br from-white via-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:via-blue-950/20 dark:to-indigo-950/20 backdrop-blur-xl !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>
        <DialogHeader className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center justify-center gap-3">
              <motion.div
                className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Home className="h-6 w-6 text-white" />
              </motion.div>
              نقل الحجز إلى وحدة أخرى
            </DialogTitle>
          </motion.div>
        </DialogHeader>
        <div className="relative z-10 py-2 space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Search className="h-4 w-4 text-blue-500" />
            </div>
            <Input
              placeholder="ابحث عن وحدة... (رقم، اسم، نوع)"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pr-10 h-10 text-sm border-2 border-blue-200 dark:border-blue-800 rounded-xl bg-white/80 dark:bg-slate-900/80 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-center placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-72 overflow-y-auto space-y-2 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-3 bg-white/80 dark:bg-slate-900/80">
            {(() => {
              const typeMap: Record<string, string> = { room: 'غرفة', suite: 'سويت', chalet: 'شاليه', duplex: 'دوبلكس', villa: 'فيلا', apartment: 'شقة' }
              const searchLower = search.trim().toLowerCase()
              const filtered = units
                ?.filter(u =>
                  filteredUnitIds.has(u.id) &&
                  u.status !== 'maintenance'
                )
                .filter(u => {
                  if (!searchLower) return true
                  const typeAr = typeMap[u.type || ''] || ''
                  return (
                    (u.unit_number || '').toLowerCase().includes(searchLower) ||
                    (u.name_ar || '').toLowerCase().includes(searchLower) ||
                    (u.name || '').toLowerCase().includes(searchLower) ||
                    (u.type || '').toLowerCase().includes(searchLower) ||
                    typeAr.includes(searchLower)
                  )
                })
                .sort((a, b) => parseInt(a.unit_number || '0') - parseInt(b.unit_number || '0'))

              if (!filtered || filtered.length === 0) {
                return <p className="text-center text-sm text-slate-400 py-4">لا توجد وحدات متاحة في هذا الموقع</p>
              }

              return filtered.map(u => {
                const isCurrent = u.id === reservation?.unit_id
                return (
                  <motion.button
                    key={u.id}
                    whileHover={isCurrent ? {} : { scale: 1.01 }}
                    whileTap={isCurrent ? {} : { scale: 0.99 }}
                    onClick={() => { if (!isCurrent) onChangeUnit(u.id) }}
                    disabled={changingUnit || isCurrent}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-right ${
                      isCurrent
                        ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-400/50 cursor-default'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0 ${
                      isCurrent
                        ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                        : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                    }`}>
                      {u.unit_number}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm">{typeMap[u.type || ''] || u.type}</span>
                      <span className="text-xs text-muted-foreground">{u.name_ar || u.name || ''}</span>
                    </div>
                    {isCurrent ? (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                        الوحدة الحالية
                      </span>
                    ) : (
                      <ChevronLeft className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    )}
                  </motion.button>
                )
              })
            })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
