import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Pricing } from '@/lib/types/database'

export function usePricing(filters?: {
  unitId?: string
  pricingType?: string
  isActive?: boolean
}) {
  return useQuery({
    queryKey: ['pricing', filters],
    queryFn: async () => {
      let query = supabase
        .from('pricing')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.unitId) {
        query = query.eq('unit_id', filters.unitId)
      }
      if (filters?.pricingType) {
        query = query.eq('pricing_type', filters.pricingType)
      }
      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Pricing[]
    },
  })
}

export function useUnitPricing(unitId: string) {
  return usePricing({ unitId, isActive: true })
}

