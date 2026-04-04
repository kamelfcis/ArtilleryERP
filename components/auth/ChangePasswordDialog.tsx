'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { KeyRound, Loader2 } from 'lucide-react'

export function ChangePasswordDialog() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function resetForm() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.email) {
      toast({ title: 'خطأ', description: 'لا يوجد بريد مرتبط بالحساب', variant: 'destructive' })
      return
    }
    if (newPassword.length < 8) {
      toast({ title: 'كلمة المرور قصيرة', description: 'يجب أن تكون 8 أحرف على الأقل', variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'غير متطابقة', description: 'تأكيد كلمة المرور لا يطابق الجديدة', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signErr) {
        toast({ title: 'كلمة المرور الحالية غير صحيحة', description: signErr.message, variant: 'destructive' })
        return
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updErr) {
        toast({ title: 'فشل التحديث', description: updErr.message, variant: 'destructive' })
        return
      }

      toast({ title: 'تم بنجاح', description: 'تم تغيير كلمة المرور' })
      resetForm()
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 h-9 border-dashed"
        onClick={() => setOpen(true)}
        title="تغيير كلمة المرور"
      >
        <KeyRound className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">تغيير كلمة المرور</span>
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                تغيير كلمة المرور
              </DialogTitle>
              <DialogDescription>
                أدخل كلمة المرور الحالية ثم كلمة المرور الجديدة.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="current-pw">كلمة المرور الحالية</Label>
                <Input
                  id="current-pw"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw">كلمة المرور الجديدة</Label>
                <Input
                  id="new-pw"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                إلغاء
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  'حفظ'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
