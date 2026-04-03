'use client'

import { useCurrentStaff } from './use-staff'
import { useReservations } from './use-reservations'
import { useUnits } from './use-units'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Hook to get reservations filtered by staff's location
 * - SuperAdmin/BranchManager: sees all or filtered by selected location
 * - Staff: only sees their assigned location's reservations
 */
export function useStaffFilteredReservations(filters?: {
  locationId?: string
  status?: any
  dateFrom?: string
  dateTo?: string
}) {
  const { hasRole } = useAuth()
  const { data: currentStaff } = useCurrentStaff()
  const isStaffRole = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')
  
  // If user is Staff role, force filter by their location
  const effectiveLocationId = isStaffRole && currentStaff?.location_id 
    ? currentStaff.location_id 
    : filters?.locationId

  return useReservations({
    ...filters,
    locationId: effectiveLocationId,
  })
}

/**
 * Hook to get units filtered by staff's location
 * - SuperAdmin/BranchManager: sees all or filtered by selected location
 * - Staff: only sees their assigned location's units
 */
export function useStaffFilteredUnits(filters?: {
  locationId?: string
  type?: string
}) {
  const { hasRole } = useAuth()
  const { data: currentStaff } = useCurrentStaff()
  const isStaffRole = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')
  
  // If user is Staff role, force filter by their location
  const effectiveLocationId = isStaffRole && currentStaff?.location_id 
    ? currentStaff.location_id 
    : filters?.locationId

  return useUnits({
    ...filters,
    locationId: effectiveLocationId,
  })
}

/**
 * Hook to check if current user is a Staff-only user
 * Returns true if user has Staff role but not SuperAdmin or BranchManager
 */
export function useIsStaffOnly() {
  const { hasRole } = useAuth()
  return hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')
}

/**
 * Hook to get the current staff's location ID
 * Returns null if user is not staff or has no location assigned
 */
export function useStaffLocationId() {
  const { hasRole } = useAuth()
  const { data: currentStaff, isLoading } = useCurrentStaff()
  const isStaffRole = hasRole('Staff') && !hasRole('SuperAdmin') && !hasRole('BranchManager')
  
  return {
    locationId: isStaffRole ? currentStaff?.location_id : null,
    isLoading,
    isStaffOnly: isStaffRole,
  }
}

