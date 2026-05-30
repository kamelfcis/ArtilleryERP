'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, Ban, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { CalendarRoomBlock } from '@/lib/utils/room-block-overlap'

function formatBlockDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: CalendarRoomBlock[]
  onConfirm: () => void
  onCancel: () => void
}

export function OverrideRoomBlockDialog({
  open,
  onOpenChange,
  conflicts,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="max-w-md border-0 shadow-2xl overflow-hidden bg-gradient-to-br from-white via-red-50/40 to-amber-50/50 dark:from-slate-900 dark:via-red-950/20 dark:to-amber-950/20 backdrop-blur-xl !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2"
        dir="rtl"
      >
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>

        <DialogHeader className="relative z-10 space-y-1">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="flex justify-center mb-3"
          >
            <motion.div
              className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-rose-700 shadow-lg shadow-red-500/30"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Ban className="h-8 w-8 text-white" />
            </motion.div>
          </motion.div>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 bg-clip-text text-transparent">
            الوحدة محجوبة
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-3 text-muted-foreground leading-relaxed">
            توجد فترة حظر تتداخل مع التواريخ المحددة. هل تريد متابعة الحجز على أي حال؟
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-10 py-2">
          <motion.ul
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="text-right space-y-3 max-h-48 overflow-y-auto pr-0.5"
          >
            {conflicts.map((block, index) => {
              const label = block.name_ar || block.name
              const reason = block.reason_ar || block.reason
              return (
                <motion.li
                  key={block.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05 }}
                  className="relative rounded-xl border border-white/60 dark:border-slate-600/60 bg-white/70 dark:bg-slate-800/60 backdrop-blur-md shadow-md shadow-red-500/5 overflow-hidden"
                >
                  <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-red-500 via-rose-500 to-amber-500" />
                  <div className="px-4 py-3 pr-5">
                    <div className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <span className="text-base" aria-hidden>
                        🚫
                      </span>
                      {label}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-300">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        {formatBlockDate(block.start_date)} — {formatBlockDate(block.end_date)}
                      </span>
                    </div>
                    {reason ? (
                      <div className="mt-2 text-xs px-2.5 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/80 text-amber-800 dark:text-amber-300">
                        {reason}
                      </div>
                    ) : null}
                  </div>
                </motion.li>
              )
            })}
          </motion.ul>
        </div>

        <DialogFooter className="relative z-10 flex flex-row-reverse gap-3 pt-2 sm:justify-stretch">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 min-w-0"
          >
            <Button
              onClick={onConfirm}
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <ArrowLeft className="ml-2 h-5 w-5 shrink-0" />
              متابعة الحجز
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 min-w-0"
          >
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full h-12 text-base font-bold border-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              إلغاء
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
