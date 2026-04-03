'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Copy, Trash2, FileText } from 'lucide-react'
import { useServices } from '@/lib/hooks/use-services'
import { RoleGuard } from '@/components/auth/RoleGuard'

interface ServiceTemplate {
  id: string
  name: string
  name_ar: string
  description_ar?: string
  services: Array<{
    service_id: string
    quantity: number
  }>
  created_at: string
}

export default function ServiceTemplatesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: templates, isLoading } = useQuery({
    queryKey: ['service-templates'],
    queryFn: async () => {
      // In production, create service_templates table
      // For now, return empty array
      return [] as ServiceTemplate[]
    },
  })

  return (
    <RoleGuard allowedRoles={['SuperAdmin', 'BranchManager']}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <FileText className="h-8 w-8" />
              قوالب الخدمات
            </h1>
            <p className="text-muted-foreground">إنشاء قوالب جاهزة للخدمات والطعام</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                قالب جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>إنشاء قالب جديد</DialogTitle>
              </DialogHeader>
              <ServiceTemplateForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : templates && templates.length > 0 ? (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{template.name_ar || template.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {template.services.length} خدمة
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Copy className="mr-2 h-4 w-4" />
                        استخدام
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد قوالب</p>
                <p className="text-sm mt-2">أنشئ قوالب جاهزة لتسريع عملية إضافة الخدمات</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}

function ServiceTemplateForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [selectedServices, setSelectedServices] = useState<Array<{ serviceId: string; quantity: number }>>([])
  const { data: services } = useServices()

  function handleAddService(serviceId: string, quantity: number) {
    setSelectedServices([...selectedServices, { serviceId, quantity }])
  }

  function handleRemoveService(index: number) {
    setSelectedServices(selectedServices.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="template-name">اسم القالب (إنجليزي) *</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="template-name-ar">اسم القالب (عربي) *</Label>
          <Input
            id="template-name-ar"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>الخدمات في القالب</Label>
        <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
          {selectedServices.length > 0 ? (
            selectedServices.map((item, index) => {
              const service = services?.find(s => s.id === item.serviceId)
              return (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm">{service?.name_ar || service?.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">الكمية: {item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveService(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              لا توجد خدمات في القالب
            </p>
          )}
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        ملاحظة: سيتم إضافة جدول قوالب الخدمات في الإصدارات القادمة
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onSuccess}>
          إلغاء
        </Button>
        <Button disabled>
          حفظ (قريباً)
        </Button>
      </div>
    </div>
  )
}

