'use client'

import { AlertTriangle, Calendar } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  block: any | null
  onDelete: () => void
  isPending: boolean
}

export function RoomBlockDialog({ open, onOpenChange, block, onDelete, isPending }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-0 shadow-2xl bg-gradient-to-br from-white via-red-50/50 to-orange-50/50 dark:from-slate-900 dark:via-red-950/20 dark:to-orange-950/20 backdrop-blur-xl">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#000000_1px,transparent_1px),linear-gradient(to_bottom,#000000_1px,transparent_1px)] bg-[size:20px_20px]" />
        </div>
        <DialogHeader className="relative z-10">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            تفاصيل الحظر
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            هل أنت متأكد من حذف هذا الحظر؟
          </DialogDescription>
        </DialogHeader>
        {block && (
          <div className="relative z-10 space-y-4 mt-2">
            <div className="text-lg font-bold text-red-600 dark:text-red-400 py-2 px-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 text-center">
              🚫 {block.name_ar || block.name}
            </div>

            <div className="flex items-center justify-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <Calendar className="h-3.5 w-3.5 text-green-600" />
                <span className="text-green-700 dark:text-green-300 font-medium">
                  {new Date(block.start_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <Calendar className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-orange-700 dark:text-orange-300 font-medium">
                  {new Date(block.end_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            </div>

            {(block.reason_ar || block.reason) && (
              <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">📋 السبب:</p>
                <p className="text-sm text-amber-800 dark:text-amber-300">{block.reason_ar || block.reason}</p>
              </div>
            )}

            {block.units && block.units.length > 0 && (
              <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">🏠 الوحدات المحظورة ({block.units.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {block.units.map((unitLink: any) => (
                    <span
                      key={unitLink.unit?.id || Math.random()}
                      className="px-2.5 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium border border-blue-200 dark:border-blue-800"
                    >
                      {unitLink.unit?.unit_number} - {unitLink.unit?.name_ar || unitLink.unit?.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center pt-2 border-t border-slate-200 dark:border-slate-700">
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف الحظر بشكل دائم.
            </p>
          </div>
        )}
        <DialogFooter className="relative z-10 mt-4 sm:flex-row sm:justify-center gap-3">
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
