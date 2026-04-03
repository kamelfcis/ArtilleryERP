'use client'

import { useGuestLoyalty, useApplyLoyaltyDiscount } from '@/lib/hooks/use-loyalty'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/components/ui/use-toast'
import { Award, Star, Gift } from 'lucide-react'
import { useState } from 'react'

interface LoyaltyCardProps {
  guestId: string
  reservationId?: string
}

export function LoyaltyCard({ guestId, reservationId }: LoyaltyCardProps) {
  const { data: loyalty, isLoading } = useGuestLoyalty(guestId)
  const [pointsToUse, setPointsToUse] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const applyDiscount = useApplyLoyaltyDiscount()

  const tierColors = {
    bronze: 'bg-amber-100 text-amber-800',
    silver: 'bg-gray-100 text-gray-800',
    gold: 'bg-yellow-100 text-yellow-800',
    platinum: 'bg-purple-100 text-purple-800',
  }

  const tierLabels = {
    bronze: 'برونزي',
    silver: 'فضي',
    gold: 'ذهبي',
    platinum: 'بلاتيني',
  }

  async function handleApplyDiscount() {
    if (!reservationId) {
      toast({
        title: 'خطأ',
        description: 'لا يوجد حجز محدد',
        variant: 'destructive',
      })
      return
    }

    const points = parseInt(pointsToUse)
    if (isNaN(points) || points <= 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال عدد نقاط صحيح',
        variant: 'destructive',
      })
      return
    }

    if (points > (loyalty?.available_points || 0)) {
      toast({
        title: 'خطأ',
        description: 'النقاط المتاحة غير كافية',
        variant: 'destructive',
      })
      return
    }

    try {
      await applyDiscount.mutateAsync({
        reservationId,
        pointsToUse: points,
      })
      toast({
        title: 'نجح',
        description: `تم تطبيق خصم ${points} ر.س من النقاط`,
      })
      setDialogOpen(false)
      setPointsToUse('')
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في تطبيق الخصم',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-8 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!loyalty) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          برنامج الولاء
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">المستوى</p>
            <p className={`text-lg font-bold px-3 py-1 rounded inline-block ${tierColors[loyalty.tier]}`}>
              {tierLabels[loyalty.tier]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">النقاط المتاحة</p>
            <p className="text-2xl font-bold">{loyalty.available_points}</p>
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">
            إجمالي النقاط المكتسبة: {loyalty.total_points}
          </p>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(100, (loyalty.available_points / Math.max(loyalty.total_points, 1)) * 100)}%`,
              }}
            />
          </div>
        </div>

        {reservationId && loyalty.available_points > 0 && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Gift className="mr-2 h-4 w-4" />
                استخدام النقاط
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>استخدام نقاط الولاء</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    النقاط المتاحة: {loyalty.available_points}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    كل نقطة = 1 ر.س خصم
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="points">عدد النقاط</Label>
                  <Input
                    id="points"
                    type="number"
                    min="1"
                    max={loyalty.available_points}
                    value={pointsToUse}
                    onChange={(e) => setPointsToUse(e.target.value)}
                    placeholder={`الحد الأقصى: ${loyalty.available_points}`}
                  />
                </div>
                {pointsToUse && !isNaN(parseInt(pointsToUse)) && (
                  <div className="p-3 bg-muted rounded">
                    <p className="text-sm">
                      الخصم: {parseInt(pointsToUse)} ر.س
                    </p>
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleApplyDiscount}
                    disabled={applyDiscount.isPending || !pointsToUse}
                  >
                    {applyDiscount.isPending ? 'جاري التطبيق...' : 'تطبيق'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <Star className="inline h-3 w-3 mr-1" />
            احصل على نقطة واحدة لكل 10 ر.س تنفقها
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

