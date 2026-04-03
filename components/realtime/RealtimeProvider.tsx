'use client'

import { useEffect } from 'react'
import { useRealtimeSubscription } from '@/lib/hooks/use-realtime'
import { useQueryClient } from '@tanstack/react-query'

export function RealtimeProvider() {
  const queryClient = useQueryClient()

  // Subscribe to reservations changes
  useRealtimeSubscription('reservations', ['reservations'])
  
  // Subscribe to units changes
  useRealtimeSubscription('units', ['units'])
  
  // Subscribe to guests changes
  useRealtimeSubscription('guests', ['guests'])

  return null
}

