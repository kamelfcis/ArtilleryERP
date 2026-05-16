'use client'

import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import FullCalendar from '@fullcalendar/react'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import arLocale from '@fullcalendar/core/locales/ar'
import type { CalendarEvent as CalendarEventRow } from '@/lib/types/calendar'
import type { UserRole } from '@/lib/types/database'
import { getUnitTypeIconData, getShakkaRoomIconGradient } from '@/lib/utils/calendar-helpers'

interface Props {
  resources: any[]
  events: any[]
  rangeStart: string
  rangeEnd: string
  calendarDirection: 'rtl' | 'ltr'
  currentView: string
  pendingIds: Set<string>
  hasRole: (role: UserRole) => boolean
  elevatedOps: boolean
  staffByUserId: Map<string, string>
  onDateSelect: (info: any) => void
  onEventClick: (info: any) => void
  onEventDrop: (info: any) => void
  onEventResize: (info: any) => void
  setReservationToDelete: (r: CalendarEventRow | null) => void
  setDeleteDialogOpen: (open: boolean) => void
  setBlockToDelete: (b: any) => void
  setBlockDeleteDialogOpen: (open: boolean) => void
  setChangeUnitReservation: (r: CalendarEventRow | null) => void
  setChangeUnitDialogOpen: (open: boolean) => void
  setHeaderExpanded: (v: boolean) => void
}

const FullCalendarWidget = React.memo(React.forwardRef<FullCalendar, Props>(function FullCalendarWidget({
  resources,
  events,
  rangeStart,
  rangeEnd,
  calendarDirection,
  currentView,
  pendingIds,
  hasRole,
  elevatedOps,
  staffByUserId,
  onDateSelect,
  onEventClick,
  onEventDrop,
  onEventResize,
  setReservationToDelete,
  setDeleteDialogOpen,
  setBlockToDelete,
  setBlockDeleteDialogOpen,
  setChangeUnitReservation,
  setChangeUnitDialogOpen,
  setHeaderExpanded,
}, ref) {
  const calendarContainerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollTopRef = useRef(0)

  const saveScrollPosition = () => {
    const container = calendarContainerRef.current
    if (!container) return
    const scroller = container.querySelector('.fc-scroller-liquid-absolute, .fc-scroller')
    if (scroller) {
      sessionStorage.setItem('calendar-scroll-left', String((scroller as HTMLElement).scrollLeft))
    }
  }

  // Scroll to today (or restore saved position) when calendar mounts
  useEffect(() => {
    const scrollToToday = () => {
      const calendarEl = (ref as React.RefObject<FullCalendar>)?.current
      if (!calendarEl) return

      setTimeout(() => {
        const container = calendarContainerRef.current
        if (!container) return

        const scrollers = container.querySelectorAll('.fc-scroller-liquid-absolute, .fc-scroller')

        const savedScroll = sessionStorage.getItem('calendar-scroll-left')
        if (savedScroll !== null) {
          sessionStorage.removeItem('calendar-scroll-left')
          const scrollLeft = parseFloat(savedScroll)
          scrollers.forEach(el => {
            const scroller = el as HTMLElement
            if (scroller.scrollWidth > scroller.clientWidth) {
              scroller.scrollLeft = scrollLeft
            }
          })
          return
        }

        const today = new Date()
        const viewStart = new Date(rangeStart)
        const viewEnd = new Date(rangeEnd)
        const totalDays = Math.round((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24))
        if (totalDays <= 0) return

        const dayOffset = Math.round((today.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24))
        const fraction = Math.max(0, Math.min(1, dayOffset / totalDays))

        scrollers.forEach(el => {
          const scroller = el as HTMLElement
          if (scroller.scrollWidth <= scroller.clientWidth) return
          const target = fraction * scroller.scrollWidth - scroller.clientWidth * 0.25
          scroller.scrollLeft = Math.max(0, target)
        })
      }, 400)
    }

    const timer = setTimeout(scrollToToday, 200)
    return () => clearTimeout(timer)
  }, [resources.length, rangeStart, rangeEnd, ref])

  // Auto-collapse header on scroll down, expand on scroll up
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const handleScroll = () => {
      const currentScrollTop = el.scrollTop
      const delta = currentScrollTop - lastScrollTopRef.current

      if (delta > 30) {
        setHeaderExpanded(false)
        lastScrollTopRef.current = currentScrollTop
      } else if (delta < -30) {
        setHeaderExpanded(true)
        lastScrollTopRef.current = currentScrollTop
      }
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [setHeaderExpanded])

  const handleEventClickWithScroll = (info: any) => {
    saveScrollPosition()
    onEventClick(info)
  }

  return (
    <motion.div
      ref={scrollContainerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="flex-1 overflow-auto px-2 pb-2 min-h-0"
    >
      <div
        ref={calendarContainerRef}
        className="h-full min-h-[600px] bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-slate-900 dark:via-blue-950/20 dark:to-purple-950/20 shadow-xl overflow-hidden backdrop-blur-xl relative rounded-xl"
      >
        <div className="p-2 relative z-10">
          <FullCalendar
            key="main-calendar"
            ref={ref}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, resourceTimelinePlugin]}
            initialView={currentView === 'resourceTimeline' ? 'resourceTimelineCustom' :
                       currentView === 'month' ? 'dayGridMonth' :
                       currentView === 'day' ? 'timeGridDay' :
                       currentView === 'week' ? 'timeGridWeek' :
                       'resourceTimelineCustom'}
            initialDate={new Date()}
            headerToolbar={false}
            nowIndicator={true}
            stickyHeaderDates={true}
            scrollTime="00:00:00"
            scrollTimeReset={false}
            direction={calendarDirection}
            locale={arLocale}
            resources={resources}
            events={events}
            editable={true}
            eventResourceEditable={true}
            selectable={true}
            selectMirror={true}
            selectAllow={(selectInfo) => {
              const ms = selectInfo.end.getTime() - selectInfo.start.getTime()
              const nights = Math.max(0, Math.round(ms / 86400000))
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('calendar:drag-nights', { detail: { nights } }))
              }
              return true
            }}
            unselect={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('calendar:drag-nights', { detail: { nights: 0 } }))
              }
            }}
            dayMaxEvents={true}
            resourceAreaWidth="240px"
            resourceAreaHeaderContent={
              <div className="text-center w-full font-bold text-3xl">الوحدة</div>
            }
            resourceOrder="orderno,title"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            slotDuration="24:00:00"
            slotLabelInterval="24:00:00"
            slotLabelFormat={{
              weekday: 'long',
              day: 'numeric',
              month: 'short',
            }}
            views={{
              resourceTimelineCustom: {
                type: 'resourceTimeline',
                visibleRange: {
                  start: rangeStart,
                  end: rangeEnd,
                },
                slotDuration: { days: 1 },
                slotLabelInterval: { days: 1 },
                scrollTime: '00:00:00',
              },
            }}
            slotMinWidth={80}
            slotLabelContent={(arg) => {
              const date = arg.date
              if (!date) return { html: '' }
              const dayName = date.toLocaleDateString('ar-EG', { weekday: 'short' })
              const dayNum = date.getDate()
              const monthName = date.toLocaleDateString('ar-EG', { month: 'short' })
              const isToday = new Date().toDateString() === date.toDateString()
              const isFirstOfMonth = dayNum === 1

              return {
                html: `
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2; padding: 2px 0; gap: 1px;">
                    <span style="font-size: 12px; font-weight: 600; color: ${isToday ? '#78350f' : '#64748b'}; letter-spacing: 0.02em;">${dayName}</span>
                    <span style="font-size: 20px; font-weight: 900; color: ${isToday ? '#92400e' : isFirstOfMonth ? '#1d4ed8' : '#1e293b'};">${dayNum}</span>
                    <span style="font-size: 12px; font-weight: 700; color: ${isToday ? '#a16207' : isFirstOfMonth ? '#3b82f6' : '#94a3b8'};">${monthName}</span>
                  </div>
                `
              }
            }}
            slotLabelDidMount={(arg) => {
              const date = arg.date
              if (date && date.getDate() === 1) {
                arg.el.classList.add('fc-month-start')
              }
            }}
            slotLaneDidMount={(arg) => {
              const date = arg.date
              if (date && date.getDate() === 1) {
                arg.el.classList.add('fc-month-start-lane')
              }
            }}
            select={onDateSelect}
            eventClick={handleEventClickWithScroll}
            resourceLabelContent={(arg) => {
              const unitType = arg.resource.extendedProps?.type || ''
              const unitObj = arg.resource.extendedProps?.unit
              const isMaintenance = unitObj?.status === 'maintenance'
              const iconData = getUnitTypeIconData(unitType)
              const shakkaGradient = !isMaintenance
                ? getShakkaRoomIconGradient(unitObj)
                : null
              const iconGradient = shakkaGradient ?? iconData.gradient

              const maintenanceBadge = isMaintenance
                ? `<span style="
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 10px;
                    font-weight: 700;
                    color: #92400e;
                    background: linear-gradient(135deg, #fde68a 0%, #fbbf24 100%);
                    padding: 2px 8px;
                    border-radius: 9999px;
                    border: 1px solid #f59e0b;
                    white-space: nowrap;
                  ">🔧 صيانة</span>`
                : ''

              return {
                html: `
                  <div style="display: flex; align-items: center; gap: 0.5rem; padding: 8px 4px; flex-wrap: wrap;">
                    <span style="
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      flex-shrink: 0;
                      width: 48px;
                      height: 48px;
                      border-radius: 10px;
                      background: ${isMaintenance ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : iconGradient};
                      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    ">
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        ${iconData.path}
                      </svg>
                    </span>
                    <span style="font-weight: 600; color: ${isMaintenance ? '#92400e' : 'rgba(59, 130, 246, 0.9)'}; white-space: nowrap; font-size: 20px;">${arg.resource.title}</span>
                    ${maintenanceBadge}
                  </div>
                `
              }
            }}
            eventContent={(arg) => {
              const reservation = arg.event.extendedProps.reservation as CalendarEventRow | undefined
              if (reservation) {
                const guestName = `${reservation.guest_first_name_ar || reservation.guest_first_name || ''} ${reservation.guest_last_name_ar || reservation.guest_last_name || ''}`.trim() || reservation.id.substring(0, 8)
                const phone = reservation.guest_phone || ''

                const checkIn = new Date(reservation.check_in_date)
                const checkOut = new Date(reservation.check_out_date)
                const diffDays = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
                const isSingleDay = diffDays <= 1

                return {
                  html: `
                    <div class="cal-event-content ${isSingleDay ? 'single-day-event' : ''}">
                      <div class="cal-event-name">${guestName}</div>
                      ${phone ? `<div class="cal-event-phone">📞 ${phone}</div>` : ''}
                    </div>
                  `
                }
              }
              if (arg.event.extendedProps.isMaintenance) {
                return { html: `<div class="cal-event-content"><div class="cal-event-name" style="color: #78350f;">🔧 صيانة</div></div>` }
              }
              return { html: `<div class="cal-event-content"><div class="cal-event-name">${arg.event.title}</div></div>` }
            }}
            eventDidMount={(arg) => {
              if (arg.event.extendedProps.isMaintenance) {
                arg.el.setAttribute('title', 'هذه الوحدة قيد الصيانة')
                return
              }

              const isRestrictedBM =
                hasRole('BranchManager' as any) && !hasRole('SuperAdmin' as any) && !elevatedOps
              arg.el.classList.add('group', 'relative')
              arg.el.style.position = 'relative'

              if (!isRestrictedBM && !arg.el.querySelector('.fc-event-delete-btn')) {
                const deleteBtn = document.createElement('button')
                deleteBtn.innerHTML = '🗑️'
                deleteBtn.className = 'fc-event-delete-btn'
                const isRoomBlock = !!arg.event.extendedProps.roomBlock
                deleteBtn.setAttribute('title', isRoomBlock ? 'حذف الحظر' : 'حذف الحجز (أو اضغط Ctrl+Click)')
                deleteBtn.style.cssText = `
                  position: absolute;
                  left: 2px;
                  top: 2px;
                  z-index: 50;
                  width: 22px;
                  height: 22px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                  color: white;
                  border: 2px solid white;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 11px;
                  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
                `

                deleteBtn.onclick = (e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const roomBlock = arg.event.extendedProps.roomBlock
                  if (roomBlock) {
                    setBlockToDelete(roomBlock)
                    setBlockDeleteDialogOpen(true)
                    return
                  }
                  const reservation = arg.event.extendedProps.reservation as CalendarEventRow
                  if (reservation) {
                    setReservationToDelete(reservation)
                    setDeleteDialogOpen(true)
                  }
                }

                arg.el.appendChild(deleteBtn)
              }

              const isReservationEvent = !!arg.event.extendedProps.reservation && !arg.event.extendedProps.roomBlock
              if (isReservationEvent && !arg.el.querySelector('.fc-event-change-unit-btn')) {
                const changeUnitBtn = document.createElement('button')
                changeUnitBtn.innerHTML = '🔄'
                changeUnitBtn.className = 'fc-event-change-unit-btn'
                changeUnitBtn.setAttribute('title', 'نقل إلى وحدة أخرى')
                changeUnitBtn.style.cssText = `
                  position: absolute;
                  left: 26px;
                  top: 2px;
                  z-index: 50;
                  width: 22px;
                  height: 22px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
                  color: white;
                  border: 2px solid white;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 11px;
                  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.4);
                `

                changeUnitBtn.onclick = (e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const res = arg.event.extendedProps.reservation as CalendarEventRow
                  if (res) {
                    setChangeUnitReservation(res)
                    setChangeUnitDialogOpen(true)
                  }
                }

                arg.el.appendChild(changeUnitBtn)
              }

              if (isReservationEvent && !arg.el.querySelector('.fc-event-open-tab-btn')) {
                const openTabBtn = document.createElement('button')
                openTabBtn.innerHTML = '↗'
                openTabBtn.className = 'fc-event-open-tab-btn'
                openTabBtn.setAttribute('title', 'فتح في تبويب جديد')
                openTabBtn.style.cssText = `
                  position: absolute;
                  left: 50px;
                  top: 2px;
                  z-index: 50;
                  width: 22px;
                  height: 22px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  border: 2px solid white;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 13px;
                  font-weight: 900;
                  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
                `

                openTabBtn.onclick = (e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  const res = arg.event.extendedProps.reservation as CalendarEventRow
                  if (res?.id) {
                    window.open(`/reservations/${res.id}`, '_blank')
                  }
                }

                arg.el.appendChild(openTabBtn)
              }

              if (isReservationEvent) {
                const res = arg.event.extendedProps.reservation as CalendarEventRow
                if (res?.id && pendingIds.has(res.id) && !arg.el.querySelector('.fc-event-pending-badge')) {
                  const badge = document.createElement('span')
                  badge.className = 'fc-event-pending-badge'
                  badge.setAttribute('title', 'معلق — سيُزامن عند الاتصال')
                  badge.style.cssText = `
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    z-index: 60;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #f59e0b;
                    border: 2px solid white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 8px;
                    color: white;
                    font-weight: 900;
                    pointer-events: none;
                  `
                  badge.textContent = '⏱'
                  arg.el.style.position = 'relative'
                  arg.el.appendChild(badge)
                }
              }

              const reservation = arg.event.extendedProps.reservation as CalendarEventRow | undefined
              if (reservation) {
                const statusMap: Record<string, string> = { pending: 'قيد الانتظار', confirmed: 'مؤكد', checked_in: 'تم تسجيل الدخول', checked_out: 'تم تسجيل الخروج', cancelled: 'ملغي', no_show: 'لم يحضر' }
                const guestTypeMap: Record<string, string> = { military: 'عسكري', civilian: 'مدني', club_member: 'عضو دار', artillery_family: 'ابناء مدفعية' }

                function buildTooltipHTML(res: CalendarEventRow): string {
                  const gName = `${res.guest_first_name_ar || res.guest_first_name || ''} ${res.guest_last_name_ar || res.guest_last_name || ''}`.trim()
                  const ph = res.guest_phone || ''
                  const cIn = res.check_in_date ? new Date(res.check_in_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
                  const cOut = res.check_out_date ? new Date(res.check_out_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
                  const cAt = res.created_at ? new Date(res.created_at).toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''
                  const st = res.status || ''
                  const gType = ''
                  const notes = res.notes || ''
                  const creatorUserId = res.created_by_user_id
                  const creatorName = creatorUserId ? (staffByUserId.get(creatorUserId) || creatorUserId.substring(0, 8) + '...') : null
                  return `
                    <button class="fc-tooltip-close" style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);color:#f1f5f9;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:background 0.15s;">&times;</button>
                    <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; color: #60a5fa; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                      👤 ${gName || res.id.substring(0, 8)}
                    </div>
                    ${ph ? `<div style="margin-bottom: 4px;">📞 <span style="color: #a5b4fc;">${ph}</span></div>` : ''}
                    ${gType ? `<div style="margin-bottom: 4px;">🏷️ نوع الضيف: <span style="color: #38bdf8;">${guestTypeMap[gType] || gType}</span></div>` : ''}
                    <div style="margin-bottom: 4px;">📅 الدخول: <span style="color: #34d399;">${cIn}</span></div>
                    <div style="margin-bottom: 4px;">📅 الخروج: <span style="color: #fb923c;">${cOut}</span></div>
                    ${st ? `<div style="margin-bottom: 4px;">📌 الحالة: <span style="color: #c084fc;">${statusMap[st] || st}</span></div>` : ''}
                    ${notes ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">📝 ملاحظات: <span style="color: #fde68a;">${notes}</span></div>` : ''}
                    <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">👷 بواسطة: <span style="color: #67e8f9;">${creatorName || 'غير محدد'}</span></div>
                    ${cAt ? `<div style="margin-top: 4px; font-size: 11px; color: #94a3b8;">🕐 تاريخ الإنشاء: ${cAt}</div>` : ''}
                  `
                }

                const tooltip = document.createElement('div')
                tooltip.className = 'fc-event-tooltip'
                tooltip.style.cssText = `
                  display: none;
                  position: fixed;
                  z-index: 99999;
                  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                  color: #f1f5f9;
                  border-radius: 12px;
                  padding: 14px 18px;
                  font-size: 13px;
                  line-height: 1.7;
                  min-width: 240px;
                  max-width: 320px;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
                  pointer-events: auto;
                  direction: rtl;
                  backdrop-filter: blur(10px);
                  border: 1px solid rgba(255,255,255,0.1);
                `
                document.body.appendChild(tooltip)

                arg.el.addEventListener('contextmenu', (e: MouseEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (tooltip.style.display === 'block') {
                    tooltip.style.display = 'none'
                    return
                  }
                  document.querySelectorAll('.fc-event-tooltip').forEach(el => {
                    (el as HTMLElement).style.display = 'none'
                  })
                  const latestRes = arg.event.extendedProps.reservation as CalendarEventRow
                  tooltip.innerHTML = buildTooltipHTML(latestRes)
                  const closeBtn = tooltip.querySelector('.fc-tooltip-close') as HTMLElement
                  if (closeBtn) {
                    closeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); tooltip.style.display = 'none' })
                    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(239,68,68,0.6)' })
                    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'rgba(255,255,255,0.15)' })
                  }
                  tooltip.style.display = 'block'
                  const x = e.clientX + 12
                  const y = e.clientY + 12
                  const rect = tooltip.getBoundingClientRect()
                  tooltip.style.left = (x + rect.width > window.innerWidth ? e.clientX - rect.width - 12 : x) + 'px'
                  tooltip.style.top = (y + rect.height > window.innerHeight ? e.clientY - rect.height - 12 : y) + 'px'
                })

                const observer = new MutationObserver(() => {
                  if (!document.body.contains(arg.el)) {
                    tooltip.remove()
                    observer.disconnect()
                  }
                })
                observer.observe(arg.el.parentNode || document.body, { childList: true })
              } else if (arg.event.extendedProps.roomBlock) {
                const block = arg.event.extendedProps.roomBlock
                const blockName = block.name_ar || block.name || ''
                const startDate = block.start_date ? new Date(block.start_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
                const endDate = block.end_date ? new Date(block.end_date).toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
                const reason = block.reason_ar || block.reason || ''
                const blockUnits = block.units?.map((u: any) => {
                  const unit = u.unit
                  return unit ? `${unit.unit_number} - ${unit.name_ar || unit.name || ''}` : ''
                }).filter(Boolean) || []

                const blockTooltip = document.createElement('div')
                blockTooltip.className = 'fc-event-tooltip'
                blockTooltip.style.cssText = `
                  display: none;
                  position: fixed;
                  z-index: 99999;
                  background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
                  color: #f1f5f9;
                  border-radius: 12px;
                  padding: 14px 18px;
                  font-size: 13px;
                  line-height: 1.7;
                  min-width: 240px;
                  max-width: 340px;
                  box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.15);
                  pointer-events: auto;
                  direction: rtl;
                  backdrop-filter: blur(10px);
                  border: 1px solid rgba(255,255,255,0.15);
                `
                blockTooltip.innerHTML = `
                  <button class="fc-tooltip-close" style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);color:#f1f5f9;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:background 0.15s;">&times;</button>
                  <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px; color: #f87171; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                    🚫 ${blockName}
                  </div>
                  <div style="margin-bottom: 4px;">📅 من: <span style="color: #34d399;">${startDate}</span></div>
                  <div style="margin-bottom: 4px;">📅 إلى: <span style="color: #fb923c;">${endDate}</span></div>
                  ${reason ? `<div style="margin-bottom: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">📋 السبب: <span style="color: #fbbf24;">${reason}</span></div>` : ''}
                  ${blockUnits.length > 0 ? `
                    <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
                      <div style="margin-bottom: 4px; color: #a5b4fc;">🏠 الوحدات المحظورة (${blockUnits.length}):</div>
                      ${blockUnits.map((u: string) => `<div style="margin-right: 12px; font-size: 12px; color: #cbd5e1;">• ${u}</div>`).join('')}
                    </div>
                  ` : ''}
                `
                const blockCloseBtn = blockTooltip.querySelector('.fc-tooltip-close') as HTMLElement
                if (blockCloseBtn) {
                  blockCloseBtn.addEventListener('click', (ev) => { ev.stopPropagation(); blockTooltip.style.display = 'none' })
                  blockCloseBtn.addEventListener('mouseenter', () => { blockCloseBtn.style.background = 'rgba(239,68,68,0.6)' })
                  blockCloseBtn.addEventListener('mouseleave', () => { blockCloseBtn.style.background = 'rgba(255,255,255,0.15)' })
                }
                document.body.appendChild(blockTooltip)

                arg.el.addEventListener('contextmenu', (e: MouseEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (blockTooltip.style.display === 'block') {
                    blockTooltip.style.display = 'none'
                    return
                  }
                  document.querySelectorAll('.fc-event-tooltip').forEach(el => {
                    (el as HTMLElement).style.display = 'none'
                  })
                  blockTooltip.style.display = 'block'
                  const x = e.clientX + 12
                  const y = e.clientY + 12
                  const rect = blockTooltip.getBoundingClientRect()
                  blockTooltip.style.left = (x + rect.width > window.innerWidth ? e.clientX - rect.width - 12 : x) + 'px'
                  blockTooltip.style.top = (y + rect.height > window.innerHeight ? e.clientY - rect.height - 12 : y) + 'px'
                })

                const blockObserver = new MutationObserver(() => {
                  if (!document.body.contains(arg.el)) {
                    blockTooltip.remove()
                    blockObserver.disconnect()
                  }
                })
                blockObserver.observe(arg.el.parentNode || document.body, { childList: true })
              }
            }}
            eventDrop={onEventDrop}
            eventResize={onEventResize}
            height="700px"
            contentHeight="auto"
            expandRows={false}
            stickyFooterScrollbar={true}
            eventClassNames="border-l-4 shadow-md cursor-pointer font-semibold"
            dayHeaderClassNames="font-bold text-slate-700 dark:text-slate-300 bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-purple-50/30 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 border-b-2 border-blue-200/50 dark:border-blue-800/50"
            moreLinkClassNames="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold"
            buttonText={{
              today: 'اليوم',
              month: 'شهر',
              week: 'أسبوع',
              day: 'يوم',
            }}
            allDayText="طوال اليوم"
            noEventsText="لا توجد أحداث"
            eventDisplay="block"
            dayCellClassNames="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors"
          />
        </div>
      </div>
    </motion.div>
  )
}))

export default FullCalendarWidget
