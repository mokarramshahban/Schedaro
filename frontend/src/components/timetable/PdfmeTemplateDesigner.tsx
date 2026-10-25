import { Copy, Download, ImagePlus, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Template } from '@pdfme/common'
import { generate } from '@pdfme/generator'
import { image, line, rectangle, text } from '@pdfme/schemas'
import type { AcademicTerm, ClassGroup, Department, Institution, Resource, Semester } from '../../lib/api'
import { createPdfmeTemplate as createPdfmeTemplateRecord, listPdfmeTemplates, updatePdfmeTemplate } from '../../lib/managementApi'
import type { PdfmeTemplateRecord } from '../../lib/printLayout'
import { DAY_LABELS, SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, sessionCardGeometry, timeLabelY, type TimetableSession } from '../../lib/timetable'
import { resolveHeaderLayout, type HeaderLayoutConfig } from '../../lib/pdfHeaderLayout'

const pdfmePlugins = { text, image, line, rectangle }
const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const PROTECTED_PREFIXES = ['day_', 'time_', 'session_', 'timetable_grid_']
const dynamicLabels: Record<string, string> = { institution_name: 'College name', department_name: 'Department', timetable_title: 'Timetable title', semester_section: 'Semester and section', academic_term: 'Academic term' }
export const TIMETABLE_PRESENTATION = { colors: { grid: '#c4cad3', header: '#e3e7ed', time: '#5b6472', lecture: { fill: '#f4f1ff', border: '#8d7bc7', accent: '#5d49a8' }, laboratory: { fill: '#eef8f1', border: '#79ad88', accent: '#35734a' }, tutorial: { fill: '#fff7e8', border: '#d2a256', accent: '#986517' }, default: { fill: '#f1f4f8', border: '#8b98a8', accent: '#465467' } }, cardPadding: 1.2, subjectSize: 7.8, metaSize: 5.4, detailSize: 5.1 } as const
function sessionPresentation(type: string) { const normalized = type.toLowerCase(); if (normalized.includes('lab')) return TIMETABLE_PRESENTATION.colors.laboratory; if (normalized.includes('tutorial')) return TIMETABLE_PRESENTATION.colors.tutorial; if (normalized.includes('lecture')) return TIMETABLE_PRESENTATION.colors.lecture; return TIMETABLE_PRESENTATION.colors.default }
type PdfmeSchema = { name: string; type: string; position: { x: number; y: number }; width: number; height: number; [key: string]: unknown }
type DesignerContext = { institution: Institution; department: Department; semester: Semester; group: ClassGroup; term?: AcademicTerm; resources: { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }; sessions: TimetableSession[]; workingDays: TimetableSession['day'][] }
type Props = DesignerContext & { institutionId: string; initialTemplateId?: string | null; onClose: () => void; onSaved?: (record: PdfmeTemplateRecord) => void }
type Interaction = { name: string; mode: 'move' | 'resize'; startX: number; startY: number; original: PdfmeSchema; canvas: HTMLElement }
type PersistedPdfmeTemplate = Template & { __schedaroAssets?: { letterhead?: string }; __schedaroInputs?: Record<string, string>; __schedaroLayout?: HeaderLayoutConfig }

function schema(name: string, type: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}): PdfmeSchema { return { name, type, position: { x, y }, width, height, ...extra } }
function resourceLabel(items: Resource[], id: string, fallback: string) { const item = items.find((entry) => entry.id === id); return item ? `${item.code ? `${item.code} · ` : ''}${item.name}` : fallback }
export function fitPdfText(textValue: string, maxWidthMm: number, fontSize: number) { const maxChars = Math.max(1, Math.floor(maxWidthMm / Math.max(0.35, fontSize * 0.18))); if (textValue.length <= maxChars) return textValue; if (maxChars <= 1) return '…'; return `${textValue.slice(0, maxChars - 1).trimEnd()}…` }
export type PdfSessionContent = { subject: string; subjectFontSize: number; subjectHeight: number; time?: string; type?: string; details?: string; timeOffset?: number; typeOffset?: number; detailsOffset?: number; detailsHeight?: number }
export function pdfSessionContent(cardWidth: number, cardHeight: number, subject: string, type: string, time: string, teacher: string, room: string): PdfSessionContent {
  const width = Math.max(8, cardWidth - 3.2)
  const usableHeight = Math.max(0, cardHeight - 0.8)
  const subjectFontSize = usableHeight < 5 ? 5.1 : usableHeight < 9 ? 5.6 : 6.4
  const content: PdfSessionContent = { subject: fitPdfText(subject, width, subjectFontSize), subjectFontSize, subjectHeight: Math.min(2.8, Math.max(2.2, usableHeight - 0.2)) }
  if (usableHeight >= 5) { content.time = fitPdfText(time, width, 4.8); content.timeOffset = 3.05 }
  if (usableHeight >= 7.2) { content.type = type; content.typeOffset = 5.0 }
  if (usableHeight >= 11.2) { content.details = `${fitPdfText(teacher, width, 4.5)} · ${fitPdfText(room, width, 4.5)}`; content.detailsOffset = 7.0; content.detailsHeight = Math.max(1.5, usableHeight - 7.2) }
  return content
}
function minutes(value: string) { const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins }
export type HeaderSpacing = 'compact' | 'standard' | 'spacious'
export const HEADER_GAPS: Record<HeaderSpacing, number> = { compact: 4, standard: 7, spacious: 10 }
export const PRINT_HEADER_ROW_INSET_MM = 1
export type TimetableGeometry = { left: number; top: number; width: number; timeWidth: number; dayWidth: number; headerHeight: number; gridTop: number; gridHeight: number; gridBottom: number; startMinutes: number; endMinutes: number; headerGap: number }
export function timetableGeometry(workingDays: TimetableSession['day'][], hasLetterhead = false, spacing: HeaderSpacing = 'standard'): TimetableGeometry { const timeWidth = 18; const width = 267; const headerHeight = 7; const headerBottom = hasLetterhead ? 64 : 44; const top = Math.max(50, headerBottom + HEADER_GAPS[spacing]); const gridTop = top + 8; const gridBottom = 159; const gridHeight = Math.max(62, gridBottom - gridTop); return { left: 15, top, width, timeWidth, dayWidth: (width - timeWidth) / Math.max(workingDays.length, 1), headerHeight, gridTop, gridHeight, gridBottom: gridTop + gridHeight, startMinutes: SCHEDULE_START_MINUTES, endMinutes: SCHEDULE_END_MINUTES, headerGap: HEADER_GAPS[spacing] } }
function isProtected(item: PdfmeSchema) { return PROTECTED_PREFIXES.some((prefix) => item.name.startsWith(prefix)) || item.name === 'time_header' }
function schemaLabel(item: PdfmeSchema) { if (dynamicLabels[item.name]) return dynamicLabels[item.name]; if (item.name === 'letterhead') return 'College letterhead'; if (item.name.startsWith('signature_label_')) return 'Signature label'; if (item.name.startsWith('signature_secondary_')) return 'Signature details'; if (item.name.startsWith('signature_line_')) return 'Signature line'; if (item.name.startsWith('custom_text_')) return 'Custom text'; if (item.type === 'image') return 'Image / logo'; if (item.type === 'line') return 'Divider line'; return 'Text' }

export function createPdfmeTemplate(context: DesignerContext, signatureCount = 0, letterheadData?: string, headerSpacing: HeaderSpacing = 'standard'): { template: Template; inputs: Record<string, string> } {
  const { institution, department, semester, group, term, resources, sessions, workingDays } = context
  const schemas: PdfmeSchema[] = []
  const inputs: Record<string, string> = {}
  const addText = (name: string, value: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) => { schemas.push(schema(name, 'text', x, y, width, height, { fontSize: 10, alignment: 'left', readOnly: false, ...extra })); inputs[name] = value }
  if (letterheadData) { schemas.push(schema('letterhead', 'image', 10, 6, 277, 24, { preserveAspectRatio: true, readOnly: false })); inputs.letterhead = letterheadData }
  addText('institution_name', institution.name, 15, letterheadData ? 31 : 8, 267, 9, { fontSize: 18, alignment: 'center', readOnly: false })
  addText('department_name', department.name, 15, letterheadData ? 41 : 20, 267, 7, { fontSize: 10, alignment: 'center', readOnly: false })
  addText('timetable_title', 'Weekly Academic Timetable', 15, letterheadData ? 49 : 29, 267, 7, { fontSize: 12, alignment: 'center', readOnly: false })
  addText('semester_section', `${semester.label} — ${group.sectionName}`, 15, letterheadData ? 58 : 38, 130, 6, { fontSize: 8, readOnly: false })
  addText('academic_term', term ? `${term.academicYear} · ${term.term}` : 'Academic term not configured', 152, letterheadData ? 58 : 38, 130, 6, { fontSize: 8, alignment: 'right', readOnly: false })
  const geometry = timetableGeometry(workingDays, Boolean(letterheadData), 'standard')
  const { left, top, timeWidth, dayWidth, headerHeight, gridTop, gridHeight, gridBottom, startMinutes, endMinutes } = geometry
  const headerTextTop = top + PRINT_HEADER_ROW_INSET_MM
  const headerTextHeight = headerHeight - PRINT_HEADER_ROW_INSET_MM * 2
  addText('time_header', 'Time', left, headerTextTop, timeWidth, headerTextHeight, { fontSize: 7, alignment: 'center', readOnly: true })
  workingDays.forEach((day, index) => addText(`day_${day}`, DAY_LABELS[day], left + timeWidth + index * dayWidth, headerTextTop, dayWidth, headerTextHeight, { fontSize: 7.5, alignment: 'center', readOnly: true }))
  for (let index = 0; index <= 8; index += 1) addText(`time_${index}`, `${String(9 + index).padStart(2, '0')}:00`, left, timeLabelY(SCHEDULE_START_MINUTES + index * 60, SCHEDULE_START_MINUTES, SCHEDULE_END_MINUTES, gridTop, gridBottom), timeWidth, 4, { fontSize: 6, alignment: 'center', readOnly: true })
  const gridRight = left + geometry.width
  const addGridLine = (name: string, x: number, y: number, width: number, height: number, color = '#aeb6c2', rotate = 0, opacity = 1) => schemas.push(schema(`timetable_grid_${name}`, 'line', x, y, width, height, { color, rotate, opacity, readOnly: true }))
  const addVerticalGridLine = (name: string, x: number, color = '#aeb6c2', opacity = 1) => { const length = gridBottom - top; addGridLine(name, x - length / 2, top + length / 2 - 0.25, length, 0.5, color, 90, opacity) }
  addGridLine('outer-top', left, top, geometry.width, 0.7)
  addGridLine('outer-bottom', left, gridBottom, geometry.width, 0.7)
  addVerticalGridLine('outer-left', left)
  addVerticalGridLine('outer-right', gridRight)
  addGridLine('header-bottom', left, gridTop, geometry.width, 0.7, '#7d8795')
  addVerticalGridLine('time-gutter', left + timeWidth, '#7d8795')
  workingDays.forEach((_, index) => addVerticalGridLine(`day-${index}`, left + timeWidth + index * dayWidth))
  for (let index = 1; index < 8; index += 1) addGridLine(`hour-${index}`, left + timeWidth, gridTop + (index / 8) * gridHeight, geometry.width - timeWidth, 0.45, TIMETABLE_PRESENTATION.colors.grid, 0, 0.9)
  const start = startMinutes
  const end = endMinutes
  sessions.filter((session) => workingDays.includes(session.day)).forEach((session) => {
    const dayIndex = workingDays.indexOf(session.day)
    const sessionStart = Math.max(start, minutes(session.startTime))
    const sessionEnd = Math.min(end, minutes(session.endTime))
    if (sessionEnd <= sessionStart) return
    const outerX = left + timeWidth + dayIndex * dayWidth
    const outerY = gridTop + ((sessionStart - start) / (end - start)) * gridHeight
    const outerHeight = Math.max(5.8, ((sessionEnd - sessionStart) / (end - start)) * gridHeight)
    const outerWidth = dayWidth
    const card = sessionCardGeometry(outerX, outerY, outerWidth, outerHeight)
    const { x, y, width: cardWidth, height: h } = card
    const style = sessionPresentation(session.type)
    const subject = resourceLabel(resources.subjects, session.subjectId, 'Subject unavailable')
    const teacher = resourceLabel(resources.teachers, session.teacherId, 'Teacher unavailable')
    const room = resourceLabel(resources.rooms, session.roomId, 'Room unavailable')
    schemas.push(schema(`session_card_${session.id}`, 'rectangle', x, y, cardWidth, h, { color: style.fill, borderColor: style.border, borderWidth: 0.35, opacity: 1, radius: 0.8, readOnly: true }))
    schemas.push(schema(`session_accent_${session.id}`, 'rectangle', x, y, 1.2, h, { color: style.accent, borderColor: style.accent, borderWidth: 0, opacity: 1, readOnly: true }))
    const content = pdfSessionContent(cardWidth, h, subject, session.type, `${session.startTime}–${session.endTime}`, teacher, room)
    const textX = x + 2.2
    const textWidth = cardWidth - 3.2
    if (!content.time) {
      addText(`session_info_${session.id}`, content.subject, textX, y + 0.4, textWidth, content.subjectHeight, { fontSize: content.subjectFontSize, alignment: 'left', lineHeight: 1, readOnly: true })
    } else {
      addText(`session_subject_${session.id}`, content.subject, textX, y + 0.4, textWidth, content.subjectHeight, { fontSize: content.subjectFontSize, alignment: 'left', lineHeight: 1, readOnly: true })
      addText(`session_meta_${session.id}`, content.time, textX, y + (content.timeOffset ?? 3.05), textWidth, 1.8, { fontSize: 4.8, alignment: 'left', lineHeight: 1, readOnly: true })
      if (content.type) addText(`session_type_${session.id}`, content.type, textX, y + (content.typeOffset ?? 5), textWidth, 1.8, { fontSize: 4.5, alignment: 'left', lineHeight: 1, readOnly: true })
      if (content.details) addText(`session_details_${session.id}`, content.details, textX, y + (content.detailsOffset ?? 7), textWidth, content.detailsHeight ?? 1.5, { fontSize: 4.5, alignment: 'left', lineHeight: 1, readOnly: true })
    }
  })
  for (let index = 0; index < signatureCount; index += 1) {
    const columns = Math.min(signatureCount, 4)
    const width = (267 - (columns - 1) * 4) / columns
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = 15 + column * (width + 4)
    const y = gridBottom + 7 + row * 15
    schemas.push(schema(`signature_line_${index}`, 'line', x, y + 7, width, 0.7, { color: '#4b5563', opacity: 1, rotate: 0, readOnly: false }))
    addText(`signature_label_${index}`, ['Prepared By', 'Class In-Charge', 'Head of Department', 'Dean', 'Director', 'Registrar', 'Principal'][index] ?? `Signature ${index + 1}`, x, y + 9, width, 5, { fontSize: 7, alignment: 'center', readOnly: false })
    addText(`signature_secondary_${index}`, '', x, y + 14, width, 5, { fontSize: 6, alignment: 'center', readOnly: false })
  }
  const layout: HeaderLayoutConfig = { mode: 'automatic', headerSpacing }
  const placement = resolveHeaderLayout(schemas, inputs, layout, top, gridBottom - top)
  const positioned = reflowTimetable(schemas, top, placement.topMm)
  return { template: { basePdf: { width: PAGE_WIDTH, height: PAGE_HEIGHT, padding: [8, 8, 8, 8] }, schemas: [positioned], __schedaroLayout: layout } as Template, inputs }
}

function isLegacyDefaultSignature(item: PdfmeSchema, persisted: PersistedPdfmeTemplate) {
  return !persisted.__schedaroInputs && /^signature_(line|label|secondary)_[0-2]$/.test(item.name)
}

function reflowTimetable(schemas: PdfmeSchema[], sourceTop: number, targetTop: number): PdfmeSchema[] {
  const sourceBottom = schemas.find((item) => item.name === 'timetable_grid_outer-bottom')?.position.y ?? 159
  const sourceHeight = Math.max(1, sourceBottom - sourceTop)
  const scale = Math.max(0.1, (sourceBottom - targetTop) / sourceHeight)
  return schemas.map((item) => {
    if (!isProtected(item)) return item
    const y = targetTop + (item.position.y - sourceTop) * scale
    const isVerticalLine = item.type === 'line' && Number(item.rotate ?? 0) % 180 !== 0
    if (isVerticalLine) {
      const width = item.width * scale
      return { ...item, position: { x: item.position.x + (item.width - width) / 2, y }, width }
    }
    return { ...item, position: { ...item.position, y }, ...(item.type === 'rectangle' || item.name.startsWith('session_') || item.name.startsWith('time_') ? { height: item.height * scale } : {}) }
  })
}

export function documentPlacement(template: Template, inputs: Record<string, string>) {
  const items = template.schemas[0] as PdfmeSchema[]
  const top = items.find((item) => item.name === 'timetable_grid_outer-top')?.position.y ?? items.find((item) => item.name.startsWith('day_'))?.position.y ?? 50
  const bottom = items.find((item) => item.name === 'timetable_grid_outer-bottom')?.position.y ?? 159
  return resolveHeaderLayout(items, inputs, (template as PersistedPdfmeTemplate).__schedaroLayout, top, bottom - top)
}

export function materializePdfmeTemplate(template: Template, context: DesignerContext): Template {
  const persisted = template as PersistedPdfmeTemplate
  const generated = createPdfmeTemplate(context, 0, persisted.__schedaroAssets?.letterhead, persisted.__schedaroLayout?.headerSpacing ?? 'standard')
  const protectedSchemas = (generated.template.schemas[0] as PdfmeSchema[]).filter(isProtected)
  const editableSchemas = (template.schemas[0] as PdfmeSchema[]).filter((item) => !isProtected(item) && !isLegacyDefaultSignature(item, persisted))
  const sourceTop = protectedSchemas.find((item) => item.name === 'timetable_grid_outer-top')!.position.y
  const values = hydratePdfmeInputs(template, context, persisted.__schedaroAssets, persisted.__schedaroInputs)
  const placement = documentPlacement(template, values)
  return { ...template, schemas: [[...editableSchemas, ...reflowTimetable(protectedSchemas, sourceTop, placement.topMm)]] } as Template
}

export function hydratePdfmeInputs(template: Template, context: DesignerContext, assets?: { letterhead?: string }, savedInputs?: Record<string, string>): Record<string, string> {
  const persistedTemplate = template as PersistedPdfmeTemplate
  const dynamic = createPdfmeTemplate(context, 0, persistedTemplate.__schedaroAssets?.letterhead, persistedTemplate.__schedaroLayout?.headerSpacing ?? 'standard').inputs
  const persisted = savedInputs ?? persistedTemplate.__schedaroInputs
  const values: Record<string, string> = {}
  for (const page of template.schemas) for (const item of page as PdfmeSchema[]) values[item.name] = dynamic[item.name] ?? persisted?.[item.name] ?? String(item.content ?? '')
  if (assets?.letterhead) values.letterhead = assets.letterhead
  return values
}
export function persistableTemplate(template: Template, inputs: Record<string, string>): Record<string, unknown> {
  const savedInputs = Object.fromEntries(Object.entries(inputs).filter(([name]) => name !== 'letterhead' && !dynamicLabels[name] && !PROTECTED_PREFIXES.some((prefix) => name.startsWith(prefix)) && name !== 'time_header'))
  return { ...(template as unknown as Record<string, unknown>), __schedaroAssets: inputs.letterhead ? { letterhead: inputs.letterhead } : undefined, __schedaroInputs: savedInputs }
}

export function exportablePdfmeTemplate(template: Template): Template {
  return { ...template, schemas: template.schemas.map((page) => page.map((item) => { const { readOnly: _readOnly, ...exported } = item as PdfmeSchema; return exported })) } as Template
}

export function generatePdfmePdf(template: Template, inputs: Record<string, string>) { return generate({ template: exportablePdfmeTemplate(template), inputs: [inputs], plugins: pdfmePlugins }) }

function TimetableCanvas({ template, inputs }: { template: Template; inputs: Record<string, string> }) {
  return <svg viewBox="0 0 297 210" width="100%" height="100%" aria-label="Protected timetable preview">
    {(template.schemas[0] as PdfmeSchema[]).filter(isProtected).map((item) => {
      const { x, y } = item.position
      if (item.type === 'line') return <rect key={item.name} x={x} y={y} width={item.width} height={item.height} fill={String(item.color)} opacity={Number(item.opacity ?? 1)} transform={`rotate(${Number(item.rotate ?? 0)} ${x + item.width / 2} ${y + item.height / 2})`} />
      if (item.type === 'rectangle') return <rect key={item.name} x={x} y={y} width={item.width} height={item.height} rx={Number(item.radius ?? 0)} fill={String(item.color)} stroke={String(item.borderColor)} strokeWidth={Number(item.borderWidth ?? 0)} />
      return <foreignObject key={item.name} x={x} y={y} width={item.width} height={item.height}><div style={{ fontSize: `${Number(item.fontSize ?? 10) * 25.4 / 72}px`, lineHeight: Number(item.lineHeight ?? 1.2), textAlign: item.alignment as 'left' | 'center' | 'right', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#172033' }}>{inputs[item.name]}</div></foreignObject>
    })}
  </svg>
}

export function PdfmeTemplateDesigner({ institutionId, initialTemplateId, onClose, onSaved, ...context }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const [record, setRecord] = useState<PdfmeTemplateRecord | null>(null)
  const [newTemplateMode, setNewTemplateMode] = useState(false)
  const [template, setTemplate] = useState<Template>(() => createPdfmeTemplate(context).template)
  const [inputs, setInputs] = useState<Record<string, string>>(() => createPdfmeTemplate(context).inputs)
  const [templates, setTemplates] = useState<PdfmeTemplateRecord[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [name, setName] = useState('Standard academic timetable')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [letterheadMode, setLetterheadMode] = useState<'header' | 'full'>('header')
  const resolvedTemplate = useMemo(() => materializePdfmeTemplate(persistableTemplate(template, inputs) as Template, context), [template, inputs, context.institution, context.department, context.semester, context.group, context.term, context.sessions, context.workingDays, context.resources])
  const placement = documentPlacement(resolvedTemplate, inputs)
  const schemas = (resolvedTemplate.schemas[0] ?? []) as PdfmeSchema[]
  const layoutConfig = (template as PersistedPdfmeTemplate).__schedaroLayout ?? {}
  const layoutSpacing = layoutConfig.headerSpacing ?? 'standard'
  const selected = schemas.find((item) => item.name === selectedName) ?? null
  const layoutWarnings = placement.warnings.filter((warning) => !warning.startsWith('Saved/manual timetable placement'))
  const contextKey = `${context.institution.id}:${context.department.id}:${context.semester.id}:${context.group.id}:${context.term?.id ?? ''}:${context.workingDays.join(',')}:${context.sessions.map((session) => `${session.id}:${session.startTime}:${session.endTime}:${session.subjectId}:${session.teacherId}:${session.roomId}`).join('|')}`

  useEffect(() => { let active = true; setTemplatesLoading(true); void listPdfmeTemplates(institutionId).then((items) => { if (!active) return; setTemplates(items); const selectedItem = items.find((item) => item.id === initialTemplateId) ?? items.find((item) => item.isDefault) ?? items[0]; if (selectedItem) { const loaded = selectedItem.template as PersistedPdfmeTemplate; setRecord(selectedItem); setNewTemplateMode(false); setName(selectedItem.name); const current = materializePdfmeTemplate(loaded, context); setTemplate(current); setInputs(hydratePdfmeInputs(current, context, loaded.__schedaroAssets, loaded.__schedaroInputs)) } }).catch(() => { if (active) setNotice('No saved template found. Start with the standard academic layout.') }).finally(() => { if (active) setTemplatesLoading(false) }); return () => { active = false } }, [institutionId, initialTemplateId])
  useEffect(() => { if (record) { const loaded = template as PersistedPdfmeTemplate; const current = materializePdfmeTemplate(loaded, context); setTemplate(current); setInputs(hydratePdfmeInputs(current, context, loaded.__schedaroAssets, loaded.__schedaroInputs)); return } if (newTemplateMode) { const current = materializePdfmeTemplate(template as PersistedPdfmeTemplate, context); setTemplate(current); setInputs(hydratePdfmeInputs(current, context, (template as PersistedPdfmeTemplate).__schedaroAssets, (template as PersistedPdfmeTemplate).__schedaroInputs)) } else { const generated = createPdfmeTemplate(context); setInputs(generated.inputs); setTemplate(generated.template) } }, [contextKey, record?.id, newTemplateMode])
  useEffect(() => {
    if (!interactionRef.current) return
    const move = (event: PointerEvent) => { const interaction = interactionRef.current; if (!interaction) return; const rect = interaction.canvas.getBoundingClientRect(); const dx = ((event.clientX - interaction.startX) / rect.width) * PAGE_WIDTH; const dy = ((event.clientY - interaction.startY) / rect.height) * PAGE_HEIGHT; const original = interaction.original; const next = interaction.mode === 'move' ? { x: original.position.x + dx, y: original.position.y + dy } : original.position; const width = interaction.mode === 'resize' ? Math.min(PAGE_WIDTH - next.x, Math.max(8, original.width + dx)) : original.width; const height = interaction.mode === 'resize' ? Math.min(PAGE_HEIGHT - next.y, Math.max(3, original.height + dy)) : original.height; updateSchema(interaction.name, { position: { x: Math.max(0, Math.min(PAGE_WIDTH - width, next.x)), y: Math.max(0, Math.min(PAGE_HEIGHT - height, next.y)) }, width, height }) }
    const stop = () => { interactionRef.current = null }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
  })

  function updateSchema(nameToUpdate: string, patch: Partial<PdfmeSchema>) { setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]).map((item) => item.name === nameToUpdate ? { ...item, ...patch } : item)]] })) }
  function setLayout(patch: Partial<HeaderLayoutConfig>) { setTemplate((current) => ({ ...current, __schedaroLayout: { ...(current as PersistedPdfmeTemplate).__schedaroLayout, ...patch } } as Template)) }
  function setHeaderSpacing(value: HeaderSpacing) { setLayout({ mode: 'automatic', headerSpacing: value }) }
  function applyAutomaticSpacing() { setLayout({ mode: 'automatic', headerSpacing: layoutSpacing }) }
  function setHeaderBoundary(value: string) { setLayout({ mode: 'automatic', headerBoundaryMm: value === '' ? undefined : Number(value) }) }
  function startInteraction(event: ReactPointerEvent<HTMLElement>, item: PdfmeSchema, mode: Interaction['mode']) { event.preventDefault(); event.stopPropagation(); setSelectedName(item.name); if (canvasRef.current) interactionRef.current = { name: item.name, mode, startX: event.clientX, startY: event.clientY, original: item, canvas: canvasRef.current } }
  function updateInput(value: string) { if (!selected) return; setInputs((current) => ({ ...current, [selected.name]: value })) }
  function addText() { const nameToAdd = `custom_text_${Date.now()}`; const item = schema(nameToAdd, 'text', 30, 25, 100, 10, { fontSize: 11, alignment: 'left', readOnly: false }); setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), item]] })); setInputs((current) => ({ ...current, [nameToAdd]: 'New text' })); setSelectedName(nameToAdd) }
  function addDynamic(nameToAdd: string) { if (schemas.some((item) => item.name === nameToAdd)) { setSelectedName(nameToAdd); return } const item = schema(nameToAdd, 'text', 30, 25, 100, 8, { fontSize: 10, readOnly: false }); setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), item]] })); setInputs((current) => ({ ...current, [nameToAdd]: dynamicLabels[nameToAdd] })); setSelectedName(nameToAdd) }
  function addSignature() { const existing = schemas.filter((item) => item.name.startsWith('signature_label_')).length; if (existing >= 8) { setNotice('This one-page A4 layout has room for eight readable signature blocks. Use a separate page template for more.'); return } const x = 18 + (existing % 4) * 68; const y = 166 + Math.floor(existing / 4) * 15; const lineName = `signature_line_${Date.now()}`; const labelName = `signature_label_${Date.now()}`; const detailName = `signature_secondary_${Date.now()}`; const additions = [schema(lineName, 'line', x, y + 7, 58, 0.7, { color: '#4b5563', opacity: 1, rotate: 0 }), schema(labelName, 'text', x, y + 9, 58, 6, { fontSize: 7, alignment: 'center' }), schema(detailName, 'text', x, y + 14, 58, 5, { fontSize: 6, alignment: 'center' })]; setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), ...additions]] })); setInputs((current) => ({ ...current, [labelName]: 'Signature label', [detailName]: '' })); setSelectedName(labelName) }
  function addLine() { const nameToAdd = `divider_${Date.now()}`; setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), schema(nameToAdd, 'line', 30, 30, 100, 0.7, { color: '#4b5563', opacity: 1, rotate: 0, readOnly: false })]] })); setSelectedName(nameToAdd) }
  function removeSelected() { if (!selected || isProtected(selected)) return; setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]).filter((item) => item.name !== selected.name)]] })); setSelectedName(null) }
  function duplicateSelected() { if (!selected || isProtected(selected)) return; const nameToAdd = `${selected.name}_copy_${Date.now()}`; const copy = { ...selected, name: nameToAdd, position: { x: Math.min(PAGE_WIDTH - selected.width, selected.position.x + 5), y: Math.min(PAGE_HEIGHT - selected.height, selected.position.y + 5) } }; setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), copy]] })); setInputs((current) => ({ ...current, [nameToAdd]: inputs[selected.name] ?? '' })); setSelectedName(nameToAdd) }
  function uploadImage(file: File | undefined) { if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 1_000_000) { setNotice('Use an authorized PNG or JPEG image no larger than 1 MB.'); return } const reader = new FileReader(); reader.onload = () => { const nameToAdd = letterheadMode === 'header' ? 'letterhead' : `image_${Date.now()}`; const existing = schemas.find((item) => item.name === nameToAdd); const item = existing ?? schema(nameToAdd, 'image', 10, 6, letterheadMode === 'header' ? 277 : 277, letterheadMode === 'header' ? 24 : 194, { preserveAspectRatio: true }); setTemplate((current) => ({ ...current, schemas: [[...((current.schemas[0] as PdfmeSchema[]).filter((entry) => entry.name !== nameToAdd)), item]] })); setInputs((current) => ({ ...current, [nameToAdd]: String(reader.result) })); setSelectedName(nameToAdd); setNotice('Image added. Drag the selected image or adjust its numeric properties.'); }; reader.readAsDataURL(file) }
  async function save(useAsDefault = false) { if (templatesLoading || busy) return; setBusy(true); setNotice(null); try { const isDefault = useAsDefault || Boolean(record?.isDefault); const saved = record ? await updatePdfmeTemplate(institutionId, record.id, name, persistableTemplate(resolvedTemplate, inputs), isDefault) : await createPdfmeTemplateRecord(institutionId, name, persistableTemplate(resolvedTemplate, inputs), isDefault); setRecord(saved); setNewTemplateMode(false); setTemplates((items) => [...items.filter((item) => item.id !== saved.id).map((item) => isDefault ? { ...item, isDefault: false } : item), saved]); setNotice(isDefault ? 'Template saved and selected as the institution default.' : 'Template saved for this institution.'); onSaved?.(saved) } catch { setNotice('The template could not be saved.'); } finally { setBusy(false) } }
  async function downloadPdf() { setBusy(true); setNotice(null); try { const pdf = await generatePdfmePdf(resolvedTemplate, inputs); const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'timetable'}.pdf`; anchor.click(); URL.revokeObjectURL(url); setNotice('PDF downloaded from the current layout.') } catch { setNotice('PDF generation failed. Check the selected image or text settings.') } finally { setBusy(false) } }
  function reset() { const generated = createPdfmeTemplate(context); setRecord(null); setNewTemplateMode(true); setTemplate(generated.template); setInputs(generated.inputs); setSelectedName(null); setName('Standard academic timetable'); setNotice('Temporary changes reset.') }
  function duplicateTemplate() { if (templatesLoading || busy) return; setRecord(null); setNewTemplateMode(true); setName(`${name} copy`); setNotice('Save As New is ready. The existing template remains unchanged until you save.') }
  function saveAsNew() { duplicateTemplate() }
  const canvasStyle = (item: PdfmeSchema) => ({ left: `${(item.position.x / PAGE_WIDTH) * 100}%`, top: `${(item.position.y / PAGE_HEIGHT) * 100}%`, width: `${(item.width / PAGE_WIDTH) * 100}%`, height: `${(item.height / PAGE_HEIGHT) * 100}%`, fontSize: `${Number(item.fontSize ?? 10) * 0.8}pt`, opacity: Number(item.opacity ?? 1), transform: item.type === 'line' ? `rotate(${Number(item.rotate ?? 0)}deg)` : undefined, textAlign: item.alignment as 'left' | 'center' | 'right' })
  const lineVisualStyle = (item: PdfmeSchema) => ({ borderTop: `${Math.max(1, Number(item.height ?? 0.7) * 3)}px solid ${String(item.color ?? '#4b5563')}` })

  return <div className="pdfme-designer-backdrop" role="presentation"><div className="pdfme-designer-dialog pdfme-designer-dialog--simple" role="dialog" aria-modal="true" aria-labelledby="pdfme-designer-title"><header className="pdfme-designer-toolbar"><div><p className="section-kicker">Simple academic document designer · A4 landscape</p><h2 id="pdfme-designer-title">Design printable timetable</h2><label className="pdfme-template-name">Template name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label className="pdfme-template-name">Header spacing<select value={layoutSpacing} onChange={(event) => setHeaderSpacing(event.target.value as HeaderSpacing)}><option value="compact">Compact · 4 mm</option><option value="standard">Standard · 7 mm</option><option value="spacious">Spacious · 10 mm</option></select></label><label className="pdfme-template-name">Header ends here (mm)<input type="number" min="8" max="194" step="0.1" value={layoutConfig.headerBoundaryMm ?? ''} placeholder="Auto" onChange={(event) => setHeaderBoundary(event.target.value)} /></label>{layoutConfig.mode !== 'automatic' && <button type="button" className="button button--ghost" onClick={applyAutomaticSpacing}>Apply Automatic Header Spacing</button>}</div><div className="pdfme-designer-actions"><button type="button" className="button button--ghost" onClick={() => setPreview((value) => !value)}>{preview ? 'Edit layout' : 'Preview'}</button><button type="button" className="button button--ghost" onClick={reset}><RotateCcw size={15} />Reset</button><button type="button" className="button button--secondary" onClick={() => void save()} disabled={busy || templatesLoading}><Save size={15} />Save Changes</button><button type="button" className="button button--ghost" onClick={saveAsNew} disabled={busy || templatesLoading}>Save As New</button><button type="button" className="button button--secondary" onClick={() => void save(true)} disabled={busy || templatesLoading}>Save &amp; Use as Default</button><button type="button" className="button button--primary" onClick={() => void downloadPdf()} disabled={busy}><Download size={15} />Download PDF</button><button type="button" className="dialog-close" onClick={onClose} aria-label="Close designer"><X size={19} /></button></div></header><div className="pdfme-simple-workspace"><aside className="pdfme-simple-tools"><section><h3>Templates</h3><div className="pdfme-template-gallery"><button type="button" className={!record ? 'pdfme-template-card pdfme-template-card--active' : 'pdfme-template-card'} onClick={reset}><span className="pdfme-template-thumb">A4</span><span>Standard academic</span></button>{templates.map((item) => <button type="button" className={record?.id === item.id ? 'pdfme-template-card pdfme-template-card--active' : 'pdfme-template-card'} key={item.id} onClick={() => { const loaded = item.template as PersistedPdfmeTemplate; setRecord(item); setNewTemplateMode(false); setName(item.name); const current = materializePdfmeTemplate(loaded, context); setTemplate(current); setInputs(hydratePdfmeInputs(current, context, loaded.__schedaroAssets, loaded.__schedaroInputs)); setSelectedName(null) }}><span className="pdfme-template-thumb">{item.isDefault ? '★' : 'A4'}</span><span>{item.name}</span></button>)}</div><button type="button" className="button button--ghost pdfme-full-button" onClick={saveAsNew} disabled={!record || templatesLoading || busy}><Copy size={14} />Save As New</button></section><section><h3>Build your document</h3><button type="button" className="pdfme-tool-button" onClick={addText}><Plus size={16} />Add Text</button><label className="pdfme-tool-button"><ImagePlus size={16} />Add Letterhead / Image<input type="file" accept="image/png,image/jpeg" onChange={(event) => uploadImage(event.target.files?.[0])} /></label><select className="pdfme-tool-select" value={letterheadMode} onChange={(event) => setLetterheadMode(event.target.value as 'header' | 'full')}><option value="header">Header placement</option><option value="full">Full-page placement</option></select><div className="pdfme-academic-fields"><span>Academic fields</span>{Object.entries(dynamicLabels).map(([field, label]) => <button type="button" key={field} onClick={() => addDynamic(field)}>{label}</button>)}</div><button type="button" className="pdfme-tool-button" onClick={addSignature}><Plus size={16} />Add Signature</button><button type="button" className="pdfme-tool-button" onClick={addLine}><Plus size={16} />Add Divider</button></section><p className="pdfme-help">Select an object on the paper to edit it. The timetable itself is protected and always comes from saved academic sessions.</p></aside><main className={`pdfme-simple-canvas ${preview ? 'pdfme-simple-canvas--preview' : ''}`}><div className="pdfme-paper" ref={canvasRef} onPointerDown={() => setSelectedName(null)}><div className="pdfme-paper__protected" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}><TimetableCanvas template={resolvedTemplate} inputs={inputs} /></div>{schemas.filter((item) => !isProtected(item) && item.name !== 'time_header').map((item) => { const value = inputs[item.name] ?? String(item.content ?? ''); const selectedClass = item.name === selectedName ? 'pdfme-canvas-element--selected' : ''; return <div className={`pdfme-canvas-element pdfme-canvas-element--${item.type} ${selectedClass}`} key={item.name} style={canvasStyle(item)} tabIndex={preview ? undefined : 0} onPointerDown={(event) => !preview && startInteraction(event, item, 'move')} onClick={(event) => { event.stopPropagation(); if (!preview) setSelectedName(item.name) }} onKeyDown={(event) => { if (preview || isProtected(item)) return; if (event.key === 'Delete') removeSelected(); if (event.key === 'ArrowLeft') updateSchema(item.name, { position: { ...item.position, x: Math.max(0, item.position.x - 1) } }); if (event.key === 'ArrowRight') updateSchema(item.name, { position: { ...item.position, x: Math.min(PAGE_WIDTH - item.width, item.position.x + 1) } }) }}>{item.type === 'image' && inputs[item.name] ? <img src={inputs[item.name]} alt="Institution artwork" /> : item.type === 'line' ? <span className="pdfme-canvas-line" style={lineVisualStyle(item)} /> : value}{item.name === selectedName && !preview && !isProtected(item) && <button type="button" className="pdfme-resize-handle" aria-label="Resize selected object" onPointerDown={(event) => startInteraction(event, item, 'resize')} />}</div> })}</div><div className="pdfme-canvas-caption">Protected timetable · {context.institution.name} · {context.department.name} · {context.semester.label} · {context.group.sectionName}</div></main><aside className="pdfme-simple-properties">{selected && !preview ? <><div className="pdfme-properties-heading"><div><span className="section-kicker">Selected element</span><h3>{schemaLabel(selected)}</h3></div><button type="button" className="button button--ghost" onClick={removeSelected} disabled={isProtected(selected)} aria-label="Delete selected element"><Trash2 size={15} /></button></div>{selected.type === 'text' && <label>Content<textarea value={inputs[selected.name] ?? ''} onChange={(event) => updateInput(event.target.value)} rows={4} disabled={Boolean(dynamicLabels[selected.name])} /></label>}{selected.type === 'image' && <label>Replace image<input type="file" accept="image/png,image/jpeg" onChange={(event) => uploadImage(event.target.files?.[0])} /></label>}{selected.type === 'text' && <><label>Font size<input type="number" min="6" max="28" value={Number(selected.fontSize ?? 10)} onChange={(event) => updateSchema(selected.name, { fontSize: Number(event.target.value) })} /></label><label>Alignment<select value={String(selected.alignment ?? 'left')} onChange={(event) => updateSchema(selected.name, { alignment: event.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></>}{selected.type === 'line' && <><label>Line color<input type="color" value={String(selected.color ?? '#4b5563')} onChange={(event) => updateSchema(selected.name, { color: event.target.value })} /></label><label>Thickness (mm)<input type="number" min="0.2" max="4" step="0.1" value={Number(selected.height ?? 0.7)} onChange={(event) => updateSchema(selected.name, { height: Math.max(0.2, Number(event.target.value)) })} /></label><label>Opacity<input type="number" min="0" max="1" step="0.1" value={Number(selected.opacity ?? 1)} onChange={(event) => updateSchema(selected.name, { opacity: Math.max(0, Math.min(1, Number(event.target.value))) })} /></label></> }<div className="pdfme-property-grid"><label>X (mm)<input type="number" value={selected.position.x.toFixed(1)} onChange={(event) => updateSchema(selected.name, { position: { ...selected.position, x: Number(event.target.value) } })} /></label><label>Y (mm)<input type="number" value={selected.position.y.toFixed(1)} onChange={(event) => updateSchema(selected.name, { position: { ...selected.position, y: Number(event.target.value) } })} /></label><label>Width<input type="number" min="2" value={selected.width.toFixed(1)} onChange={(event) => updateSchema(selected.name, { width: Number(event.target.value) })} /></label><label>Height<input type="number" min="0.1" value={selected.height.toFixed(1)} onChange={(event) => updateSchema(selected.name, { height: Number(event.target.value) })} /></label></div><button type="button" className="button button--secondary pdfme-full-button" onClick={duplicateSelected} disabled={isProtected(selected)}>Duplicate</button></> : <div className="pdfme-properties-empty"><strong>{preview ? 'Preview mode' : 'Choose an element'}</strong><p>{preview ? 'This is the document view that will be sent to PDF generation.' : 'Click text, artwork, or a signature on the paper to see simple editing options here.'}</p><p><b>Protected:</b> {context.sessions.length} saved session(s) remain data-driven and cannot be moved in the designer.</p></div>}{layoutWarnings.length > 0 && <div className="pdf-editor-notice" role="alert">{layoutWarnings.join(' ')}</div>}{notice && <p className="pdf-editor-notice" role="status">{notice}</p>}</aside></div></div></div>
}
