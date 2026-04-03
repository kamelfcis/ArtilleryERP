'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter } from 'lucide-react'
import { useLocations } from '@/lib/hooks/use-locations'

interface AdvancedSearchProps {
  onSearch: (filters: SearchFilters) => void
  type: 'reservations' | 'guests' | 'units'
}

export interface SearchFilters {
  query?: string
  locationId?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  unitType?: string
  guestType?: string
  minAmount?: string
  maxAmount?: string
}

export function AdvancedSearch({ onSearch, type }: AdvancedSearchProps) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const { data: locations } = useLocations()

  function handleSearch() {
    onSearch(filters)
    setOpen(false)
  }

  function handleReset() {
    setFilters({})
    onSearch({})
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          بحث متقدم
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>بحث متقدم</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-query">البحث</Label>
            <Input
              id="search-query"
              placeholder="ابحث..."
              value={filters.query || ''}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            />
          </div>

          {type === 'reservations' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">الموقع</Label>
                  <Select
                    value={filters.locationId || 'all'}
                    onValueChange={(value) =>
                      setFilters({ ...filters, locationId: value !== 'all' ? value : undefined })
                    }
                  >
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
                  <Label htmlFor="status">الحالة</Label>
                  <Select
                    value={filters.status || 'all'}
                    onValueChange={(value) =>
                      setFilters({ ...filters, status: value !== 'all' ? value : undefined })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="جميع الحالات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                      <SelectItem value="confirmed">مؤكد</SelectItem>
                      <SelectItem value="checked_in">تم تسجيل الدخول</SelectItem>
                      <SelectItem value="checked_out">تم تسجيل الخروج</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date-from">من تاريخ</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to">إلى تاريخ</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    min={filters.dateFrom}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-amount">الحد الأدنى للمبلغ</Label>
                  <Input
                    id="min-amount"
                    type="number"
                    value={filters.minAmount || ''}
                    onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-amount">الحد الأقصى للمبلغ</Label>
                  <Input
                    id="max-amount"
                    type="number"
                    value={filters.maxAmount || ''}
                    onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

          {type === 'units' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">الموقع</Label>
                <Select
                  value={filters.locationId || 'all'}
                  onValueChange={(value) =>
                    setFilters({ ...filters, locationId: value !== 'all' ? value : undefined })
                  }
                >
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
                <Select
                  value={filters.unitType || 'all'}
                  onValueChange={(value) =>
                    setFilters({ ...filters, unitType: value !== 'all' ? value : undefined })
                  }
                >
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
          )}

          {type === 'guests' && (
            <div className="space-y-2">
              <Label htmlFor="guest-type">نوع الضيف</Label>
              <Select
                value={filters.guestType || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, guestType: value !== 'all' ? value : undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="جميع الأنواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="military">عسكري</SelectItem>
                  <SelectItem value="civilian">مدني</SelectItem>
                  <SelectItem value="club_member">عضو دار</SelectItem>
                  <SelectItem value="artillery_family">ابناء مدفعية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleReset}>
              إعادة تعيين
            </Button>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              بحث
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

