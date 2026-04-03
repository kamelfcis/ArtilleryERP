import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface LoyaltyPoints {
  guest_id: string
  total_points: number
  used_points: number
  available_points: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  last_updated: string
}

export function useGuestLoyalty(guestId: string) {
  return useQuery({
    queryKey: ['loyalty', guestId],
    queryFn: async () => {
      // Calculate loyalty points from reservations
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('total_amount, created_at')
        .eq('guest_id', guestId)
        .neq('status', 'cancelled')

      if (error) throw error

      // Calculate points (1 point per 10 SAR spent)
      const totalSpent = reservations?.reduce((sum, r) => sum + r.total_amount, 0) || 0
      const totalPoints = Math.floor(totalSpent / 10)
      
      // Determine tier
      let tier: 'bronze' | 'silver' | 'gold' | 'platinum' = 'bronze'
      if (totalPoints >= 1000) tier = 'platinum'
      else if (totalPoints >= 500) tier = 'gold'
      else if (totalPoints >= 200) tier = 'silver'

      return {
        guest_id: guestId,
        total_points: totalPoints,
        used_points: 0, // Track this separately if needed
        available_points: totalPoints,
        tier,
        last_updated: new Date().toISOString(),
      } as LoyaltyPoints
    },
    enabled: !!guestId,
  })
}

export function useApplyLoyaltyDiscount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      reservationId,
      pointsToUse,
    }: {
      reservationId: string
      pointsToUse: number
    }) => {
      // 1 point = 1 SAR discount
      const discountAmount = pointsToUse

      const { data: reservation, error: fetchError } = await supabase
        .from('reservations')
        .select('total_amount, discount_amount')
        .eq('id', reservationId)
        .single()

      if (fetchError) throw fetchError

      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          discount_amount: (reservation.discount_amount || 0) + discountAmount,
        })
        .eq('id', reservationId)

      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

