'use client'

import { CalendarDays } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import GuestSelectionDialog from '@/components/calendar/GuestSelectionDialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingReservation: { unitId: string; checkIn: string; checkOut: string } | null
  guests: any[]
  units: any[]
  createGuest: any
  newGuestCreated: string | null
  onSelectGuest: (guestId: string, unitIds: string[], notes: string, checkIn: string, checkOut: string) => void
  onCancel: () => void
  onGuestCreated: () => void
}

export function CreateReservationDialog({
  open,
  onOpenChange,
  pendingReservation,
  guests,
  units,
  createGuest,
  newGuestCreated,
  onSelectGuest,
  onCancel,
  onGuestCreated,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden !fixed !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2 bg-gradient-to-br from-blue-50/60 via-purple-50/40 to-pink-50/40 dark:from-slate-900 dark:via-blue-950/30 dark:to-purple-950/20 border-2 border-blue-200/60 dark:border-blue-700/50 shadow-2xl">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-blue-100/80 dark:border-blue-800/50 shrink-0 bg-gradient-to-r from-white/80 via-blue-50/60 to-indigo-50/60 dark:from-slate-900/80 dark:via-blue-950/40 dark:to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                إنشاء حجز جديد
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                اختر التواريخ والوحدة ثم الضيف لإكمال الحجز
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          <GuestSelectionDialog
            guests={guests}
            units={units}
            initialUnitId={pendingReservation?.unitId || ''}
            initialCheckIn={pendingReservation?.checkIn || ''}
            initialCheckOut={pendingReservation?.checkOut || ''}
            onCreateGuest={createGuest}
            onSelectGuest={onSelectGuest}
            onCancel={onCancel}
            newGuestCreated={newGuestCreated}
            onGuestCreated={onGuestCreated}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
