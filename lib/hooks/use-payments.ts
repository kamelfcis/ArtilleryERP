import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface PaymentTransaction {
  id: string
  reservation_id: string
  amount: number
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'online' | 'loyalty_points'
  status: 'pending' | 'completed' | 'failed' | 'refunded'
  transaction_reference?: string
  notes?: string
  notes_ar?: string
  processed_by?: string
  processed_at?: string
  created_at: string
}

export function usePaymentTransactions(reservationId?: string) {
  return useQuery({
    queryKey: ['payment-transactions', reservationId],
    queryFn: async () => {
      let query = supabase
        .from('payment_transactions')
        .select('*')
        .order('created_at', { ascending: false })

      if (reservationId) {
        query = query.eq('reservation_id', reservationId)
      }

      const { data, error } = await query

      if (error) throw error
      return data as PaymentTransaction[]
    },
    enabled: !!reservationId,
  })
}

export function useCreatePaymentTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payment: Partial<PaymentTransaction>) => {
      const { data: userData } = await supabase.auth.getUser()
      
      const { data, error } = await supabase
        .from('payment_transactions')
        .insert({
          ...payment,
          processed_by: userData?.user?.id,
          processed_at: new Date().toISOString(),
          status: 'completed',
        })
        .select()
        .single()

      if (error) throw error

      // Note: The database trigger (auto_confirm_on_payment_trigger) automatically:
      // 1. Recalculates paid_amount by summing all completed payment transactions
      // 2. Auto-confirms the reservation if 50% or more is paid and status is pending
      // So we don't need to manually update paid_amount here to avoid double counting

      return data as PaymentTransaction
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      // Invalidate specific reservation to refresh the screen
      if (variables.reservation_id) {
        queryClient.invalidateQueries({ queryKey: ['reservation', variables.reservation_id] })
      }
    },
  })
}

export function useDeletePaymentTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (transactionId: string) => {
      // Get transaction details before deleting to get reservation_id
      const { data: transaction, error: fetchError } = await supabase
        .from('payment_transactions')
        .select('reservation_id, status')
        .eq('id', transactionId)
          .single()

      if (fetchError) throw fetchError
      if (!transaction) throw new Error('Transaction not found')

      // Only allow deletion of completed transactions (for safety)
      if (transaction.status !== 'completed') {
        throw new Error('يمكن حذف الدفعات المكتملة فقط')
      }

      // Delete the transaction
      const { error } = await supabase
        .from('payment_transactions')
        .delete()
        .eq('id', transactionId)

      if (error) throw error

      // The database trigger will automatically recalculate paid_amount
      // when the transaction is deleted

      return { transactionId, reservationId: transaction.reservation_id }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      // Invalidate specific reservation to refresh the screen
      if (data.reservationId) {
        queryClient.invalidateQueries({ queryKey: ['reservation', data.reservationId] })
      }
    },
  })
}

