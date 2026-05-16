'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useGuests } from '@/lib/hooks/use-guests'
import { GuestForm } from '@/components/forms/GuestForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import {
  Search,
  UserPlus,
  Users,
  Home,
  Check,
  ChevronLeft,
  CalendarDays,
  FileText,
} from 'lucide-react'

interface GuestSelectionDialogProps {
  guests: any[]
  units: any[]
  initialUnitId?: string
  initialCheckIn?: string
  initialCheckOut?: string
  onCreateGuest: any
  onSelectGuest: (guestId: string, unitIds: string[], notes: string, checkIn: string, checkOut: string) => void
  onCancel: () => void
  newGuestCreated: string | null
  onGuestCreated: () => void
}

const GuestSelectionDialog = React.memo(function GuestSelectionDialog({
  guests: guestsProp,
  units,
  initialUnitId = '',
  initialCheckIn = '',
  initialCheckOut = '',
  onSelectGuest,
  onCancel,
  onGuestCreated,
}: GuestSelectionDialogProps) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [unitSearch, setUnitSearch] = useState('')
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>(initialUnitId ? [initialUnitId] : [])
  const [showNewGuestForm, setShowNewGuestForm] = useState(false)
  const [visibleCount, setVisibleCount] = useState(30)
  const [notes, setNotes] = useState('')
  const [checkInDraft, setCheckInDraft] = useState(initialCheckIn)
  const [checkOutDraft, setCheckOutDraft] = useState(initialCheckOut)
  const [pendingGuest, setPendingGuest] = useState<any | null>(null)
  const queryClient = useQueryClient()

  // Sync date drafts when dialog reopens with new dates
  useEffect(() => {
    setCheckInDraft(initialCheckIn)
    setCheckOutDraft(initialCheckOut)
  }, [initialCheckIn, initialCheckOut])

  const datesValid = useMemo(() => {
    if (!checkInDraft || !checkOutDraft) return false
    return new Date(checkOutDraft) > new Date(checkInDraft)
  }, [checkInDraft, checkOutDraft])

  const nights = useMemo(() => {
    if (!datesValid) return 0
    return Math.ceil((new Date(checkOutDraft).getTime() - new Date(checkInDraft).getTime()) / 86400000)
  }, [checkInDraft, checkOutDraft, datesValid])

  // Reset visible count when search changes so first paint stays cheap.
  useEffect(() => { setVisibleCount(30) }, [debouncedSearch])

  // Update selectedUnitIds and reset notes when initialUnitId changes (dialog reopens)
  useEffect(() => {
    if (initialUnitId) {
      setSelectedUnitIds([initialUnitId])
      setNotes('')
    }
  }, [initialUnitId])

  // Debounce the guest search so each keystroke doesn't fire a Supabase query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    )
  }

  // Server-side search across the full guests table.
  const { data: guestsData } = useGuests(debouncedSearch || undefined)
  const guests = guestsData || guestsProp

  const filteredUnits = useMemo(() => {
    if (!unitSearch) return units
    const q = unitSearch.toLowerCase()
    return units.filter(
      (unit) =>
        unit.unit_number?.toLowerCase().includes(q) ||
        unit.name?.toLowerCase().includes(q) ||
        unit.name_ar?.includes(unitSearch) ||
        unit.type?.toLowerCase().includes(q)
    )
  }, [units, unitSearch])

  const filteredGuests = useMemo(() => {
    if (!search) return guests
    const q = search.toLowerCase()
    const digits = search.replace(/[\u0660-\u0669]/g, (d) =>
      String(d.charCodeAt(0) - 0x0660)
    )
    return guests.filter(
      (g) =>
        g.first_name?.toLowerCase().includes(q) ||
        g.last_name?.toLowerCase().includes(q) ||
        g.first_name_ar?.includes(search) ||
        g.last_name_ar?.includes(search) ||
        g.phone?.includes(digits) ||
        g.email?.toLowerCase().includes(q) ||
        g.national_id?.includes(digits)
    )
  }, [guests, search])

  const visibleGuests = useMemo(() => filteredGuests.slice(0, visibleCount), [filteredGuests, visibleCount])
  const hasMore = filteredGuests.length > visibleCount

  if (pendingGuest) {
    const guestName = `${pendingGuest.first_name_ar || pendingGuest.first_name || ''} ${pendingGuest.last_name_ar || pendingGuest.last_name || ''}`.trim()
    const selectedUnits = units.filter(u => selectedUnitIds.includes(u.id))
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-cyan-950/20 p-5 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-700 to-teal-700 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                تأكيد الحجز
              </h3>
              <p className="text-xs text-muted-foreground">يرجى التحقق من البيانات قبل التأكيد</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'الضيف', value: guestName },
              { label: 'عدد الوحدات', value: `${selectedUnits.length} وحدة` },
              { label: 'تاريخ الدخول', value: checkInDraft },
              { label: 'تاريخ الخروج', value: checkOutDraft },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-white/70 dark:bg-slate-800/60 border border-emerald-100 dark:border-emerald-800/40 p-2.5 space-y-0.5">
                <div className="text-xs text-muted-foreground font-medium">{label}</div>
                <div className="font-bold text-sm truncate">{value}</div>
              </div>
            ))}
            <div className="col-span-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-200 dark:border-emerald-800/40 p-2.5 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">عدد الليالي</span>
              <span className="font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{nights} {nights === 1 ? 'ليلة' : 'ليالٍ'}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedUnits.map(u => (
              <span key={u.id} className="px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200/60 dark:border-blue-700/40">
                وحدة {u.unit_number}
              </span>
            ))}
          </div>

          {notes && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-xs">
              <span className="font-bold text-amber-800 dark:text-amber-300">ملاحظات: </span>
              <span className="text-amber-900 dark:text-amber-200">{notes}</span>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-3 border-t border-emerald-100 dark:border-emerald-800/50 bg-gradient-to-r from-white/95 via-emerald-50/80 to-teal-50/80 dark:from-slate-900/95 dark:via-emerald-950/60 dark:to-teal-950/60 backdrop-blur flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPendingGuest(null)}
            className="flex-1 h-10 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            رجوع
          </Button>
          <Button
            onClick={() => {
              onSelectGuest(pendingGuest.id, selectedUnitIds, notes, checkInDraft, checkOutDraft)
              setPendingGuest(null)
            }}
            className="flex-1 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold shadow-lg hover:shadow-xl transition-all hover:scale-[1.01]"
          >
            <Check className="h-4 w-4 ml-2" />
            تأكيد الحجز
          </Button>
        </div>
      </div>
    )
  }

  if (showNewGuestForm) {
    return (
      <div className="space-y-4 p-4">
        <div className="border rounded-xl p-5 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">إضافة ضيف جديد</h3>
          </div>
          <GuestForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['guests'] })
              setTimeout(() => {
                onGuestCreated()
                setShowNewGuestForm(false)
                toast({
                  title: 'نجح',
                  description: 'تم إنشاء الضيف بنجاح. يرجى اختياره من القائمة.',
                })
              }, 500)
            }}
          />
        </div>
        <Button variant="outline" onClick={() => setShowNewGuestForm(false)} className="w-full">
          رجوع
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* 1. Dates */}
      <section className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/80 to-green-50/60 dark:from-emerald-950/30 dark:to-green-950/20 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40 p-4 shadow-sm space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">١</span>
          <CalendarDays className="h-4 w-4 text-emerald-500" />
          تواريخ الحجز *
          {datesValid && (
            <span className="mr-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm">
              {nights} {nights === 1 ? 'ليلة' : 'ليالٍ'}
            </span>
          )}
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">تاريخ الدخول</Label>
            <Input
              type="date"
              value={checkInDraft}
              onChange={(e) => setCheckInDraft(e.target.value)}
              className="h-9 text-sm border-emerald-200 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500/20 bg-white/80 dark:bg-slate-900/60"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">تاريخ الخروج</Label>
            <Input
              type="date"
              value={checkOutDraft}
              onChange={(e) => setCheckOutDraft(e.target.value)}
              className="h-9 text-sm border-emerald-200 dark:border-emerald-700 focus:border-emerald-500 focus:ring-emerald-500/20 bg-white/80 dark:bg-slate-900/60"
            />
          </div>
        </div>
        {checkInDraft && checkOutDraft && !datesValid && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5">
            تاريخ الخروج يجب أن يكون بعد تاريخ الدخول
          </p>
        )}
      </section>

      {/* 2. Unit Selection */}
      <section className="rounded-2xl border border-blue-200/60 dark:border-blue-800/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 dark:from-blue-950/30 dark:to-indigo-950/20 ring-1 ring-blue-200/60 dark:ring-blue-800/40 p-4 shadow-sm space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">٢</span>
          <Home className="h-4 w-4 text-blue-500" />
          اختر الوحدة *
        </Label>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث عن وحدة... (رقم، اسم، نوع)"
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            className="pr-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={filteredUnits.length > 0 && filteredUnits.every(u => selectedUnitIds.includes(u.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUnitIds(prev => [...new Set([...prev, ...filteredUnits.map(u => u.id)])])
                } else {
                  const filteredIds = new Set(filteredUnits.map(u => u.id))
                  setSelectedUnitIds(prev => prev.filter(id => !filteredIds.has(id)))
                }
              }}
              className="w-4 h-4 accent-primary"
            />
            تحديد الكل
          </label>
          {selectedUnitIds.length > 0 && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {selectedUnitIds.length} وحدة محددة
            </span>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-xl p-2 bg-background/60">
          {filteredUnits.length > 0 ? (
            filteredUnits.map((unit) => {
              const isSelected = selectedUnitIds.includes(unit.id)
              return (
                <label
                  key={unit.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-accent ${isSelected ? 'bg-primary/5 ring-2 ring-primary border border-primary' : 'border border-transparent'}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleUnit(unit.id)}
                    className="w-4 h-4 accent-primary flex-shrink-0"
                  />
                  <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                    {unit.unit_number}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm truncate">{unit.name_ar || unit.name}</span>
                    <span className="text-xs text-muted-foreground">{unit.type}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-auto flex-shrink-0" />}
                </label>
              )
            })
          ) : (
            <p className="p-3 text-center text-sm text-muted-foreground">لا توجد وحدات مطابقة</p>
          )}
        </div>
      </section>

      {/* 3. Reservation Notes */}
      <section className="rounded-2xl border border-amber-200/60 dark:border-amber-800/50 bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-950/30 dark:to-orange-950/20 ring-1 ring-amber-200/60 dark:ring-amber-800/40 p-4 shadow-sm space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">٣</span>
          <FileText className="h-4 w-4 text-amber-500" />
          ملاحظات الحجز
          <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>
        </Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أضف أي ملاحظات خاصة بالحجز..."
          rows={2}
          className="resize-none text-sm"
        />
      </section>

      {/* 4. Guest Search & List */}
      <section className="rounded-2xl border border-purple-200/60 dark:border-purple-800/50 bg-gradient-to-br from-purple-50/80 to-fuchsia-50/60 dark:from-purple-950/30 dark:to-fuchsia-950/20 ring-1 ring-purple-200/60 dark:ring-purple-800/40 p-4 shadow-sm space-y-3">
        <Label className="flex items-center gap-2 text-sm font-semibold text-purple-800 dark:text-purple-300">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">٤</span>
          <Users className="h-4 w-4 text-purple-500" />
          ابحث عن الضيف
        </Label>
        {selectedUnitIds.length === 0 && (
          <p className="text-xs text-muted-foreground bg-muted/40 border border-dashed border-border rounded-lg px-3 py-2">
            يرجى اختيار وحدة أولاً قبل اختيار الضيف
          </p>
        )}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف أو البريد..."
            className="pr-9 h-9 text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-56 overflow-y-auto space-y-1">
          {visibleGuests.length > 0 ? (
            <>
              {visibleGuests.map((guest) => {
                const name = `${guest.first_name_ar || guest.first_name || ''} ${guest.last_name_ar || guest.last_name || ''}`.trim()
                const sub = guest.phone || guest.email || ''
                const disabled = selectedUnitIds.length === 0
                return (
                  <div
                    key={guest.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    onClick={() => {
                      if (disabled) return
                      if (!datesValid || selectedUnitIds.length === 0) {
                        toast({ title: 'تحقق من الإدخال', description: 'تأكد من اختيار وحدة وتاريخ صالح', variant: 'destructive' })
                        return
                      }
                      setPendingGuest(guest)
                    }}
                    onKeyDown={(e) => {
                      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        if (!datesValid || selectedUnitIds.length === 0) return
                        setPendingGuest(guest)
                      }
                    }}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-card' : 'cursor-pointer bg-card hover:bg-accent hover:border-primary/40 active:scale-[0.99]'}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{name}</div>
                      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
                      {guest.military_rank_ar && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
                          {guest.military_rank_ar}
                        </span>
                      )}
                    </div>
                    <ChevronLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                )
              })}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + 30)}
                  className="w-full py-2 text-sm text-primary hover:underline font-medium"
                >
                  عرض المزيد ({filteredGuests.length - visibleCount} متبقي)
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{search ? 'لا توجد نتائج' : 'لا يوجد ضيوف'}</p>
            </div>
          )}
        </div>
      </section>

      {/* Sticky footer */}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-3 mt-1 border-t border-blue-100/80 dark:border-blue-800/50 bg-gradient-to-r from-white/95 via-blue-50/80 to-indigo-50/80 dark:from-slate-900/95 dark:via-blue-950/60 dark:to-indigo-950/60 backdrop-blur flex gap-2">
        <Button
          variant="outline"
          onClick={() => setShowNewGuestForm(true)}
          className="flex-1 h-9 text-sm gap-2 border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300"
        >
          <UserPlus className="h-4 w-4" />
          إنشاء ضيف جديد
        </Button>
        <Button variant="ghost" onClick={onCancel} className="h-9 text-sm px-4 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400">
          إلغاء
        </Button>
      </div>
    </div>
  )
})

export default GuestSelectionDialog
