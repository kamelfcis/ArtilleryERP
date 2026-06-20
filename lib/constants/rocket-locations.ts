/** When set (e.g. Vercel), rocket user sees only these location UUIDs; otherwise name heuristics apply. */
export function getRocketManagedLocationIdsFromEnv(): string[] | null {
  const raw = process.env.NEXT_PUBLIC_ROCKET_MANAGED_LOCATION_IDS
  if (!raw?.trim()) return null
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
}

/** King Tut hotel — hidden from rocket-scoped users. */
export function isKingTutLocation(loc: { name: string; name_ar: string }): boolean {
  const ar = loc.name_ar || ''
  const bundle = `${loc.name} ${loc.name_ar}`.toLowerCase()
  return (
    ar.includes('كينج توت') ||
    bundle.includes('king tut') ||
    (bundle.includes('king') && bundle.includes('tut'))
  )
}

/** Rocket Beach + قرية الندي — fallback when NEXT_PUBLIC_ROCKET_MANAGED_LOCATION_IDS is unset. */
export function isRocketManagedLocation(loc: { name: string; name_ar: string }): boolean {
  const bundle = `${loc.name} ${loc.name_ar}`.toLowerCase()
  const ar = loc.name_ar || ''
  const rocketBeach = bundle.includes('rocket') && bundle.includes('beach')
  const nadiVillage =
    ar.includes('ندي') || bundle.includes('nadi') || bundle.includes('nada')
  return rocketBeach || nadiVillage
}

export function isAlarmEligibleLocation(
  locationId: string | null | undefined,
  locations: Array<{ id: string; name: string; name_ar: string }>
): boolean {
  if (!locationId) return false

  const envIds = getRocketManagedLocationIdsFromEnv()
  if (envIds) return envIds.includes(locationId)

  const loc = locations.find((l) => l.id === locationId)
  if (!loc) return false
  return isRocketManagedLocation(loc)
}
