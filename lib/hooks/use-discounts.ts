import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface DiscountCode {
  id: string
  code: string
  name: string
  name_ar: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses?: number
  used_count: number
  min_amount?: number
  valid_from?: string
  valid_to?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useDiscountCodes() {
  return useQuery({
    queryKey: ['discount-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as DiscountCode[]
    },
  })
}

export function useActiveDiscountCodes() {
  return useQuery({
    queryKey: ['discount-codes', 'active'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('is_active', true)
        .lte('valid_from', today)
        .gte('valid_to', today)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as DiscountCode[]
    },
  })
}

export function useValidateDiscountCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .lte('valid_from', today)
        .gte('valid_to', today)
        .single()

      if (error) throw error

      if (!data) {
        throw new Error('كود الخصم غير صحيح أو منتهي الصلاحية')
      }

      if (data.max_uses && data.used_count >= data.max_uses) {
        throw new Error('تم استنفاد عدد مرات استخدام كود الخصم')
      }

      return data as DiscountCode
    },
  })
}

export function useCreateDiscountCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (discount: Partial<DiscountCode>) => {
      const { data, error } = await supabase
        .from('discount_codes')
        .insert({
          ...discount,
          code: discount.code?.toUpperCase(),
        })
        .select()
        .single()

      if (error) throw error
      return data as DiscountCode
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] })
    },
  })
}

export function useApplyDiscountCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      code,
      reservationId,
      totalAmount,
    }: {
      code: string
      reservationId: string
      totalAmount: number
    }) => {
      // Validate code
      const validate = useValidateDiscountCode()
      const discount = await validate.mutateAsync(code)

      // Calculate discount
      let discountAmount = 0
      if (discount.discount_type === 'percentage') {
        discountAmount = (totalAmount * discount.discount_value) / 100
      } else {
        discountAmount = discount.discount_value
      }

      // Check minimum amount
      if (discount.min_amount && totalAmount < discount.min_amount) {
        throw new Error(`الحد الأدنى للطلب: ${discount.min_amount} ر.س`)
      }

      // Apply discount to reservation
      const { data: reservation } = await supabase
        .from('reservations')
        .select('discount_amount')
        .eq('id', reservationId)
        .single()

      const newDiscountAmount = (reservation?.discount_amount || 0) + discountAmount

      const { error: updateError } = await supabase
        .from('reservations')
        .update({ discount_amount: newDiscountAmount })
        .eq('id', reservationId)

      if (updateError) throw updateError

      // Increment usage count
      const { error: usageError } = await supabase
        .from('discount_codes')
        .update({ used_count: discount.used_count + 1 })
        .eq('id', discount.id)

      if (usageError) throw usageError

      // Log usage
      const { data: userData } = await supabase.auth.getUser()
      await supabase.from('discount_usage').insert({
        discount_code_id: discount.id,
        reservation_id: reservationId,
        discount_amount: discountAmount,
        used_by: userData?.user?.id,
      })

      return { discountAmount, discount }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] })
    },
  })
}

