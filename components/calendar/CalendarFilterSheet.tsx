'use client'

import React from 'react'
import { motion } from 'framer-motion'
import FullCalendar from '@fullcalendar/react'
import { Filter, Calendar, Building2, Home, RefreshCw, Sparkles, Check, CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Bed, Crown, Trees, Layers, Castle } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarViewSwitcher } from '@/components/calendar/CalendarViewSwitcher'
import { RESERVATION_STATUSES } from '@/lib/constants'
import { getStatusColor } from '@/lib/utils/calendar-helpers'

interface Props {
  filtersOpen: boolean
  setFiltersOpen: (open: boolean) => void
  selectedLocation: string
  setSelectedLocation: (v: string) => void
  selectedTypes: string[]
  setSelectedTypes: (v: string[] | ((prev: string[]) => string[])) => void
  selectedUnit: string
  setSelectedUnit: (v: string) => void
  selectedStatus: string
  setSelectedStatus: (v: string) => void
  rangeStart: string
  setRangeStart: (v: string) => void
  rangeEnd: string
  setRangeEnd: (v: string) => void
  shiftRange: (days: number) => void
  getTodayString: () => string
  locations: any[] | undefined
  units: any[] | undefined
  availableUnitTypes: string[]
  isStaffOnly: boolean
  currentStaff: any
  isUpdatingStatuses: boolean
  updateUnitStatuses: () => void
  currentView: 'timeline' | 'day' | 'week' | 'month' | 'resourceTimeline'
  setCurrentView: (v: 'timeline' | 'day' | 'week' | 'month' | 'resourceTimeline') => void
  calendarRef: React.RefObject<FullCalendar | null>
}

export function CalendarFilterSheet({
  filtersOpen,
  setFiltersOpen,
  selectedLocation,
  setSelectedLocation,
  selectedTypes,
  setSelectedTypes,
  selectedUnit,
  setSelectedUnit,
  selectedStatus,
  setSelectedStatus,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd,
  shiftRange,
  getTodayString,
  locations,
  units,
  availableUnitTypes,
  isStaffOnly,
  currentStaff,
  isUpdatingStatuses,
  updateUnitStatuses,
  currentView,
  setCurrentView,
  calendarRef,
}: Props) {
  return (
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
      {/* FAB - Floating Action Button */}
      <SheetTrigger asChild>
        <motion.div
          className="fixed bottom-6 right-6 z-50 no-print"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Button
              className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all border-2 border-white/20 backdrop-blur-md relative overflow-hidden group"
              size="icon"
              title="فتح الفلاتر"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Filter className="h-6 w-6 relative z-10" />
              {(selectedLocation !== 'all' || selectedTypes.length > 0 || selectedUnit !== 'all' || selectedStatus !== 'all') && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg z-20" />
              )}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-indigo-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl" />
            </Button>
          </motion.div>
        </motion.div>
      </SheetTrigger>

      <SheetContent side="right" className="w-[380px] sm:max-w-md overflow-y-auto bg-gradient-to-br from-white via-blue-50/50 to-purple-50/50 dark:from-slate-900 dark:via-blue-950/30 dark:to-purple-950/30">
        <SheetHeader className="pb-4 border-b border-blue-200/50 dark:border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <SheetTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                فلاتر الحجز السريع
              </SheetTitle>
              <SheetDescription className="text-xs">
                تصفية وإدارة عرض التقويم
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 py-5">
          {/* Location Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              الموقع
            </Label>
            {!isStaffOnly ? (
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-full h-10 bg-white/80 dark:bg-slate-800/80 border-2 border-blue-200/50 dark:border-blue-800/50 shadow-md hover:shadow-lg transition-all hover:border-blue-400 dark:hover:border-blue-600">
                  <SelectValue placeholder="الموقع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المواقع</SelectItem>
                  {locations?.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="px-3 py-2 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md border-2 border-blue-300 dark:border-blue-700 flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" />
                {currentStaff?.location?.name_ar || currentStaff?.location?.name || 'موقعي'}
              </div>
            )}
          </div>

          {/* Unit Type Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Filter className="w-4 h-4 text-purple-500" />
              نوع الوحدة
            </Label>
            <div className="space-y-1 p-2 rounded-lg border-2 border-purple-200/50 dark:border-purple-800/50 bg-white/80 dark:bg-slate-800/80">
              <button
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${selectedTypes.length === 0 ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                onClick={() => setSelectedTypes([])}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedTypes.length === 0 ? 'bg-purple-500 border-purple-500' : 'border-slate-300 dark:border-slate-600'}`}>
                  {selectedTypes.length === 0 && <Check className="w-3 h-3 text-white" />}
                </div>
                <Building2 className="w-4 h-4 text-gray-500" />
                <span>جميع الأنواع</span>
              </button>
              {([
                { value: 'room', label: 'غرفة', icon: Bed, color: 'text-blue-500' },
                { value: 'suite', label: 'سويت', icon: Crown, color: 'text-red-500' },
                { value: 'chalet', label: 'شاليه', icon: Trees, color: 'text-green-500' },
                { value: 'duplex', label: 'دوبلكس', icon: Layers, color: 'text-amber-500' },
                { value: 'villa', label: 'فيلا', icon: Castle, color: 'text-red-500' },
                { value: 'apartment', label: 'شقة', icon: Building2, color: 'text-cyan-500' },
              ] as const).filter(t => availableUnitTypes.includes(t.value)).map(typeOption => {
                const isSelected = selectedTypes.includes(typeOption.value)
                const IconComp = typeOption.icon
                return (
                  <button
                    key={typeOption.value}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${isSelected ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    onClick={() => {
                      setSelectedTypes(prev =>
                        isSelected
                          ? prev.filter(t => t !== typeOption.value)
                          : [...prev, typeOption.value]
                      )
                    }}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-purple-500 border-purple-500' : 'border-slate-300 dark:border-slate-600'}`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <IconComp className={`w-4 h-4 ${typeOption.color}`} />
                    <span>{typeOption.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Unit Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Home className="w-4 h-4 text-cyan-500" />
              الوحدة
            </Label>
            <Select value={selectedUnit} onValueChange={setSelectedUnit}>
              <SelectTrigger className="w-full h-10 bg-white/80 dark:bg-slate-800/80 border-2 border-cyan-200/50 dark:border-cyan-800/50 shadow-md hover:shadow-lg transition-all hover:border-cyan-400 dark:hover:border-cyan-600">
                <SelectValue placeholder="الوحدة">
                  {selectedUnit !== 'all' ? (
                    <span className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-cyan-500" />
                      <span className="text-sm font-semibold">
                        {units?.find(u => u.id === selectedUnit)?.unit_number} - {units?.find(u => u.id === selectedUnit)?.name_ar || units?.find(u => u.id === selectedUnit)?.name}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm">جميع الوحدات</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span>جميع الوحدات</span>
                  </div>
                </SelectItem>
                {units?.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                        {unit.unit_number}
                      </div>
                      <span className="font-medium">{unit.name_ar || unit.name}</span>
                      <span className="text-xs text-muted-foreground">({unit.type})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              حالة الحجز
            </Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full h-10 bg-white/80 dark:bg-slate-800/80 border-2 border-emerald-200/50 dark:border-emerald-800/50 shadow-md hover:shadow-lg transition-all hover:border-emerald-400 dark:hover:border-emerald-600">
                <SelectValue placeholder="الحالة">
                  {selectedStatus !== 'all' ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shadow-sm border border-white/70 inline-block"
                        style={{ backgroundColor: getStatusColor(selectedStatus) }}
                      />
                      <span className="text-sm font-semibold">{RESERVATION_STATUSES[selectedStatus as keyof typeof RESERVATION_STATUSES]}</span>
                    </span>
                  ) : (
                    <span className="text-sm">جميع الحالات</span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-slate-400 to-slate-500 shadow-sm border border-white/70" />
                    <span className="text-sm font-semibold">جميع الحالات</span>
                  </div>
                </SelectItem>
                {Object.entries(RESERVATION_STATUSES).map(([status, label]) => {
                  const statusColor = getStatusColor(status)
                  return (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shadow-sm border border-white/70"
                          style={{ backgroundColor: statusColor }}
                        />
                        <span className="text-sm font-semibold">{label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-green-500" />
              نطاق التاريخ
            </Label>
            <div className="space-y-3 p-3 rounded-lg border-2 border-green-200/50 dark:border-green-800/50 bg-white/80 dark:bg-slate-800/80">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => shiftRange(-1)}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 dark:from-blue-900/40 dark:to-indigo-900/40 dark:hover:from-blue-800/60 dark:hover:to-indigo-800/60 text-blue-700 dark:text-blue-400 shadow-sm"
                  title="اليوم السابق"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-xs font-bold text-slate-500 flex-1 text-center">التنقل يوم</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => shiftRange(1)}
                  className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 dark:from-blue-900/40 dark:to-indigo-900/40 dark:hover:from-blue-800/60 dark:hover:to-indigo-800/60 text-blue-700 dark:text-blue-400 shadow-sm"
                  title="اليوم التالي"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-green-700 dark:text-green-400 whitespace-nowrap w-8">من</Label>
                <Input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="h-10 flex-1 bg-white/80 dark:bg-slate-800/80 border-2 border-green-200/50 dark:border-green-800/50 shadow-sm hover:shadow-md transition-all hover:border-green-400 dark:hover:border-green-600 text-sm font-medium"
                />
                {rangeStart !== getTodayString() && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setRangeStart(getTodayString())
                      localStorage.removeItem('calendar-range-start')
                    }}
                    className="h-8 w-8 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-800/60 text-green-700 dark:text-green-400 shadow-sm flex-shrink-0"
                    title="إعادة تعيين إلى اليوم"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold text-orange-700 dark:text-orange-400 whitespace-nowrap w-8">إلى</Label>
                <Input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="h-10 flex-1 bg-white/80 dark:bg-slate-800/80 border-2 border-orange-200/50 dark:border-orange-800/50 shadow-sm hover:shadow-md transition-all hover:border-orange-400 dark:hover:border-orange-600 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* Actions: Refresh + View Switcher */}
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-500" />
              الإجراءات والعرض
            </Label>
            <div className="flex flex-col gap-3">
              <Button
                onClick={updateUnitStatuses}
                disabled={isUpdatingStatuses}
                className="h-10 w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all border-0 text-sm"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isUpdatingStatuses ? 'animate-spin' : ''}`}
                />
                {isUpdatingStatuses ? 'جاري التحديث...' : 'تحديث'}
              </Button>
              <CalendarViewSwitcher
                currentView={currentView}
                onViewChange={(view) => {
                  setCurrentView(view)
                  if (calendarRef.current) {
                    const calendarApi = calendarRef.current.getApi()
                    if (view === 'resourceTimeline') {
                      calendarApi.changeView('resourceTimelineCustom')
                    } else if (view === 'day') {
                      calendarApi.changeView('timeGridDay')
                    } else if (view === 'week') {
                      calendarApi.changeView('timeGridWeek')
                    } else if (view === 'month') {
                      calendarApi.changeView('dayGridMonth')
                    } else {
                      calendarApi.changeView('resourceTimelineCustom')
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Status Legend */}
          <div className="space-y-2 pt-4 border-t border-blue-200/50 dark:border-blue-800/50">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg" />
              مفتاح الحالات
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(RESERVATION_STATUSES).map(([status, label]) => {
                const statusColor = getStatusColor(status)
                return (
                  <div
                    key={status}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-800 dark:to-slate-900/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                  >
                    <div
                      className="w-4 h-4 rounded-full shadow-sm border-2 border-white/70"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
