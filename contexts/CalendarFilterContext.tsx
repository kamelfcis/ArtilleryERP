'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

interface CalendarFilterContextValue {
  selectedLocation: string
  setSelectedLocation: (value: string) => void
  selectedTypes: string[]
  setSelectedTypes: (value: string[] | ((prev: string[]) => string[])) => void
  toggleUnitType: (type: string, locationId?: string) => void
  clearUnitTypes: () => void
  headerExpanded: boolean
  setHeaderExpanded: (value: boolean) => void
}

const CalendarFilterContext = createContext<CalendarFilterContextValue | null>(null)

function readStoredLocation(): string {
  if (typeof window === 'undefined') return 'all'
  return localStorage.getItem('calendar-selected-location') || 'all'
}

function readStoredTypes(): string[] {
  if (typeof window === 'undefined') return []
  const saved = localStorage.getItem('calendar-selected-types')
  if (!saved) return []
  try {
    return JSON.parse(saved)
  } catch {
    return []
  }
}

export function CalendarFilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedLocation, setSelectedLocationState] = useState(readStoredLocation)
  const [selectedTypes, setSelectedTypesState] = useState<string[]>(readStoredTypes)
  const [headerExpanded, setHeaderExpanded] = useState(true)

  const setSelectedLocation = useCallback((value: string) => {
    setSelectedLocationState(value)
    localStorage.setItem('calendar-selected-location', value)
  }, [])

  const setSelectedTypes = useCallback((value: string[] | ((prev: string[]) => string[])) => {
    setSelectedTypesState(prev => {
      const next = typeof value === 'function' ? value(prev) : value
      localStorage.setItem('calendar-selected-types', JSON.stringify(next))
      return next
    })
  }, [])

  const toggleUnitType = useCallback((type: string, locationId?: string) => {
    if (locationId && locationId !== 'all') {
      setSelectedLocationState(prev => {
        if (prev === locationId) return prev
        localStorage.setItem('calendar-selected-location', locationId)
        return locationId
      })
    }
    setSelectedTypesState(prev => {
      const next = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
      localStorage.setItem('calendar-selected-types', JSON.stringify(next))
      return next
    })
  }, [])

  const clearUnitTypes = useCallback(() => {
    setSelectedTypesState([])
    localStorage.setItem('calendar-selected-types', JSON.stringify([]))
  }, [])

  const value = useMemo(
    () => ({
      selectedLocation,
      setSelectedLocation,
      selectedTypes,
      setSelectedTypes,
      toggleUnitType,
      clearUnitTypes,
      headerExpanded,
      setHeaderExpanded,
    }),
    [selectedLocation, setSelectedLocation, selectedTypes, setSelectedTypes, toggleUnitType, clearUnitTypes, headerExpanded]
  )

  return (
    <CalendarFilterContext.Provider value={value}>
      {children}
    </CalendarFilterContext.Provider>
  )
}

export function useCalendarFilters() {
  const ctx = useContext(CalendarFilterContext)
  if (!ctx) {
    throw new Error('useCalendarFilters must be used within CalendarFilterProvider')
  }
  return ctx
}

export function useOptionalCalendarFilters() {
  return useContext(CalendarFilterContext)
}
