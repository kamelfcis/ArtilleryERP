import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface ActivityLog {
  id: string
  user_id?: string
  action: string
  resource_type: string
  resource_id?: string
  description?: string
  description_ar?: string
  metadata?: any
  ip_address?: string
  created_at: string
  user?: {
    email?: string
  }
}

export function useActivityFeed(filters?: {
  resourceType?: string
  resourceId?: string
  userId?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['activity-feed', filters],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 50)

      if (filters?.resourceType) {
        query = query.eq('resource_type', filters.resourceType)
      }
      if (filters?.resourceId) {
        query = query.eq('resource_id', filters.resourceId)
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId)
      }

      const { data, error } = await query

      if (error) throw error
      return data as ActivityLog[]
    },
  })
}

export async function logActivity(
  action: string,
  resourceType: string,
  options?: {
    resourceId?: string
    description?: string
    descriptionAr?: string
    metadata?: any
  }
) {
  const { data, error } = await supabase.rpc('log_activity', {
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: options?.resourceId || null,
    p_description: options?.description || null,
    p_description_ar: options?.descriptionAr || null,
    p_metadata: options?.metadata || null,
  })

  if (error) {
    console.error('Failed to log activity:', error)
  }
}

