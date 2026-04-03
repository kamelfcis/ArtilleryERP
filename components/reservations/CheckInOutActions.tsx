'use client'

import { useUpdateReservation } from '@/lib/hooks/use-reservations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { CheckCircle, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Reservation } from '@/lib/types/database'

interface CheckInOutActionsProps {
  reservation: Reservation
}

export function CheckInOutActions({ reservation }: CheckInOutActionsProps) {
  const updateReservation = useUpdateReservation()
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false)
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false)
  const [notes, setNotes] = useState('')

  async function handleCheckIn() {
    try {
      await updateReservation.mutateAsync({
        id: reservation.id,
        status: 'checked_in',
        notes_ar: notes ? `${reservation.notes_ar || ''}\n[تسجيل دخول] ${notes}`.trim() : reservation.notes_ar,
      })
      toast({
        title: 'نجح',
        description: 'تم تسجيل الدخول بنجاح',
      })
      setCheckInDialogOpen(false)
      setNotes('')
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تسجيل الدخول',
        variant: 'destructive',
      })
    }
  }

  async function handleCheckOut() {
    try {
      await updateReservation.mutateAsync({
        id: reservation.id,
        status: 'checked_out',
        notes_ar: notes ? `${reservation.notes_ar || ''}\n[تسجيل خروج] ${notes}`.trim() : reservation.notes_ar,
      })
      toast({
        title: 'نجح',
        description: 'تم تسجيل الخروج بنجاح',
      })
      setCheckOutDialogOpen(false)
      setNotes('')
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تسجيل الخروج',
        variant: 'destructive',
      })
    }
  }

  const canCheckIn = reservation.status === 'confirmed' || reservation.status === 'pending'
  const canCheckOut = reservation.status === 'checked_in'

  if (!canCheckIn && !canCheckOut) return null

  return (
    <div className="flex gap-2">
      {canCheckIn && (
        <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <CheckCircle className="mr-2 h-4 w-4" />
              تسجيل دخول
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تسجيل دخول</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  الحجز: {reservation.reservation_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  الضيف: {reservation.guest?.first_name_ar || reservation.guest?.first_name}{' '}
                  {reservation.guest?.last_name_ar || reservation.guest?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  الوحدة: {reservation.unit?.unit_number}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkin-notes">ملاحظات (اختياري)</Label>
                <Textarea
                  id="checkin-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="أضف أي ملاحظات حول تسجيل الدخول..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCheckInDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleCheckIn} disabled={updateReservation.isPending}>
                  {updateReservation.isPending ? 'جاري المعالجة...' : 'تسجيل الدخول'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canCheckOut && (
        <Dialog open={checkOutDialogOpen} onOpenChange={setCheckOutDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              تسجيل خروج
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تسجيل خروج</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  الحجز: {reservation.reservation_number}
                </p>
                <p className="text-sm text-muted-foreground">
                  الضيف: {reservation.guest?.first_name_ar || reservation.guest?.first_name}{' '}
                  {reservation.guest?.last_name_ar || reservation.guest?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  الوحدة: {reservation.unit?.unit_number}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkout-notes">ملاحظات (اختياري)</Label>
                <Textarea
                  id="checkout-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="أضف أي ملاحظات حول تسجيل الخروج..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCheckOutDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleCheckOut} disabled={updateReservation.isPending}>
                  {updateReservation.isPending ? 'جاري المعالجة...' : 'تسجيل الخروج'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

