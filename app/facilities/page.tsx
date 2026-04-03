'use client'

import { useState } from 'react'
import { useFacilities, useDeleteFacility } from '@/lib/hooks/use-facilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Search } from 'lucide-react'
import { FacilityForm } from '@/components/forms/FacilityForm'

export default function FacilitiesPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<string | null>(null)
  const { data: facilities, isLoading } = useFacilities()
  const deleteFacility = useDeleteFacility()

  const filteredFacilities = facilities?.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.name_ar.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا المرفق؟')) return

    try {
      await deleteFacility.mutateAsync(id)
      toast({
        title: 'نجح',
        description: 'تم حذف المرفق بنجاح',
      })
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في حذف المرفق',
        variant: 'destructive',
      })
    }
  }

  function handleEdit(id: string) {
    setEditingFacility(id)
    setDialogOpen(true)
  }

  function handleClose() {
    setDialogOpen(false)
    setEditingFacility(null)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">المرافق</h1>
          <p className="text-muted-foreground">إدارة جميع المرافق</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleClose}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingFacility(null)}>
              <Plus className="mr-2 h-4 w-4" />
              مرفق جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingFacility ? 'تعديل المرفق' : 'مرفق جديد'}
              </DialogTitle>
            </DialogHeader>
            <FacilityForm
              facilityId={editingFacility || undefined}
              onSuccess={handleClose}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن مرفق..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredFacilities?.map((facility) => (
                <Card key={facility.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{facility.name_ar}</CardTitle>
                    <p className="text-sm text-muted-foreground">{facility.name}</p>
                  </CardHeader>
                  <CardContent>
                    {facility.description_ar && (
                      <p className="text-sm mb-4">{facility.description_ar}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(facility.id)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        تعديل
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(facility.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        حذف
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredFacilities?.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  لا توجد مرافق
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

