import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface AuditLog {
  id: string
  user_id?: string
  action: string
  resource_type: string
  resource_id?: string
  old_values?: any
  new_values?: any
  ip_address?: string
  user_agent?: string
  created_at: string
}

export function useAuditLogs(filters?: {
  resourceType?: string
  resourceId?: string
  userId?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  /** Match logs whose new_values->>unit_id OR old_values->>unit_id equals this id. */
  unitId?: string
  /**
   * Match logs whose new_values->>location_id OR old_values->>location_id equals this id
   * (for `units` resource), OR whose unit_id is in the provided unitIdsForLocation list
   * (for resources that reference units, e.g. reservations / pricing).
   */
  locationId?: string
  /** Pre-resolved list of unit IDs that belong to `locationId`; required for cross-resource location filtering. */
  unitIdsForLocation?: string[]
  limit?: number
}) {
  return useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100)

      if (filters?.resourceType) {
        query = query.eq('resource_type', filters.resourceType)
      }
      if (filters?.resourceId) {
        query = query.eq('resource_id', filters.resourceId)
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId)
      }
      if (filters?.action) {
        query = query.eq('action', filters.action)
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo)
      }

      // Filter by unit_id stored inside the JSONB row payload.
      // INSERT logs have only new_values; DELETE logs have only old_values; UPDATE logs have both.
      if (filters?.unitId) {
        query = query.or(
          [
            `new_values->>unit_id.eq.${filters.unitId}`,
            `old_values->>unit_id.eq.${filters.unitId}`,
          ].join(',')
        )
      }

      // Filter by location: matches `units` rows directly via location_id, and matches
      // unit-referencing rows (reservations, pricing, ...) via unit_id ∈ unitIdsForLocation.
      if (filters?.locationId) {
        const conditions: string[] = [
          `new_values->>location_id.eq.${filters.locationId}`,
          `old_values->>location_id.eq.${filters.locationId}`,
        ]
        const unitIds = filters.unitIdsForLocation
        if (unitIds && unitIds.length > 0) {
          const list = unitIds.join(',')
          conditions.push(`new_values->>unit_id.in.(${list})`)
          conditions.push(`old_values->>unit_id.in.(${list})`)
        }
        query = query.or(conditions.join(','))
      }

      const { data, error } = await query

      if (error) throw error
      return data as AuditLog[]
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}

export function useDeleteAuditLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('audit_logs')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}
