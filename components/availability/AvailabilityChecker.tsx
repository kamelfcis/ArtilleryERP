'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle, XCircle, Calendar } from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { useLocations } from '@/lib/hooks/use-locations'

interface AvailabilityCheckerProps {
  onUnitSelect?: (unitId: string) => void
}

export function AvailabilityChecker({ onUnitSelect }: AvailabilityCheckerProps) {
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [locationId, setLocationId] = useState<string>('all')
  const [unitType, setUnitType] = useState<string>('all')
  const { data: locations } = useLocations()

  const { data: availableUnits, isLoading } = useQuery({
    queryKey: ['availability', checkIn, checkOut, locationId, unitType],
    queryFn: async () => {
      if (!checkIn || !checkOut) return []

      const checkInDate = new Date(checkIn)
      const checkOutDate = new Date(checkOut)

      // Get all units
      let unitsQuery = supabase
        .from('units')
        .select('*')
        .eq('is_active', true)
        .eq('status', 'available')

      if (locationId !== 'all') {
        unitsQuery = unitsQuery.eq('location_id', locationId)
      }
      if (unitType !== 'all') {
        unitsQuery = unitsQuery.eq('type', unitType)
      }

      const { data: units, error: unitsError } = await unitsQuery

      if (unitsError) throw unitsError

      // Check reservations for overlapping dates
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('unit_id')
        .in('unit_id', units?.map(u => u.id) || [])
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .or(
          `and(check_in_date.lte.${checkOutDate.toISOString().split('T')[0]},check_out_date.gte.${checkInDate.toISOString().split('T')[0]})`
        )

      if (reservationsError) throw reservationsError

      const bookedUnitIds = new Set(reservations?.map(r => r.unit_id) || [])

      // Filter out booked units
      const available = units?.filter(unit => !bookedUnitIds.has(unit.id)) || []

      return available
    },
    enabled: !!checkIn && !!checkOut && new Date(checkOut) > new Date(checkIn),
  })

  function handleCheck() {
    // Query will run automatically when dates change
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          فحص التوفر
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="check-in">تاريخ الدخول</Label>
            <Input
              id="check-in"
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-out">تاريخ الخروج</Label>
            <Input
              id="check-out"
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="location">الموقع</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="جميع المواقع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المواقع</SelectItem>
                {locations?.map(location => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unit-type">نوع الوحدة</Label>
            <Select value={unitType} onValueChange={setUnitType}>
              <SelectTrigger>
                <SelectValue placeholder="جميع الأنواع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأنواع</SelectItem>
                <SelectItem value="room">غرفة</SelectItem>
                <SelectItem value="suite">جناح</SelectItem>
                <SelectItem value="chalet">شاليه</SelectItem>
                <SelectItem value="villa">فيلا</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {checkIn && checkOut && (
          <div className="pt-4 border-t">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : availableUnits && availableUnits.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600 mb-4">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">
                    {availableUnits.length} وحدة متاحة
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableUnits.map(unit => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => onUnitSelect?.(unit.id)}
                    >
                      <div>
                        <p className="font-medium">
                          {unit.unit_number} - {unit.name_ar || unit.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          السعة: {unit.capacity} أشخاص
                        </p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                <span>لا توجد وحدات متاحة للفترة المحددة</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

