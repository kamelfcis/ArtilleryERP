/** Room block row shape returned by the calendar room-blocks query */
export type CalendarRoomBlock = {
  id: string
  name: string
  name_ar: string
  reason?: string | null
  reason_ar?: string | null
  start_date: string
  end_date: string
  units?: Array<{
    unit?: {
      id: string
      unit_number?: string
      name?: string
      name_ar?: string
    } | null
  }>
}

function datesOverlap(
  checkIn: string,
  checkOut: string,
  blockStart: string,
  blockEnd: string
): boolean {
  const resStart = new Date(checkIn)
  const resEnd = new Date(checkOut)
  const bStart = new Date(blockStart)
  const bEnd = new Date(blockEnd)
  return resStart < bEnd && resEnd > bStart
}

function blockIncludesUnit(block: CalendarRoomBlock, unitId: string): boolean {
  const unitIds =
    block.units?.map((u) => u.unit?.id).filter((id): id is string => Boolean(id)) ?? []
  return unitIds.includes(unitId)
}

/** All room blocks that overlap the given unit and date range */
export function getRoomBlockConflicts(
  unitId: string,
  checkIn: string,
  checkOut: string,
  roomBlocks: CalendarRoomBlock[] | null | undefined
): CalendarRoomBlock[] {
  if (!roomBlocks?.length || !unitId) return []
  return roomBlocks.filter(
    (block) =>
      blockIncludesUnit(block, unitId) &&
      datesOverlap(checkIn, checkOut, block.start_date, block.end_date)
  )
}

export function hasRoomBlockConflict(
  unitId: string,
  checkIn: string,
  checkOut: string,
  roomBlocks: CalendarRoomBlock[] | null | undefined
): boolean {
  return getRoomBlockConflicts(unitId, checkIn, checkOut, roomBlocks).length > 0
}

/** Deduplicated conflicts across multiple units */
export function getRoomBlockConflictsForUnits(
  unitIds: string[],
  checkIn: string,
  checkOut: string,
  roomBlocks: CalendarRoomBlock[] | null | undefined
): CalendarRoomBlock[] {
  const seen = new Set<string>()
  const conflicts: CalendarRoomBlock[] = []
  for (const unitId of unitIds) {
    for (const block of getRoomBlockConflicts(unitId, checkIn, checkOut, roomBlocks)) {
      if (!seen.has(block.id)) {
        seen.add(block.id)
        conflicts.push(block)
      }
    }
  }
  return conflicts
}
