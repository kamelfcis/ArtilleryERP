'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/use-toast'
import { Package, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useAddReservationService } from '@/lib/hooks/use-services'

interface ServiceBundleSelectorProps {
  reservationId: string
}

export function ServiceBundleSelector({ reservationId }: ServiceBundleSelectorProps) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const addService = useAddReservationService()

  const { data: bundles } = useQuery({
    queryKey: ['service-bundles', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_bundles')
        .select(`
          *,
          items:service_bundle_items (
            *,
            service:services (*)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  async function handleApplyBundle(bundle: any) {
    try {
      // Add all services from bundle
      for (const item of bundle.items || []) {
        await addService.mutateAsync({
          reservationId,
          serviceId: item.service_id,
          quantity: item.quantity || 1,
        })
      }

      // Apply bundle discount if any
      if (bundle.discount_percentage > 0) {
        const bundleTotal = bundle.items?.reduce((sum: number, item: any) => {
          return sum + (item.service?.price || 0) * (item.quantity || 1)
        }, 0) || 0

        const discountAmount = (bundleTotal * bundle.discount_percentage) / 100

        const { data: reservation } = await supabase
          .from('reservations')
          .select('discount_amount')
          .eq('id', reservationId)
          .single()

        if (reservation) {
          await supabase
            .from('reservations')
            .update({
              discount_amount: (reservation.discount_amount || 0) + discountAmount,
            })
            .eq('id', reservationId)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['reservation-services', reservationId] })
      queryClient.invalidateQueries({ queryKey: ['reservation', reservationId] })

      toast({
        title: 'نجح',
        description: `تم تطبيق الباقة "${bundle.name_ar || bundle.name}" بنجاح`,
      })
      setOpen(false)
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تطبيق الباقة',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="mr-2 h-4 w-4" />
          تطبيق باقة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>اختر باقة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {bundles && bundles.length > 0 ? (
            bundles.map((bundle) => (
              <Card
                key={bundle.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleApplyBundle(bundle)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">
                          {bundle.name_ar || bundle.name}
                        </h3>
                      </div>
                      {bundle.description_ar && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {bundle.description_ar}
                        </p>
                      )}
                      <div className="space-y-1 mb-3">
                        {bundle.items?.map((item: any, index: number) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            • {item.service?.name_ar || item.service?.name} × {item.quantity}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">السعر: </span>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(bundle.price)}
                          </span>
                        </div>
                        {bundle.discount_percentage > 0 && (
                          <div>
                            <span className="text-sm text-green-600">
                              خصم {bundle.discount_percentage}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleApplyBundle(bundle)
                      }}
                      disabled={addService.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      تطبيق
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد باقات متاحة
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

