/**
 * Performance utilities for instant loading
 */

/**
 * Prefetch multiple routes in parallel
 */
export function prefetchRoutes(routes: string[], router: any) {
  routes.forEach(route => {
    router.prefetch(route)
  })
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * Check if data is stale based on timestamp
 */
export function isStale(timestamp: number, maxAge: number = 5 * 60 * 1000): boolean {
  return Date.now() - timestamp > maxAge
}

/**
 * Batch multiple operations for better performance
 */
export async function batchOperations<T>(
  operations: (() => Promise<T>)[],
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = []

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(op => op()))
    results.push(...batchResults)
  }

  return results
}








