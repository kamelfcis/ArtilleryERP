/**
 * Optimized user roles hook with caching
 * Uses TanStack Query for efficient data fetching
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { UserRole } from '@/lib/types/database'
import { getCachedSession } from '@/lib/auth/cache'

export function useUserRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-roles', userId],
    queryFn: async () => {
      if (!userId) return []

      // Try cache first
      const cached = getCachedSession()
      if (cached?.user?.id === userId && cached.roles.length > 0) {
        return cached.roles
      }

      // Fetch from database
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)

      if (userRolesError) throw userRolesError

      if (!userRolesData || userRolesData.length === 0) {
        return []
      }

      const roleIds = userRolesData.map((item: any) => item.role_id).filter(Boolean)

      if (roleIds.length === 0) {
        return []
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('name')
        .in('id', roleIds)

      if (rolesError) throw rolesError

      const userRoles = (rolesData || [])
        .map((item: any) => item.name)
        .filter(Boolean) as UserRole[]

      return userRoles
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - roles don't change often
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  })
}








