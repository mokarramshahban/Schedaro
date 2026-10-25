import { describe, expect, it } from 'vitest'
import { resolveHeaderLayout, type HeaderLayoutConfig, type Schema } from './pdfHeaderLayout'

const box = (name: string, y: number, height: number, extra: Partial<Schema> = {}): Schema => ({ name, type: 'text', position: { x: 15, y }, width: 100, height, content: 'Visible', ...extra })
const resolve = (schemas: Schema[], config: HeaderLayoutConfig = { mode: 'automatic' }, values: Record<string, string> = {}, height = 100) => resolveHeaderLayout(schemas, values, config, 70, height)

describe('standalone PDF header layout', () => {
  it('uses exact 4/7/10 mm gaps with no fixed reserve', () => {
    const schemas = [box('custom_text_title', 8, 12)]
    const results = (['compact', 'standard', 'spacious'] as const).map((headerSpacing) => resolve(schemas, { mode: 'automatic', headerSpacing }))
    expect(results.map((result) => result.topMm)).toEqual([24, 27, 30])
    expect(results.map((result) => result.effectiveGapMm)).toEqual([4, 7, 10])
  })

  it.each([[12, 25], [85, 98]])('measures image height %s rather than reserving 64 mm', (height, top) => {
    const result = resolve([box('logo', 6, height, { type: 'image' })])
    expect(result.imageBoxBottomMm).toBe(6 + height)
    expect(result.topMm).toBe(top)
  })

  it('excludes full-page and named background images and uses the guide', () => {
    const result = resolve([box('fullpage', 0, 170, { type: 'image' }), box('watermark', 0, 100, { type: 'image' }), box('paper', 0, 200, { type: 'rectangle', region: 'background' })], { mode: 'automatic', headerBoundaryMm: 35, backgroundElementNames: ['watermark'] })
    expect(result.topMm).toBe(42)
    expect(result.imageBoxBottomMm).toBe(0)
    expect(result.headerElementNames).toEqual([])
    for (const name of ['fullpage', 'watermark', 'paper']) expect(result.warnings.some((warning) => warning.includes(`"${name}"`) && warning.includes('guide'))).toBe(true)
  })

  it('ignores hidden, transparent, empty, protected, and footer objects', () => {
    const schemas = [box('title', 8, 10), box('hidden', 20, 70, { hidden: true }), box('invisible', 20, 70, { visible: false }), box('transparent', 20, 70, { opacity: 0 }), box('empty', 20, 70), box('whitespace', 20, 70, { content: ' \n ' }), box('day_monday', 70, 10), box('time_header', 70, 10), box('session_a', 60, 80), box('timetable_grid_outer-bottom', 150, 1), box('signature_label_1', 20, 5), box('footer', 20, 5, { region: 'footer' }), box('bottom_note', 159, 10)]
    const result = resolve(schemas, { mode: 'automatic' }, { empty: '' })
    expect(result.headerElementNames).toEqual(['title'])
    expect(result.boundaryMm).toBe(18)
  })

  it('infers custom text above the saved table and respects an explicit selection', () => {
    const schemas = [box('day_monday', 90, 7), box('custom_text_1', 80, 5), box('other', 100, 5)]
    expect(resolve(schemas).headerElementNames).toEqual(['custom_text_1'])
    expect(resolve(schemas, { mode: 'automatic', headerElementNames: ['other', 'day_monday'] }).headerElementNames).toEqual(['other'])
  })

  it('preserves guide padding and never silently pushes a guide below visible text', () => {
    const schemas = [box('college_name', 8, 20)]
    expect(resolve(schemas, { mode: 'automatic', headerBoundaryMm: 40 }).topMm).toBe(47)
    const result = resolve(schemas, { mode: 'automatic', headerBoundaryMm: 18 })
    expect(result.topMm).toBe(25)
    expect(result.headerBoxBottomMm).toBe(28)
    expect(result.warnings.join(' ')).toContain('"college_name"')
    expect(result.warnings.join(' ')).toContain('guide is preserved')
  })

  it.each([-10, 200, NaN, Infinity])('reports invalid boundary %s rather than silently clamping', (headerBoundaryMm) => {
    const result = resolve([], { mode: 'automatic', headerBoundaryMm })
    expect(result.boundaryMm).toBeGreaterThanOrEqual(8)
    expect(result.boundaryMm).toBeLessThanOrEqual(194)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('bounds oversized inferred boxes with a warning', () => {
    const result = resolve([box('oversized_text', 10, 200)])
    expect(result.boundaryMm).toBe(194)
    expect(result.warnings.join(' ')).toContain('outside 8..194')
  })

  it('defaults to legacy and prefers saved outer-top, then day top, then fallback', () => {
    const day = box('day_monday', 78, 7)
    const outer = box('timetable_grid_outer-top', 76, 0.7, { type: 'line' })
    const legacy = (schemas: Schema[]) => resolveHeaderLayout(schemas, {}, undefined, 65, 80)
    expect(legacy([day, outer])).toMatchObject({ mode: 'legacy', topMm: 76, savedTopMm: 76 })
    expect(legacy([day]).topMm).toBe(78)
    expect(legacy([]).topMm).toBe(65)
    expect(legacy([]).warnings.join(' ')).toContain('opt in')
    expect(resolve([day], { mode: 'manual', manualTopMm: 88 }).topMm).toBe(88)
  })

  it('names conflicting footer/page-bottom objects and preserves all inputs', () => {
    const schemas = [box('title', 8, 20), box('signature_dean', 170, 5), box('footer_note_exact', 205, 10)]
    const before = JSON.stringify(schemas)
    const config: HeaderLayoutConfig = { mode: 'automatic', headerBoundaryMm: 100 }
    const values = { title: 'Heading' }
    const result = resolve(schemas, config, values, 110)
    expect(result.warnings.join(' ')).toContain('"signature_dean"')
    expect(result.warnings.join(' ')).toContain('"footer_note_exact"')
    expect(result.warnings.join(' ')).toContain('Timetable extends beyond page bottom')
    expect(JSON.stringify(schemas)).toBe(before)
    expect(config).toEqual({ mode: 'automatic', headerBoundaryMm: 100 })
    expect(values).toEqual({ title: 'Heading' })
  })

  it('does not report a footer touched but not overlapped by the table', () => {
    expect(resolve([box('signature_line', 159, 1)], { mode: 'automatic', headerBoundaryMm: 52 }, {}, 100).warnings).toEqual([])
  })
})
