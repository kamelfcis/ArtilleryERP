'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { usePaymentTransactions, useCreatePaymentTransaction, useDeletePaymentTransaction } from '@/lib/hooks/use-payments'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { Plus, Receipt, History, Trash2, Percent, X } from 'lucide-react'
import { Reservation } from '@/lib/types/database'

interface PaymentTrackerProps {
  reservation: Reservation
}

export function PaymentTracker({ reservation }: PaymentTrackerProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'online'>('cash')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [transactionRef, setTransactionRef] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountSaving, setDiscountSaving] = useState(false)
  const queryClient = useQueryClient()
  const { data: transactions } = usePaymentTransactions(reservation.id)
  const createPayment = useCreatePaymentTransaction()
  const deletePayment = useDeletePaymentTransaction()

  async function handleAddPayment() {
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'خطأ',
        description: 'المبلغ غير صحيح',
        variant: 'destructive',
      })
      return
    }

    // Calculate current paid amount from transactions (more accurate than reservation.paid_amount)
    const currentPaidAmount = transactions
      ?.filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0) || reservation.paid_amount || 0
    
    const newPaidAmount = currentPaidAmount + amount
    const totalAfterDiscount = reservation.total_amount - (reservation.discount_amount || 0)
    
    if (newPaidAmount > totalAfterDiscount) {
      toast({
        title: 'خطأ',
        description: 'المبلغ المدفوع لا يمكن أن يتجاوز المبلغ الإجمالي بعد الخصم',
        variant: 'destructive',
      })
      return
    }

    try {
      await createPayment.mutateAsync({
        reservation_id: reservation.id,
        amount,
        payment_method: paymentMethod,
        transaction_reference: transactionRef || undefined,
        notes_ar: paymentNotes || undefined,
      })

      toast({
        title: 'نجح',
        description: 'تم تسجيل الدفعة بنجاح',
      })
      // Invalidate reservation query to refresh the screen
      queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] })
      setPaymentDialogOpen(false)
      setPaymentAmount('')
      setPaymentNotes('')
      setTransactionRef('')
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تسجيل الدفعة',
        variant: 'destructive',
      })
    }
  }

  const remaining = reservation.total_amount - reservation.paid_amount - reservation.discount_amount

  async function handleDeletePayment(transactionId: string) {
    if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) {
      return
    }

    try {
      await deletePayment.mutateAsync(transactionId)
      toast({
        title: 'نجح',
        description: 'تم حذف الدفعة بنجاح',
      })
      // Invalidate reservation query to refresh the screen
      queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف الدفعة',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>تتبع المدفوعات</CardTitle>
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                إضافة دفعة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة دفعة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">المبلغ (ر.س) *</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remaining}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`الحد الأقصى: ${formatCurrency(remaining)}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-date">تاريخ الدفعة *</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-method">طريقة الدفع *</Label>
                  <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقدي</SelectItem>
                      <SelectItem value="card">بطاقة</SelectItem>
                      <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                      <SelectItem value="online">دفع إلكتروني</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transaction-ref">رقم المرجع (اختياري)</Label>
                  <Input
                    id="transaction-ref"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="رقم المرجع أو رقم المعاملة"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-notes">ملاحظات</Label>
                  <Input
                    id="payment-notes"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="ملاحظات حول الدفعة..."
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setPaymentDialogOpen(false)}
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleAddPayment}
                    disabled={createPayment.isPending || !paymentAmount}
                  >
                    {createPayment.isPending ? 'جاري الحفظ...' : 'حفظ'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">المبلغ الإجمالي</p>
            <p className="text-2xl font-bold">{formatCurrency(reservation.total_amount)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">المبلغ المدفوع</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(reservation.paid_amount)}
            </p>
          </div>
        </div>
        {reservation.discount_amount > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">الخصم</p>
            <p className="text-lg font-semibold text-orange-600">
              -{formatCurrency(reservation.discount_amount)}
            </p>
          </div>
        )}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-1">المتبقي</p>
          <p className={`text-2xl font-bold ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(Math.max(0, remaining))}
          </p>
          {remaining <= 0 && (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <Receipt className="h-4 w-4" />
              تم السداد بالكامل
            </p>
          )}
        </div>
        <div className="w-full bg-muted rounded-full h-3 mt-4">
          <div
            className="bg-primary h-3 rounded-full transition-all"
            style={{
              width: `${Math.min(100, ((reservation.paid_amount + reservation.discount_amount) / reservation.total_amount) * 100)}%`,
            }}
          />
        </div>

        {transactions && transactions.length > 0 && (
          <div className="pt-4 border-t mt-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4" />
              <span className="text-sm font-medium">سجل المدفوعات</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-2 bg-muted rounded text-sm gap-2"
                >
                  <div className="flex-1">
                    <p className="font-medium">{formatCurrency(transaction.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(transaction.processed_at || transaction.created_at)} • {transaction.payment_method}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                      transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {transaction.status}
                    </span>
                    {transaction.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeletePayment(transaction.id)}
                        disabled={deletePayment.isPending}
                        title="حذف الدفعة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t mt-4 space-y-3">
          <Label className="flex items-center gap-2 font-medium">
            <Percent className="h-4 w-4 text-orange-500" />
            خصم بالنسبة المئوية
          </Label>

          {reservation.discount_amount > 0 ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-400 font-medium">الخصم المطبق</p>
                <p className="text-lg font-bold text-orange-800 dark:text-orange-300">
                  -{formatCurrency(reservation.discount_amount)}
                  <span className="text-sm font-normal text-orange-600 dark:text-orange-400 mr-2">
                    ({Math.round((reservation.discount_amount / reservation.total_amount) * 100)}%)
                  </span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={discountSaving}
                onClick={async () => {
                  setDiscountSaving(true)
                  try {
                    await supabase
                      .from('reservations')
                      .update({ discount_amount: 0 })
                      .eq('id', reservation.id)
                    queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] })
                    toast({ title: 'نجح', description: 'تم حذف الخصم' })
                    setDiscountPercent('')
                  } catch {
                    toast({ title: 'خطأ', description: 'فشل في حذف الخصم', variant: 'destructive' })
                  } finally {
                    setDiscountSaving(false)
                  }
                }}
              >
                <X className="h-4 w-4 mr-1" />
                حذف الخصم
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="أدخل نسبة الخصم %"
                    dir="ltr"
                    className="text-center"
                  />
                </div>
                <Button
                  onClick={async () => {
                    const pct = parseFloat(discountPercent)
                    if (isNaN(pct) || pct <= 0 || pct > 100) {
                      toast({ title: 'خطأ', description: 'يرجى إدخال نسبة صحيحة بين ١ و ١٠٠', variant: 'destructive' })
                      return
                    }
                    const discountAmount = Math.round((reservation.total_amount * pct / 100) * 100) / 100
                    setDiscountSaving(true)
                    try {
                      await supabase
                        .from('reservations')
                        .update({ discount_amount: discountAmount })
                        .eq('id', reservation.id)
                      queryClient.invalidateQueries({ queryKey: ['reservation', reservation.id] })
                      toast({ title: 'نجح', description: `تم تطبيق خصم ${pct}% = ${formatCurrency(discountAmount)}` })
                      setDiscountPercent('')
                    } catch {
                      toast({ title: 'خطأ', description: 'فشل في تطبيق الخصم', variant: 'destructive' })
                    } finally {
                      setDiscountSaving(false)
                    }
                  }}
                  disabled={discountSaving || !discountPercent}
                  variant="outline"
                  className="border-orange-300 hover:border-orange-500 hover:bg-orange-50"
                >
                  <Percent className="mr-1 h-4 w-4" />
                  تطبيق الخصم
                </Button>
              </div>
              {discountPercent && parseFloat(discountPercent) > 0 && parseFloat(discountPercent) <= 100 && (
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  سيتم خصم: <span className="font-bold">{formatCurrency(Math.round((reservation.total_amount * parseFloat(discountPercent) / 100) * 100) / 100)}</span> من {formatCurrency(reservation.total_amount)}
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

