'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { Trash2, CheckCircle, XCircle } from 'lucide-react'
import { useUpdateReservation, useDeleteReservation } from '@/lib/hooks/use-reservations'
import { ReservationStatus } from '@/lib/types/database'
import { useAuth } from '@/contexts/AuthContext'

interface BulkActionsProps {
  selectedIds: string[]
  onClearSelection: () => void
}

export function BulkActions({ selectedIds, onClearSelection }: BulkActionsProps) {
  const { hasRole, elevatedOps } = useAuth()
  const restrictedBranchManager =
    hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<ReservationStatus>(restrictedBranchManager ? 'pending' : 'confirmed')
  const updateReservation = useUpdateReservation()
  const deleteReservation = useDeleteReservation()

  async function handleBulkStatusChange() {
    if (selectedIds.length === 0) return

    try {
      await Promise.all(
        selectedIds.map(id =>
          updateReservation.mutateAsync({
            id,
            status: newStatus,
          })
        )
      )

      toast({
        title: 'نجح',
        description: `تم تحديث حالة ${selectedIds.length} حجز`,
      })
      setStatusDialogOpen(false)
      onClearSelection()
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تحديث الحالات',
        variant: 'destructive',
      })
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return

    try {
      await Promise.all(
        selectedIds.map(id => deleteReservation.mutateAsync(id))
      )

      toast({
        title: 'نجح',
        description: `تم حذف ${selectedIds.length} حجز`,
      })
      setDeleteDialogOpen(false)
      onClearSelection()
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف الحجوزات',
        variant: 'destructive',
      })
    }
  }

  if (selectedIds.length === 0) return null

  return (
    <div className="flex items-center gap-2 p-4 bg-accent rounded-lg">
      <span className="text-sm font-medium">
        {selectedIds.length} عنصر محدد
      </span>
      <div className="flex gap-2">
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <CheckCircle className="mr-2 h-4 w-4" />
              تغيير الحالة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تغيير حالة الحجوزات</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as ReservationStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  {!restrictedBranchManager && <SelectItem value="confirmed">مؤكد</SelectItem>}
                  {!restrictedBranchManager && <SelectItem value="checked_in">تم تسجيل الدخول</SelectItem>}
                  {!restrictedBranchManager && <SelectItem value="checked_out">تم تسجيل الخروج</SelectItem>}
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleBulkStatusChange}>
                  تطبيق على {selectedIds.length} حجز
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {!restrictedBranchManager && <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              حذف
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>حذف الحجوزات</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                هل أنت متأكد من حذف {selectedIds.length} حجز؟ لا يمكن التراجع عن هذا الإجراء.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button variant="destructive" onClick={handleBulkDelete}>
                  حذف
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>}

        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <XCircle className="mr-2 h-4 w-4" />
          إلغاء التحديد
        </Button>
      </div>
    </div>
  )
}

