'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { Guest } from '@/lib/types/database'

interface GuestPreferencesProps {
  guest: Guest
}

export function GuestPreferences({ guest }: GuestPreferencesProps) {
  const [preferences, setPreferences] = useState({
    preferredUnitType: '',
    preferredLocation: '',
    specialRequests: '',
    dietaryRestrictions: '',
    accessibilityNeeds: '',
  })
  const queryClient = useQueryClient()

  const updatePreferences = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('guests')
        .update({
          notes: JSON.stringify({
            ...JSON.parse(guest.notes || '{}'),
            preferences,
          }),
        })
        .eq('id', guest.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest', guest.id] })
      toast({
        title: 'نجح',
        description: 'تم حفظ التفضيلات بنجاح',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في حفظ التفضيلات',
        variant: 'destructive',
      })
    },
  })

  // Load existing preferences
  useState(() => {
    try {
      const notes = JSON.parse(guest.notes || '{}')
      if (notes.preferences) {
        setPreferences(notes.preferences)
      }
    } catch {
      // Ignore parse errors
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>تفضيلات الضيف</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            updatePreferences.mutate()
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferred-unit-type">نوع الوحدة المفضل</Label>
              <Select
                value={preferences.preferredUnitType}
                onValueChange={(value) =>
                  setPreferences({ ...preferences, preferredUnitType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر النوع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">غرفة</SelectItem>
                  <SelectItem value="suite">جناح</SelectItem>
                  <SelectItem value="chalet">شاليه</SelectItem>
                  <SelectItem value="villa">فيلا</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred-location">الموقع المفضل</Label>
              <Input
                id="preferred-location"
                value={preferences.preferredLocation}
                onChange={(e) =>
                  setPreferences({ ...preferences, preferredLocation: e.target.value })
                }
                placeholder="اسم الموقع"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special-requests">طلبات خاصة</Label>
            <Textarea
              id="special-requests"
              value={preferences.specialRequests}
              onChange={(e) =>
                setPreferences({ ...preferences, specialRequests: e.target.value })
              }
              rows={3}
              placeholder="أي طلبات خاصة للضيف..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dietary-restrictions">قيود غذائية</Label>
            <Input
              id="dietary-restrictions"
              value={preferences.dietaryRestrictions}
              onChange={(e) =>
                setPreferences({ ...preferences, dietaryRestrictions: e.target.value })
              }
              placeholder="مثل: نباتي، حساسية من..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessibility-needs">احتياجات إمكانية الوصول</Label>
            <Input
              id="accessibility-needs"
              value={preferences.accessibilityNeeds}
              onChange={(e) =>
                setPreferences({ ...preferences, accessibilityNeeds: e.target.value })
              }
              placeholder="مثل: كرسي متحرك، غرفة في الطابق الأرضي..."
            />
          </div>

          <Button type="submit" disabled={updatePreferences.isPending}>
            {updatePreferences.isPending ? 'جاري الحفظ...' : 'حفظ التفضيلات'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

