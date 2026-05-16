'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  pendingChange: { description: string } | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmChangeDialog({ pendingChange, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={!!pendingChange} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-md border-0 shadow-2xl bg-gradient-to-br from-white via-amber-50/50 to-orange-50/50 dark:from-slate-900 dark:via-amber-950/20 dark:to-orange-950/20 backdrop-blur-xl !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear_gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>
        <DialogHeader className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent flex items-center justify-center gap-3">
              <motion.div
                className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <AlertTriangle className="h-6 w-6 text-white" />
              </motion.div>
              تأكيد تعديل الحجز
            </DialogTitle>
          </motion.div>
        </DialogHeader>
        <div className="relative z-10 py-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4"
          >
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 dark:border-amber-800">
              <p className="text-base font-medium text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {pendingChange?.description}
              </p>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              هل أنت متأكد من هذا التعديل؟
            </p>
          </motion.div>
        </div>
        <div className="relative z-10 flex gap-3 pt-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
            <Button
              onClick={onConfirm}
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg"
            >
              <Check className="mr-2 h-5 w-5" />
              نعم، تأكيد
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full h-12 text-base font-bold border-2 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              لا، تراجع
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
