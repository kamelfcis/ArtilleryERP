'use client'

import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { CalendarEvent as CalendarEventRow } from '@/lib/types/calendar'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: CalendarEventRow | null
  onDelete: () => void
  isPending: boolean
}

export function DeleteReservationDialog({ open, onOpenChange, reservation, onDelete, isPending }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-0 shadow-2xl bg-gradient-to-br from-white via-red-50/50 to-orange-50/50 dark:from-slate-900 dark:via-red-950/20 dark:to-orange-950/20 backdrop-blur-xl">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>
        <DialogHeader className="relative z-10">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            تأكيد الحذف
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-4">
            هل أنت متأكد من حذف هذا الحجز؟
          </DialogDescription>
          {reservation && (
            <div className="space-y-2 mt-4 text-center">
              <div className="text-lg font-bold text-red-600 dark:text-red-400 py-2 px-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                {reservation.id.substring(0, 8)}…
              </div>
              <div className="text-sm text-muted-foreground">
                {reservation.guest_first_name_ar || reservation.guest_first_name} {reservation.guest_last_name_ar || reservation.guest_last_name}
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-4 text-center">
            لا يمكن التراجع عن هذا الإجراء. سيتم حذف جميع البيانات المرتبطة بهذا الحجز بشكل دائم.
          </p>
        </DialogHeader>
        <DialogFooter className="relative z-10 mt-6 sm:flex-row sm:justify-center gap-3">
          <Button
            variant="outline"
            className="w-full sm:w-auto border-2 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
          <Button
            variant="destructive"
            className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all"
            onClick={onDelete}
            disabled={isPending}
          >
            {isPending ? 'جاري الحذف...' : 'حذف نهائي'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
