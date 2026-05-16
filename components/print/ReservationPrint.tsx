'use client'

import { Reservation } from '@/lib/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Printer, Merge } from 'lucide-react'
import { useReservationServices } from '@/lib/hooks/use-services'
import { useRef, useState } from 'react'
import { buildContractHtml } from '@/lib/utils/build-contract-html'
import { formatCurrency } from '@/lib/utils'

interface ReservationPrintProps {
  reservation: Reservation
}

export function ReservationPrint({ reservation }: ReservationPrintProps) {
  const { data: reservationServices } = useReservationServices(reservation.id)
  const isPrinting = useRef(false)

  // Pre-print dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isMerge, setIsMerge] = useState(false)
  const [mergePrice, setMergePrice] = useState('')

  async function handlePrint() {
    if (isPrinting.current) return
    isPrinting.current = true
    setDialogOpen(false)
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) return
      const html = await buildContractHtml(reservation, {
        mergePrice: isMerge && mergePrice ? Number(mergePrice) : undefined,
        reservationServices: reservationServices || [],
      })
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 300)
    } finally {
      isPrinting.current = false
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setDialogOpen(true)}>
        <Printer className="mr-2 h-4 w-4" />
        طباعة
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">خيارات الطباعة</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current price info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">السعر الحالى</span>
              <span className="text-lg font-bold text-blue-800 dark:text-blue-200">{formatCurrency(reservation.total_amount)}</span>
            </div>

            {/* Merge checkbox */}
            <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20">
              <input
                type="checkbox"
                id="merge-check"
                checked={isMerge}
                onChange={(e) => {
                  setIsMerge(e.target.checked)
                  if (!e.target.checked) setMergePrice('')
                }}
                className="w-5 h-5 rounded accent-orange-600 cursor-pointer"
              />
              <Label htmlFor="merge-check" className="flex items-center gap-2 cursor-pointer text-base font-bold text-orange-700 dark:text-orange-400">
                <Merge className="h-5 w-5" />
                دمج (تعديل السعر يدوياً)
              </Label>
            </div>

            {/* Merge price input */}
            {isMerge && (
              <div className="space-y-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                <Label htmlFor="merge-price" className="text-sm font-bold text-orange-700 dark:text-orange-400">
                  أدخل السعر الجديد
                </Label>
                <Input
                  id="merge-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={mergePrice}
                  onChange={(e) => setMergePrice(e.target.value)}
                  placeholder="أدخل المبلغ..."
                  className="h-12 text-lg font-bold text-center border-2 border-orange-300 dark:border-orange-700 focus:border-orange-500"
                  dir="ltr"
                />
                {mergePrice && (
                  <p className="text-center text-sm text-orange-600 dark:text-orange-400">
                    سيتم طباعة العقد بسعر: <span className="font-bold">{formatCurrency(parseFloat(mergePrice))}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handlePrint}
              disabled={isMerge && !mergePrice}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
            >
              <Printer className="mr-2 h-4 w-4" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
