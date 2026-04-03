import { ReservationService, Service } from '@/lib/hooks/use-services'

/**
 * Calculate total amount for services
 */
export function calculateServicesTotal(services: ReservationService[]): number {
  return services.reduce((sum, service) => sum + service.total_amount, 0)
}

/**
 * Group services by type (food vs service)
 */
export function groupServicesByType(services: ReservationService[]) {
  return {
    food: services.filter(s => s.service?.is_food),
    services: services.filter(s => !s.service?.is_food),
  }
}

/**
 * Get most popular services
 */
export function getMostPopularServices(
  services: ReservationService[],
  limit: number = 10
): Array<{ service: Service; count: number; revenue: number }> {
  const grouped = services.reduce((acc, rs) => {
    const serviceId = rs.service_id
    if (!acc[serviceId]) {
      acc[serviceId] = {
        service: rs.service!,
        count: 0,
        revenue: 0,
      }
    }
    acc[serviceId].count += 1
    acc[serviceId].revenue += rs.total_amount
    return acc
  }, {} as Record<string, { service: Service; count: number; revenue: number }>)

  return Object.values(grouped)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

/**
 * Format service name for display
 */
export function formatServiceName(service?: Service): string {
  if (!service) return 'غير معروف'
  return service.name_ar || service.name
}

/**
 * Calculate service revenue for date range
 */
export async function calculateServiceRevenue(
  dateFrom: string,
  dateTo: string,
  serviceId?: string
): Promise<number> {
  // This would be implemented with actual database query
  // For now, return 0 as placeholder
  return 0
}

