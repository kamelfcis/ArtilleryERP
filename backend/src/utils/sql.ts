/** Build SET clause for parameterized UPDATE from a plain object. */
export function buildUpdateSet(
  data: Record<string, unknown>,
  startIndex = 1
): { setClause: string; values: unknown[] } | null {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return null

  const values: unknown[] = []
  const parts: string[] = []
  let idx = startIndex

  for (const [key, value] of entries) {
    parts.push(`${key} = $${idx}`)
    values.push(value)
    idx++
  }

  return { setClause: parts.join(', '), values }
}

export function pickFields(
  body: Record<string, unknown>,
  allowed: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      out[key] = body[key]
    }
  }
  return out
}
