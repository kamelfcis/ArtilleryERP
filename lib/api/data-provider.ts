export type DataProvider = 'supabase' | 'api'

export function getDataProvider(): DataProvider {
  const value = process.env.NEXT_PUBLIC_DATA_PROVIDER?.trim().toLowerCase()
  return value === 'api' ? 'api' : 'supabase'
}

export function isApiProvider(): boolean {
  return getDataProvider() === 'api'
}

export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!url) {
    throw new Error('NEXT_PUBLIC_API_URL is required when NEXT_PUBLIC_DATA_PROVIDER=api')
  }
  return url
}
