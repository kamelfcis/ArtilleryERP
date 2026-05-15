'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { db, type OutboxEntry } from '@/lib/offline/db'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { AlertTriangle, CheckCircle, Server, Smartphone } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Field label map (Arabic)
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  check_in_date: 'تاريخ الدخول',
  check_out_date: 'تاريخ الخروج',
  status: 'الحالة',
  total_amount: 'المبلغ الكلي',
  paid_amount: 'المبلغ المدفوع',
  discount_amount: 'الخصم',
  notes: 'ملاحظات',
  adults: 'بالغين',
  children: 'أطفال',
  unit_id: 'الوحدة',
  guest_id: 'الضيف',
  source: 'المصدر',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'معلق',
  confirmed: 'مؤكد',
  checked_in: 'تسجيل دخول',
  checked_out: 'تسجيل خروج',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
}

function formatValue(key: string, value: unknown): string {
  if (value == null || value === '') return '—'
  if (key === 'status') return STATUS_LABELS[String(value)] ?? String(value)
  if (typeof value === 'number') return value.toLocaleString('ar-EG')
  return String(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff row
// ─────────────────────────────────────────────────────────────────────────────

interface DiffRowProps {
  field: string
  localValue: unknown
  serverValue: unknown
  changed: boolean
}

function DiffRow({ field, localValue, serverValue, changed }: DiffRowProps) {
  const label = FIELD_LABELS[field] ?? field
  return (
    <tr className={changed ? 'bg-amber-50 dark:bg-amber-950/30' : undefined}>
      <td className="py-2 px-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </td>
      <td className={`py-2 px-3 text-sm text-right ${changed ? 'text-blue-700 dark:text-blue-400 font-medium' : ''}`}>
        {formatValue(field, localValue)}
      </td>
      <td className={`py-2 px-3 text-sm text-right ${changed ? 'text-red-700 dark:text-red-400 font-medium' : ''}`}>
        {formatValue(field, serverValue)}
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict card
// ─────────────────────────────────────────────────────────────────────────────

interface ConflictCardProps {
  entry: OutboxEntry
  onResolved: () => void
}

function ConflictCard({ entry, onResolved }: ConflictCardProps) {
  const [loading, setLoading] = useState(false)

  const serverVersion = (entry.serverVersion ?? {}) as Record<string, unknown>
  const localVersion = (entry.payload ?? {}) as Record<string, unknown>

  // Compute all differing fields.
  const allKeys = Array.from(
    new Set([...Object.keys(localVersion), ...Object.keys(serverVersion)])
  ).filter((k) => !['id', 'created_at', 'updated_at', 'created_by_user_id'].includes(k))

  const changed = allKeys.filter(
    (k) => String(localVersion[k] ?? '') !== String(serverVersion[k] ?? '')
  )

  async function keepMine() {
    setLoading(true)
    try {
      const { id, ...updates } = localVersion as any
      const targetId = id ?? entry.localId
      const { error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', targetId)
      if (error) throw error

      await db.outbox.delete(entry.id!)
      toast({ title: 'تم حفظ نسختك', description: 'تم تطبيق التغييرات المحلية بنجاح.' })
      onResolved()
    } catch (err: any) {
      toast({ title: 'فشل الحفظ', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function useServer() {
    setLoading(true)
    try {
      await db.outbox.delete(entry.id!)
      toast({ title: 'تم تجاهل التغييرات المحلية', description: 'سيتم استخدام بيانات الخادم.' })
      onResolved()
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const actionLabel =
    entry.action === 'insert' ? 'إضافة' : entry.action === 'update' ? 'تعديل' : 'حذف'

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="font-semibold text-sm">
          تعارض في عملية {actionLabel}
        </span>
        {entry.lastError && (
          <Badge variant="destructive" className="text-xs ml-auto">
            {entry.lastError.slice(0, 60)}
          </Badge>
        )}
      </div>

      {/* Diff table */}
      {changed.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 px-3 text-right font-medium">الحقل</th>
                <th className="py-2 px-3 text-right font-medium">
                  <span className="flex items-center gap-1 justify-end">
                    <Smartphone className="h-3 w-3" /> نسختك
                  </span>
                </th>
                <th className="py-2 px-3 text-right font-medium">
                  <span className="flex items-center gap-1 justify-end">
                    <Server className="h-3 w-3" /> الخادم
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {allKeys.map((k) => (
                <DiffRow
                  key={k}
                  field={k}
                  localValue={localVersion[k]}
                  serverValue={serverVersion[k]}
                  changed={changed.includes(k)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          لا توجد فروق مرئية. قد يكون التعارض بسبب قيد في قاعدة البيانات.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end px-4 py-3 border-t bg-muted/30">
        <Button
          variant="outline"
          size="sm"
          onClick={useServer}
          disabled={loading}
          className="gap-1"
        >
          <Server className="h-3.5 w-3.5" />
          استخدم نسخة الخادم
        </Button>
        <Button
          size="sm"
          onClick={keepMine}
          disabled={loading}
          className="gap-1"
        >
          <Smartphone className="h-3.5 w-3.5" />
          احتفظ بنسختي
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main sheet component
// ─────────────────────────────────────────────────────────────────────────────

interface ConflictResolutionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConflictResolutionSheet({ open, onOpenChange }: ConflictResolutionSheetProps) {
  const [conflicts, setConflicts] = useState<OutboxEntry[]>([])

  async function loadConflicts() {
    try {
      const rows = await db.outbox.where('conflict').equals(1).toArray()
      setConflicts(rows)
    } catch {
      setConflicts([])
    }
  }

  useEffect(() => {
    if (open) loadConflicts()
  }, [open])

  function handleResolved() {
    loadConflicts()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] overflow-y-auto rounded-t-2xl"
        dir="rtl"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            حل تعارضات المزامنة
          </SheetTitle>
          <SheetDescription>
            تعذّر تطبيق التغييرات التالية تلقائياً. اختر النسخة التي تريد الإبقاء عليها.
          </SheetDescription>
        </SheetHeader>

        {conflicts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <p className="font-medium">لا توجد تعارضات</p>
            <p className="text-sm">جميع التغييرات تمت مزامنتها بنجاح.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {conflicts.map((c) => (
              <ConflictCard key={c.id} entry={c} onResolved={handleResolved} />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
