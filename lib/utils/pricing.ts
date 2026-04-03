import { Pricing, UnitType, GuestType } from '@/lib/types/database'

export interface PricingCalculationParams {
  unitId: string
  checkInDate: string
  checkOutDate: string
  unitType: UnitType
  guestType?: GuestType // 'military' | 'civilian' | 'club_member' | 'artillery_family'
}

export async function calculateReservationPrice(
  params: PricingCalculationParams,
  pricingData: Pricing[]
): Promise<number> {
  const { unitId, checkInDate, checkOutDate, unitType, guestType = 'civilian' } = params

  const checkIn = new Date(checkInDate)
  const checkOut = new Date(checkOutDate)
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

  // Filter pricing rules for this unit from pricing table
  // فلترة قواعد التسعير للوحدة المحددة من جدول pricing
  const unitPricing = pricingData.filter(p => p.unit_id === unitId && p.is_active)

  // إذا لم توجد قواعد تسعير للوحدة، استخدام الأسعار الافتراضية
  if (unitPricing.length === 0) {
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    const defaultPrice = getDefaultPrice(unitType, guestType)
    return nights * defaultPrice
  }

  let totalPrice = 0
  const currentDate = new Date(checkIn)

  // Helper function to get price based on guest type
  // يعتمد على نوع الضيف: مدني، عسكري، عضو دار، أو ابناء مدفعية
  function getPriceForGuestType(pricing: Pricing): number {
    // أولوية: استخدام السعر المخصص لنوع الضيف من جدول pricing
    if (guestType === 'military') {
      // للضيف العسكري: استخدام price_military
      if (pricing.price_military && pricing.price_military > 0) {
        return pricing.price_military
      }
    } else if (guestType === 'club_member') {
      // للضيف عضو دار: استخدام price_member
      if (pricing.price_member && pricing.price_member > 0) {
        return pricing.price_member
      }
    } else if (guestType === 'artillery_family') {
      // لأبناء المدفعية: استخدام price_artillery_family
      if (pricing.price_artillery_family && pricing.price_artillery_family > 0) {
        return pricing.price_artillery_family
      }
    } else {
      // للضيف المدني: استخدام price_civilian
      if (pricing.price_civilian && pricing.price_civilian > 0) {
        return pricing.price_civilian
      }
    }
    
    // Fallback: إذا لم يوجد سعر مخصص، استخدام price_per_night القديم
    if (pricing.price_per_night && pricing.price_per_night > 0) {
      return pricing.price_per_night
    }
    
    return 0
  }

  // Calculate price for each night
  for (let i = 0; i < nights; i++) {
    const nightDate = new Date(currentDate)
    nightDate.setDate(currentDate.getDate() + i)

    // Find applicable pricing rule
    let pricePerNight = 0

    // Check for specific date range pricing
    const dateRangePricing = unitPricing.find(p => {
      if (!p.start_date || !p.end_date) return false
      const start = new Date(p.start_date)
      const end = new Date(p.end_date)
      return nightDate >= start && nightDate <= end
    })

    if (dateRangePricing) {
      pricePerNight = getPriceForGuestType(dateRangePricing)
    } else {
      // Check for pricing type (weekend, holiday, etc.)
      const dayOfWeek = nightDate.getDay()
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 // Friday or Saturday

      if (isWeekend) {
        const weekendPricing = unitPricing.find(p => p.pricing_type === 'weekend')
        if (weekendPricing) {
          pricePerNight = getPriceForGuestType(weekendPricing)
        }
      }

      // Default to standard pricing
      if (!pricePerNight) {
        const standardPricing = unitPricing.find(p => p.pricing_type === 'standard')
        if (standardPricing) {
          pricePerNight = getPriceForGuestType(standardPricing)
        } else {
          // Fallback to default prices based on unit type
          pricePerNight = getDefaultPrice(unitType, guestType)
        }
      }
    }

    totalPrice += pricePerNight
  }

  return totalPrice
}

function getDefaultPrice(unitType: UnitType, guestType: GuestType = 'civilian'): number {
  // Base prices for civilian
  const basePrices: Record<UnitType, number> = {
    room: 200,
    suite: 400,
    chalet: 600,
    duplex: 500,
    villa: 1000,
    apartment: 350,
  }
  
  const basePrice = basePrices[unitType] || 200
  
  // Adjust based on guest type (military and members typically have discounts)
  if (guestType === 'military') {
    return basePrice * 0.8 // 20% discount for military
  } else if (guestType === 'club_member') {
    return basePrice * 0.85 // 15% discount for club members (عضو دار)
  } else if (guestType === 'artillery_family') {
    return basePrice * 0.75 // 25% discount for artillery family (ابناء مدفعية)
  }
  
  return basePrice // Full price for civilian
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(price)
}

