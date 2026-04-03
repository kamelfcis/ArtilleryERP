'use client'

import { useState } from 'react'
import { useLocations, useDeleteLocation } from '@/lib/hooks/use-locations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Edit, Trash2, Search, MapPin, Phone, Mail, User } from 'lucide-react'
import { LocationForm } from '@/components/forms/LocationForm'
import { motion } from 'framer-motion'

export default function LocationsPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<string | null>(null)
  const { data: locations, isLoading } = useLocations()
  const deleteLocation = useDeleteLocation()

  const filteredLocations = locations?.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.name_ar.toLowerCase().includes(search.toLowerCase()) ||
    l.address?.toLowerCase().includes(search.toLowerCase()) ||
    l.address_ar?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleDelete(id: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف الموقع "${name}"؟\n\nسيتم تعطيل الموقع ولن يظهر في القائمة.`)) return

    try {
      await deleteLocation.mutateAsync(id)
      toast({
        title: 'نجح',
        description: `تم حذف الموقع "${name}" بنجاح`,
      })
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حذف الموقع',
        variant: 'destructive',
      })
    }
  }

  function handleEdit(id: string) {
    setEditingLocation(id)
    setDialogOpen(true)
  }

  function handleClose() {
    setDialogOpen(false)
    setEditingLocation(null)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold mb-2 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 dark:from-slate-100 dark:via-slate-200 dark:to-slate-100 bg-clip-text text-transparent"
          >
            المواقع
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-muted-foreground flex items-center gap-2"
          >
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              📍
            </motion.span>
            إدارة جميع المواقع
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) {
              handleClose()
            } else {
              setDialogOpen(true)
            }
          }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => {
                  setEditingLocation(null)
                  setDialogOpen(true)
                }}
                className="relative overflow-hidden group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
                <Plus className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">موقع جديد</span>
              </Button>
            </motion.div>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingLocation ? 'تعديل الموقع' : 'موقع جديد'}
                </DialogTitle>
              </DialogHeader>
              <LocationForm
                locationId={editingLocation || undefined}
                onSuccess={handleClose}
              />
            </DialogContent>
          </Dialog>
        </motion.div>
      </motion.div>

      {/* Search Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="relative overflow-hidden border-2">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
          <CardHeader className="relative">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <Input
                placeholder="ابحث عن موقع (اسم، عنوان)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10 relative z-10"
              />
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Locations Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="relative overflow-hidden border-2">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50" />
          <CardHeader className="relative">
            <CardTitle className="relative z-10">
              المواقع ({filteredLocations?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredLocations?.map((location, index) => (
                  <motion.div
                    key={location.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className="relative overflow-hidden border rounded-lg p-4 hover:shadow-lg transition-all bg-card"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            {location.name_ar}
                          </h3>
                          <p className="text-sm text-muted-foreground">{location.name}</p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        {location.address_ar && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{location.address_ar}</span>
                          </div>
                        )}
                        {location.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">{location.phone}</span>
                          </div>
                        )}
                        {location.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">{location.email}</span>
                          </div>
                        )}
                        {location.manager_id && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-muted-foreground">مدير الموقع</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleEdit(location.id)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          تعديل
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDelete(location.id, location.name_ar)}
                          disabled={deleteLocation.isPending}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {filteredLocations?.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <p className="text-lg">لا توجد مواقع</p>
                    <p className="text-sm mt-2">قم بإضافة موقع جديد</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

