import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiPost, apiDelete } from '@/lib/api/http-client'
import { buildQuery } from '@/lib/api/build-query'

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
      if (isApiProvider()) {
        return apiGet<PaymentTransaction[]>(
          `/payments${buildQuery({ reservationId })}`
        )
      }
      let query = supabase.from('payment_transactions').select('*').order('created_at', { ascending: false })
      if (reservationId) query = query.eq('reservation_id', reservationId)
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
      if (isApiProvider()) {
        return apiPost<PaymentTransaction>('/payments', payment)
      }
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
      return data as PaymentTransaction
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
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
      if (isApiProvider()) {
        return apiDelete<{ transactionId: string; reservationId: string }>(`/payments/${transactionId}`)
      }
      const { data: transaction, error: fetchError } = await supabase
        .from('payment_transactions')
        .select('reservation_id, status')
        .eq('id', transactionId)
        .single()
      if (fetchError) throw fetchError
      if (!transaction) throw new Error('Transaction not found')
      if (transaction.status !== 'completed') {
        throw new Error('يمكن حذف الدفعات المكتملة فقط')
      }
      const { error } = await supabase.from('payment_transactions').delete().eq('id', transactionId)
      if (error) throw error
      return { transactionId, reservationId: transaction.reservation_id }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      if (data.reservationId) {
        queryClient.invalidateQueries({ queryKey: ['reservation', data.reservationId] })
      }
    },
  })
}
