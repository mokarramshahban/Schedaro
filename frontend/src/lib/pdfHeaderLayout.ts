/** Structural PDF schema: deliberately independent of pdfme and the designer. */
export type Schema = {
  name: string
  type: string
  position: { x: number; y: number }
  width: number
  height: number
  [key: string]: unknown
}
export type HeaderLayoutConfig = {
  mode?: 'automatic' | 'legacy' | 'manual'
  headerSpacing?: 'compact' | 'standard' | 'spacious'
  headerBoundaryMm?: number
  headerElementNames?: string[]
  backgroundElementNames?: string[]
  manualTopMm?: number
}
export type HeaderLayoutResult = {
  boundaryMm: number
  /** Bottom of all participating visible header boxes, including images. */
  headerBoxBottomMm: number
  imageBoxBottomMm: number
  savedTopMm: number
  gapMm: number
  topMm: number
  effectiveGapMm: number
  mode: 'automatic' | 'legacy' | 'manual'
  warnings: string[]
  headerElementNames: string[]
}
const GAPS = { compact: 4, standard: 7, spacious: 10 }
const PROTECTED = ['day_', 'time_', 'session_', 'timetable_grid_']
const isProtected = (item: Schema) => PROTECTED.some((prefix) => item.name.startsWith(prefix))
const isText = (item: Schema) => item.type.toLowerCase().includes('text')
const isImage = (item: Schema) => item.type.toLowerCase() === 'image'

/** Resolve geometry only. Never edits, removes, or repositions source objects.
 * Coordinates are millimetres on the existing 297 x 210 landscape page.
 * Invalid boundaries are bounded to 8..194 with an explicit diagnostic.
 */
export function resolveHeaderLayout(
  schemas: readonly Schema[],
  values: Record<string, string>,
  config: HeaderLayoutConfig | undefined,
  fallbackTop: number,
  timetableHeight: number,
): HeaderLayoutResult {
  const settings = config ?? {}
  const mode = settings.mode ?? 'legacy'
  const warnings: string[] = []
  const gapMm = GAPS[settings.headerSpacing ?? 'standard']
  const validTop = (value: number) => Number.isFinite(value) && value >= 0
  const outerTop = schemas.find((item) => item.name === 'timetable_grid_outer-top' && validTop(item.position.y))
  const dayTops = schemas.filter((item) => item.name.startsWith('day_') && validTop(item.position.y)).map((item) => item.position.y)
  let savedTopMm = outerTop?.position.y ?? (dayTops.length ? Math.min(...dayTops) : fallbackTop)
  if (!validTop(savedTopMm)) {
    warnings.push('Saved timetable top is invalid; using 8 mm. Review the saved layout.')
    savedTopMm = 8
  }
  const visible = schemas.filter((item) => {
    if (item.hidden === true || item.visible === false || item.opacity === 0) return false
    if (!isText(item)) return true
    const value = values[item.name] ?? item.content ?? ''
    return typeof value === 'string' && value.trim().length > 0
  })
  const headers: Schema[] = []
  const footers: Schema[] = []
  for (const item of visible) {
    if (isProtected(item)) continue
    if (!Number.isFinite(item.position.y) || !Number.isFinite(item.height) || item.height < 0) {
      warnings.push(`Object "${item.name}" has invalid vertical geometry; excluded from header inference.`)
      continue
    }
    const background = item.region === 'background' || settings.backgroundElementNames?.includes(item.name) || (isImage(item) && item.height >= 170)
    if (background) {
      warnings.push(`Object "${item.name}" is a background/full-page object and is excluded from header inference; use an explicit header boundary guide.`)
      continue
    }
    if (item.region === 'footer' || item.name.startsWith('signature_') || item.position.y >= 159) {
      footers.push(item)
      continue
    }
    const selected = settings.headerElementNames
      ? settings.headerElementNames.includes(item.name)
      : item.region === 'header' || item.position.y < savedTopMm
    if (selected) headers.push(item)
  }
  const bottom = (items: Schema[]) => Math.max(0, ...items.map((item) => item.position.y + item.height))
  const headerBoxBottomMm = bottom(headers)
  const imageBoxBottomMm = bottom(headers.filter(isImage))
  let boundaryMm = settings.headerBoundaryMm ?? Math.max(8, headerBoxBottomMm)
  if (!Number.isFinite(boundaryMm)) {
    warnings.push('Header boundary is not finite; using the inferred boundary within 8..194 mm.')
    boundaryMm = Math.max(8, headerBoxBottomMm)
  }
  if (boundaryMm < 8 || boundaryMm > 194) {
    warnings.push(`Header boundary ${boundaryMm} mm is outside 8..194 mm; bounded to ${Math.min(194, Math.max(8, boundaryMm))} mm. Review the boundary guide.`)
    boundaryMm = Math.min(194, Math.max(8, boundaryMm))
  }
  if (settings.headerBoundaryMm !== undefined) {
    for (const item of headers.filter(isText)) {
      if (item.position.y + item.height > boundaryMm) warnings.push(`Header boundary guide is above visible text box "${item.name}"; the guide is preserved. Review possible overlap.`)
    }
  }
  let topMm = savedTopMm
  if (mode === 'automatic') topMm = boundaryMm + gapMm
  else if (mode === 'manual' && settings.manualTopMm !== undefined) {
    if (validTop(settings.manualTopMm)) topMm = settings.manualTopMm
    else warnings.push('Manual timetable top is invalid; preserving the saved timetable top.')
  }
  if (mode !== 'automatic') warnings.push('Saved/manual timetable placement is preserved; opt in to automatic header spacing to apply the selected gap.')
  const height = Number.isFinite(timetableHeight) && timetableHeight >= 0 ? timetableHeight : 0
  if (height !== timetableHeight) warnings.push('Timetable height is invalid; overlap checks use 0 mm. Review timetable geometry.')
  const tableBottom = topMm + height
  for (const item of footers) {
    if (topMm < item.position.y + item.height && tableBottom > item.position.y) warnings.push(`Timetable overlaps footer object "${item.name}". Objects are preserved; adjust the header guide or footer position.`)
  }
  if (tableBottom > 210) warnings.push(`Timetable extends beyond page bottom (210 mm): bottom is ${tableBottom} mm.`)
  for (const item of visible) {
    if (!isProtected(item) && item.position.y + item.height > 210) warnings.push(`Object "${item.name}" extends beyond page bottom (210 mm).`)
  }
  return { boundaryMm, headerBoxBottomMm, imageBoxBottomMm, savedTopMm, gapMm, topMm, effectiveGapMm: topMm - boundaryMm, mode, warnings, headerElementNames: headers.map((item) => item.name) }
}
