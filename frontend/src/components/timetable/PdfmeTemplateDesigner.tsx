import { Copy, Download, ImagePlus, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Template } from '@pdfme/common'
import { generate } from '@pdfme/generator'
import { image, line, rectangle, text } from '@pdfme/schemas'
import type { AcademicTerm, ClassGroup, Department, Institution, Resource, Semester } from '../../lib/api'
import { createPdfmeTemplate as createPdfmeTemplateRecord, listPdfmeTemplates, updatePdfmeTemplate } from '../../lib/managementApi'
import type { PdfmeTemplateRecord } from '../../lib/printLayout'
import { DAY_LABELS, DAYS, type TimetableSession } from '../../lib/timetable'

const pdfmePlugins = { text, image, line, rectangle }
const PAGE_WIDTH = 297
const PAGE_HEIGHT = 210
const PROTECTED_PREFIXES = ['day_', 'time_', 'session_']
const dynamicLabels: Record<string, string> = { institution_name: 'College name', department_name: 'Department', timetable_title: 'Timetable title', semester_section: 'Semester and section', academic_term: 'Academic term' }
type PdfmeSchema = { name: string; type: string; position: { x: number; y: number }; width: number; height: number; [key: string]: unknown }
type DesignerContext = { institution: Institution; department: Department; semester: Semester; group: ClassGroup; term?: AcademicTerm; resources: { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }; sessions: TimetableSession[]; workingDays: TimetableSession['day'][] }
type Props = DesignerContext & { institutionId: string; onClose: () => void; onSaved?: (record: PdfmeTemplateRecord) => void }
type Interaction = { name: string; mode: 'move' | 'resize'; startX: number; startY: number; original: PdfmeSchema; canvas: HTMLElement }
type PersistedPdfmeTemplate = Template & { __schedaroAssets?: { letterhead?: string }; __schedaroInputs?: Record<string, string> }

function schema(name: string, type: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}): PdfmeSchema { return { name, type, position: { x, y }, width, height, ...extra } }
function resourceName(items: Resource[], id: string, fallback: string) { return items.find((item) => item.id === id)?.name ?? fallback }
function minutes(value: string) { const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins }
function isProtected(item: PdfmeSchema) { return PROTECTED_PREFIXES.some((prefix) => item.name.startsWith(prefix)) || item.name === 'time_header' }
function schemaLabel(item: PdfmeSchema) { if (dynamicLabels[item.name]) return dynamicLabels[item.name]; if (item.name === 'letterhead') return 'College letterhead'; if (item.name.startsWith('signature_label_')) return 'Signature label'; if (item.name.startsWith('signature_secondary_')) return 'Signature details'; if (item.name.startsWith('signature_line_')) return 'Signature line'; if (item.name.startsWith('custom_text_')) return 'Custom text'; if (item.type === 'image') return 'Image / logo'; if (item.type === 'line') return 'Divider line'; return 'Text' }

export function createPdfmeTemplate(context: DesignerContext, signatureCount = 0, letterheadData?: string): { template: Template; inputs: Record<string, string> } {
  const { institution, department, semester, group, term, resources, sessions, workingDays } = context
  const schemas: PdfmeSchema[] = []
  const inputs: Record<string, string> = {}
  const addText = (name: string, value: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) => { schemas.push(schema(name, 'text', x, y, width, height, { fontSize: 10, alignment: 'left', readOnly: false, ...extra })); inputs[name] = value }
  if (letterheadData) { schemas.push(schema('letterhead', 'image', 10, 6, 277, 24, { preserveAspectRatio: true, readOnly: false })); inputs.letterhead = letterheadData }
  addText('institution_name', institution.name, 15, letterheadData ? 31 : 8, 267, 11, { fontSize: 20, alignment: 'center', readOnly: false })
  addText('department_name', department.name, 15, letterheadData ? 43 : 22, 267, 7, { fontSize: 10, alignment: 'center', readOnly: false })
  addText('timetable_title', 'Weekly Academic Timetable', 15, letterheadData ? 52 : 31, 267, 7, { fontSize: 11, alignment: 'center', readOnly: false })
  addText('semester_section', `${semester.label} — ${group.sectionName}`, 15, letterheadData ? 60 : 40, 130, 6, { fontSize: 8, readOnly: false })
  addText('academic_term', term ? `${term.academicYear} · ${term.term}` : 'Academic term not configured', 152, letterheadData ? 60 : 40, 130, 6, { fontSize: 8, alignment: 'right', readOnly: false })
  const top = letterheadData ? 70 : 50
  const left = 15
  const timeWidth = 18
  const dayWidth = 249 / Math.max(workingDays.length, 1)
  addText('time_header', 'Time', left, top, timeWidth, 7, { fontSize: 7, alignment: 'center', readOnly: true })
  workingDays.forEach((day, index) => addText(`day_${day}`, DAY_LABELS[day], left + timeWidth + index * dayWidth, top, dayWidth, 7, { fontSize: 7, alignment: 'center', readOnly: true }))
  const start = 8 * 60
  const end = 17 * 60
  const gridTop = top + 8
  const gridHeight = 101
  for (let index = 0; index <= 9; index += 1) addText(`time_${index}`, `${String(8 + index).padStart(2, '0')}:00`, left, gridTop + (index / 9) * gridHeight - 2, timeWidth, 5, { fontSize: 5, alignment: 'center', readOnly: true })
  sessions.filter((session) => workingDays.includes(session.day)).forEach((session) => {
    const dayIndex = workingDays.indexOf(session.day)
    const y = gridTop + ((minutes(session.startTime) - start) / (end - start)) * gridHeight
    const h = Math.max(7, ((minutes(session.endTime) - minutes(session.startTime)) / (end - start)) * gridHeight)
    addText(`session_${session.id}`, `${resourceName(resources.subjects, session.subjectId, 'Subject unavailable')}\n${session.startTime}–${session.endTime} · ${session.type}\n${resourceName(resources.teachers, session.teacherId, 'Teacher unavailable')} · ${resourceName(resources.rooms, session.roomId, 'Room unavailable')}`, left + timeWidth + dayIndex * dayWidth + 1, y, dayWidth - 2, h, { fontSize: 5, alignment: 'center', readOnly: true, backgroundColor: '#eef2ff', borderColor: '#a5b4fc', borderWidth: 0.3 })
  })
  for (let index = 0; index < signatureCount; index += 1) {
    const columns = Math.min(signatureCount, 4)
    const width = (267 - (columns - 1) * 4) / columns
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = 15 + column * (width + 4)
    const y = top + gridHeight + 14 + row * 18
    schemas.push(schema(`signature_line_${index}`, 'line', x, y + 10, width, 0.2, { color: '#4b5563', lineWidth: 0.5, readOnly: false }))
    addText(`signature_label_${index}`, ['Prepared By', 'Class In-Charge', 'Head of Department', 'Dean', 'Director', 'Registrar', 'Principal'][index] ?? `Signature ${index + 1}`, x, y + 11, width, 5, { fontSize: 7, alignment: 'center', readOnly: false })
    addText(`signature_secondary_${index}`, '', x, y + 16, width, 5, { fontSize: 6, alignment: 'center', readOnly: false })
  }
  return { template: { basePdf: { width: PAGE_WIDTH, height: PAGE_HEIGHT, padding: [8, 8, 8, 8] }, schemas: [schemas] } as Template, inputs }
}

function isLegacyDefaultSignature(item: PdfmeSchema, persisted: PersistedPdfmeTemplate) {
  return !persisted.__schedaroInputs && /^signature_(line|label|secondary)_[0-2]$/.test(item.name)
}

export function materializePdfmeTemplate(template: Template, context: DesignerContext): Template {
  const persisted = template as PersistedPdfmeTemplate
  const generated = createPdfmeTemplate(context, 0, persisted.__schedaroAssets?.letterhead)
  const protectedSchemas = (generated.template.schemas[0] as PdfmeSchema[]).filter((item) => isProtected(item))
  const editableSchemas = (template.schemas[0] as PdfmeSchema[]).filter((item) => !isProtected(item) && !isLegacyDefaultSignature(item, persisted))
  return { ...template, schemas: [[...editableSchemas, ...protectedSchemas]] }
}

export function hydratePdfmeInputs(template: Template, context: DesignerContext, assets?: { letterhead?: string }, savedInputs?: Record<string, string>): Record<string, string> {
  const dynamic = createPdfmeTemplate(context, 0).inputs
  const persisted = savedInputs ?? (template as PersistedPdfmeTemplate).__schedaroInputs
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

function TimetableCanvas({ context }: { context: DesignerContext }) {
  const displayDays = [...context.workingDays, ...DAYS.filter((day) => !context.workingDays.includes(day) && context.sessions.some((session) => session.day === day))]
  const start = 8 * 60
  const end = 17 * 60
  return <div className="pdfme-protected-timetable" aria-label="Protected timetable preview"><div className="pdfme-protected-time">{Array.from({ length: 10 }, (_, index) => <span key={index} style={{ top: `${(index / 9) * 100}%` }}>{`${String(8 + index).padStart(2, '0')}:00`}</span>)}</div>{displayDays.map((day) => <div className="pdfme-protected-day" key={day}><strong>{DAY_LABELS[day]}{!context.workingDays.includes(day) ? ' · exception' : ''}</strong><div className="pdfme-protected-day__body">{context.sessions.filter((session) => session.day === day).map((session) => { const top = ((minutes(session.startTime) - start) / (end - start)) * 100; const height = Math.max(7, ((minutes(session.endTime) - minutes(session.startTime)) / (end - start)) * 100); return <div className="pdfme-protected-session" key={session.id} style={{ top: `${top}%`, height: `${height}%` }}><b>{resourceName(context.resources.subjects, session.subjectId, 'Subject unavailable')}</b><span>{session.startTime}–{session.endTime} · {session.type}</span><small>{resourceName(context.resources.teachers, session.teacherId, 'Teacher unavailable')} · {resourceName(context.resources.rooms, session.roomId, 'Room unavailable')}</small></div> })}</div></div>)}</div>
}

export function PdfmeTemplateDesigner({ institutionId, onClose, onSaved, ...context }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<Interaction | null>(null)
  const [record, setRecord] = useState<PdfmeTemplateRecord | null>(null)
  const [template, setTemplate] = useState<Template>(() => createPdfmeTemplate(context).template)
  const [inputs, setInputs] = useState<Record<string, string>>(() => createPdfmeTemplate(context).inputs)
  const [templates, setTemplates] = useState<PdfmeTemplateRecord[]>([])
  const [name, setName] = useState('Standard academic timetable')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [letterheadMode, setLetterheadMode] = useState<'header' | 'full'>('header')
  const schemas = (template.schemas[0] ?? []) as PdfmeSchema[]
  const selected = schemas.find((item) => item.name === selectedName) ?? null
  const contextKey = `${context.institution.id}:${context.department.id}:${context.semester.id}:${context.group.id}:${context.term?.id ?? ''}:${context.workingDays.join(',')}:${context.sessions.map((session) => `${session.id}:${session.startTime}:${session.endTime}:${session.subjectId}:${session.teacherId}:${session.roomId}`).join('|')}`

  useEffect(() => { let active = true; void listPdfmeTemplates(institutionId).then((items) => { if (!active) return; setTemplates(items); const defaultItem = items.find((item) => item.isDefault) ?? items[0]; if (defaultItem) { const loaded = defaultItem.template as PersistedPdfmeTemplate; setRecord(defaultItem); setName(defaultItem.name); const current = materializePdfmeTemplate(loaded, context); setTemplate(current); setInputs(hydratePdfmeInputs(current, context, loaded.__schedaroAssets, loaded.__schedaroInputs)) } }).catch(() => { if (active) setNotice('No saved template found. Start with the standard academic layout.') }); return () => { active = false } }, [institutionId])
  useEffect(() => { if (record) { const loaded = template as PersistedPdfmeTemplate; const current = materializePdfmeTemplate(loaded, context); setTemplate(current); setInputs(hydratePdfmeInputs(current, context, loaded.__schedaroAssets, loaded.__schedaroInputs)); return } const generated = createPdfmeTemplate(context); setInputs(generated.inputs); setTemplate((current) => current) }, [contextKey, record?.id])
  useEffect(() => {
    if (!interactionRef.current) return
    const move = (event: PointerEvent) => { const interaction = interactionRef.current; if (!interaction) return; const rect = interaction.canvas.getBoundingClientRect(); const dx = ((event.clientX - interaction.startX) / rect.width) * PAGE_WIDTH; const dy = ((event.clientY - interaction.startY) / rect.height) * PAGE_HEIGHT; const original = interaction.original; const next = interaction.mode === 'move' ? { x: original.position.x + dx, y: original.position.y + dy } : original.position; const width = interaction.mode === 'resize' ? Math.min(PAGE_WIDTH - next.x, Math.max(8, original.width + dx)) : original.width; const height = interaction.mode === 'resize' ? Math.min(PAGE_HEIGHT - next.y, Math.max(3, original.height + dy)) : original.height; updateSchema(interaction.name, { position: { x: Math.max(0, Math.min(PAGE_WIDTH - width, next.x)), y: Math.max(0, Math.min(PAGE_HEIGHT - height, next.y)) }, width, height }) }
    const stop = () => { interactionRef.current = null }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
  })

  function updateSchema(nameToUpdate: string, patch: Partial<PdfmeSchema>) { setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]).map((item) => item.name === nameToUpdate ? { ...item, ...patch } : item)]] })) }
  function startInteraction(event: ReactPointerEvent<HTMLElement>, item: PdfmeSchema, mode: Interaction['mode']) { event.preventDefault(); event.stopPropagation(); setSelectedName(item.name); if (canvasRef.current) interactionRef.current = { name: item.name, mode, startX: event.clientX, startY: event.clientY, original: item, canvas: canvasRef.current } }
  function updateInput(value: string) { if (!selected) return; setInputs((current) => ({ ...current, [selected.name]: value })) }
  function addText() { const nameToAdd = `custom_text_${Date.now()}`; const item = schema(nameToAdd, 'text', 30, 25, 100, 10, { fontSize: 11, alignment: 'left', readOnly: false }); setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), item]] })); setInputs((current) => ({ ...current, [nameToAdd]: 'New text' })); setSelectedName(nameToAdd) }
  function addDynamic(nameToAdd: string) { if (schemas.some((item) => item.name === nameToAdd)) { setSelectedName(nameToAdd); return } const item = schema(nameToAdd, 'text', 30, 25, 100, 8, { fontSize: 10, readOnly: false }); setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), item]] })); setInputs((current) => ({ ...current, [nameToAdd]: dynamicLabels[nameToAdd] })); setSelectedName(nameToAdd) }
  function addSignature() { const existing = schemas.filter((item) => item.name.startsWith('signature_label_')).length; if (existing >= 8) { setNotice('This one-page A4 layout has room for eight readable signature blocks. Use a separate page template for more.'); return } const x = 18 + (existing % 4) * 68; const y = 170 + Math.floor(existing / 4) * 18; const lineName = `signature_line_${Date.now()}`; const labelName = `signature_label_${Date.now()}`; const detailName = `signature_secondary_${Date.now()}`; const additions = [schema(lineName, 'line', x, y, 58, 0.2, { color: '#4b5563', lineWidth: 0.5 }), schema(labelName, 'text', x, y + 2, 58, 6, { fontSize: 7, alignment: 'center' }), schema(detailName, 'text', x, y + 8, 58, 5, { fontSize: 6, alignment: 'center' })]; setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), ...additions]] })); setInputs((current) => ({ ...current, [labelName]: 'Signature label', [detailName]: '' })); setSelectedName(labelName) }
  function addLine() { const nameToAdd = `divider_${Date.now()}`; setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), schema(nameToAdd, 'line', 30, 30, 100, 0.3, { color: '#4f46e5', lineWidth: 0.5 })]] })); setSelectedName(nameToAdd) }
  function removeSelected() { if (!selected || isProtected(selected)) return; setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]).filter((item) => item.name !== selected.name)]] })); setSelectedName(null) }
  function duplicateSelected() { if (!selected || isProtected(selected)) return; const nameToAdd = `${selected.name}_copy_${Date.now()}`; const copy = { ...selected, name: nameToAdd, position: { x: Math.min(PAGE_WIDTH - selected.width, selected.position.x + 5), y: Math.min(PAGE_HEIGHT - selected.height, selected.position.y + 5) } }; setTemplate((current) => ({ ...current, schemas: [[...(current.schemas[0] as PdfmeSchema[]), copy]] })); setInputs((current) => ({ ...current, [nameToAdd]: inputs[selected.name] ?? '' })); setSelectedName(nameToAdd) }
  function uploadImage(file: File | undefined) { if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 1_000_000) { setNotice('Use an authorized PNG or JPEG image no larger than 1 MB.'); return } const reader = new FileReader(); reader.onload = () => { const nameToAdd = letterheadMode === 'header' ? 'letterhead' : `image_${Date.now()}`; const existing = schemas.find((item) => item.name === nameToAdd); const item = existing ?? schema(nameToAdd, 'image', 10, 6, letterheadMode === 'header' ? 277 : 277, letterheadMode === 'header' ? 24 : 194, { preserveAspectRatio: true }); setTemplate((current) => ({ ...current, schemas: [[...((current.schemas[0] as PdfmeSchema[]).filter((entry) => entry.name !== nameToAdd)), item]] })); setInputs((current) => ({ ...current, [nameToAdd]: String(reader.result) })); setSelectedName(nameToAdd); setNotice('Image added. Drag the selected image or adjust its numeric properties.'); }; reader.readAsDataURL(file) }
  async function save(useAsDefault = false) { setBusy(true); setNotice(null); try { const isDefault = useAsDefault || Boolean(record?.isDefault); const saved = record ? await updatePdfmeTemplate(institutionId, record.id, name, persistableTemplate(template, inputs), isDefault) : await createPdfmeTemplateRecord(institutionId, name, persistableTemplate(template, inputs), isDefault); setRecord(saved); setTemplates((items) => [...items.filter((item) => item.id !== saved.id).map((item) => isDefault ? { ...item, isDefault: false } : item), saved]); setNotice(isDefault ? 'Template saved and selected as the institution default.' : 'Template saved for this institution.'); onSaved?.(saved) } catch { setNotice('The template could not be saved.'); } finally { setBusy(false) } }
  async function downloadPdf() { setBusy(true); setNotice(null); try { const pdf = await generatePdfmePdf(template, inputs); const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'timetable'}.pdf`; anchor.click(); URL.revokeObjectURL(url); setNotice('PDF downloaded from the current layout.') } catch { setNotice('PDF generation failed. Check the selected image or text settings.') } finally { setBusy(false) } }
  function reset() { const generated = createPdfmeTemplate(context); setRecord(null); setTemplate(generated.template); setInputs(generated.inputs); setSelectedName(null); setName('Standard academic timetable'); setNotice('Temporary changes reset.') }
  function duplicateTemplate() { setRecord(null); setName(`${name} copy`); setNotice('Template duplicated as a temporary copy. Save it to keep it.') }
  const canvasStyle = (item: PdfmeSchema) => ({ left: `${(item.position.x / PAGE_WIDTH) * 100}%`, top: `${(item.position.y / PAGE_HEIGHT) * 100}%`, width: `${(item.width / PAGE_WIDTH) * 100}%`, height: `${(item.height / PAGE_HEIGHT) * 100}%`, fontSize: `${Number(item.fontSize ?? 10) * 0.8}pt`, textAlign: item.alignment as 'left' | 'center' | 'right' })

  return <div className="pdfme-designer-backdrop" role="presentation"><div className="pdfme-designer-dialog pdfme-designer-dialog--simple" role="dialog" aria-modal="true" aria-labelledby="pdfme-designer-title"><header className="pdfme-designer-toolbar"><div><p className="section-kicker">Simple academic document designer · A4 landscape</p><h2 id="pdfme-designer-title">Design printable timetable</h2></div><div className="pdfme-designer-actions"><button type="button" className="button button--ghost" onClick={() => setPreview((value) => !value)}>{preview ? 'Edit layout' : 'Preview'}</button><button type="button" className="button button--ghost" onClick={reset}><RotateCcw size={15} />Reset</button><button type="button" className="button button--secondary" onClick={() => void save()} disabled={busy}><Save size={15} />Save Template</button><button type="button" className="button button--secondary" onClick={() => void save(true)} disabled={busy}>Save &amp; Use as Default</button><button type="button" className="button button--primary" onClick={() => void downloadPdf()} disabled={busy}><Download size={15} />Download PDF</button><button type="button" className="dialog-close" onClick={onClose} aria-label="Close designer"><X size={19} /></button></div></header><div className="pdfme-simple-workspace"><aside className="pdfme-simple-tools"><section><h3>Templates</h3><div className="pdfme-template-gallery"><button type="button" className={!record ? 'pdfme-template-card pdfme-template-card--active' : 'pdfme-template-card'} onClick={reset}><span className="pdfme-template-thumb">A4</span><span>Standard academic</span></button>{templates.map((item) => <button type="button" className={record?.id === item.id ? 'pdfme-template-card pdfme-template-card--active' : 'pdfme-template-card'} key={item.id} onClick={() => { const loaded = item.template as PersistedPdfmeTemplate; setRecord(item); setName(item.name); const current = materializePdfmeTemplate(loaded, context); setTemplate(current); setInputs(hydratePdfmeInputs(current, context, loaded.__schedaroAssets, loaded.__schedaroInputs)); setSelectedName(null) }}><span className="pdfme-template-thumb">{item.isDefault ? '★' : 'A4'}</span><span>{item.name}</span></button>)}</div><button type="button" className="button button--ghost pdfme-full-button" onClick={duplicateTemplate} disabled={!record}><Copy size={14} />Duplicate template</button></section><section><h3>Build your document</h3><button type="button" className="pdfme-tool-button" onClick={addText}><Plus size={16} />Add Text</button><label className="pdfme-tool-button"><ImagePlus size={16} />Add Letterhead / Image<input type="file" accept="image/png,image/jpeg" onChange={(event) => uploadImage(event.target.files?.[0])} /></label><select className="pdfme-tool-select" value={letterheadMode} onChange={(event) => setLetterheadMode(event.target.value as 'header' | 'full')}><option value="header">Header placement</option><option value="full">Full-page placement</option></select><div className="pdfme-academic-fields"><span>Academic fields</span>{Object.entries(dynamicLabels).map(([field, label]) => <button type="button" key={field} onClick={() => addDynamic(field)}>{label}</button>)}</div><button type="button" className="pdfme-tool-button" onClick={addSignature}><Plus size={16} />Add Signature</button><button type="button" className="pdfme-tool-button" onClick={addLine}><Plus size={16} />Add Divider</button></section><p className="pdfme-help">Select an object on the paper to edit it. The timetable itself is protected and always comes from saved academic sessions.</p></aside><main className={`pdfme-simple-canvas ${preview ? 'pdfme-simple-canvas--preview' : ''}`}><div className="pdfme-paper" ref={canvasRef} onPointerDown={() => setSelectedName(null)}><div className="pdfme-paper__protected"><TimetableCanvas context={context} /></div>{schemas.filter((item) => !isProtected(item) && item.name !== 'time_header').map((item) => { const value = inputs[item.name] ?? String(item.content ?? ''); const selectedClass = item.name === selectedName ? 'pdfme-canvas-element--selected' : ''; return <div className={`pdfme-canvas-element pdfme-canvas-element--${item.type} ${selectedClass}`} key={item.name} style={canvasStyle(item)} tabIndex={preview ? undefined : 0} onPointerDown={(event) => !preview && startInteraction(event, item, 'move')} onClick={(event) => { event.stopPropagation(); if (!preview) setSelectedName(item.name) }} onKeyDown={(event) => { if (preview || isProtected(item)) return; if (event.key === 'Delete') removeSelected(); if (event.key === 'ArrowLeft') updateSchema(item.name, { position: { ...item.position, x: Math.max(0, item.position.x - 1) } }); if (event.key === 'ArrowRight') updateSchema(item.name, { position: { ...item.position, x: Math.min(PAGE_WIDTH - item.width, item.position.x + 1) } }) }}>{item.type === 'image' && inputs[item.name] ? <img src={inputs[item.name]} alt="Institution artwork" /> : item.type === 'line' ? <span className="pdfme-canvas-line" /> : value}{item.name === selectedName && !preview && !isProtected(item) && <button type="button" className="pdfme-resize-handle" aria-label="Resize selected object" onPointerDown={(event) => startInteraction(event, item, 'resize')} />}</div> })}</div><div className="pdfme-canvas-caption">Protected timetable · {context.institution.name} · {context.department.name} · {context.semester.label} · {context.group.sectionName}</div></main><aside className="pdfme-simple-properties">{selected && !preview ? <><div className="pdfme-properties-heading"><div><span className="section-kicker">Selected element</span><h3>{schemaLabel(selected)}</h3></div><button type="button" className="button button--ghost" onClick={removeSelected} disabled={isProtected(selected)} aria-label="Delete selected element"><Trash2 size={15} /></button></div>{selected.type === 'text' && <label>Content<textarea value={inputs[selected.name] ?? ''} onChange={(event) => updateInput(event.target.value)} rows={4} disabled={Boolean(dynamicLabels[selected.name])} /></label>}{selected.type === 'image' && <label>Replace image<input type="file" accept="image/png,image/jpeg" onChange={(event) => uploadImage(event.target.files?.[0])} /></label>}{selected.type === 'text' && <><label>Font size<input type="number" min="6" max="28" value={Number(selected.fontSize ?? 10)} onChange={(event) => updateSchema(selected.name, { fontSize: Number(event.target.value) })} /></label><label>Alignment<select value={String(selected.alignment ?? 'left')} onChange={(event) => updateSchema(selected.name, { alignment: event.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></>}<div className="pdfme-property-grid"><label>X (mm)<input type="number" value={selected.position.x.toFixed(1)} onChange={(event) => updateSchema(selected.name, { position: { ...selected.position, x: Number(event.target.value) } })} /></label><label>Y (mm)<input type="number" value={selected.position.y.toFixed(1)} onChange={(event) => updateSchema(selected.name, { position: { ...selected.position, y: Number(event.target.value) } })} /></label><label>Width<input type="number" min="2" value={selected.width.toFixed(1)} onChange={(event) => updateSchema(selected.name, { width: Number(event.target.value) })} /></label><label>Height<input type="number" min="1" value={selected.height.toFixed(1)} onChange={(event) => updateSchema(selected.name, { height: Number(event.target.value) })} /></label></div><button type="button" className="button button--secondary pdfme-full-button" onClick={duplicateSelected} disabled={isProtected(selected)}>Duplicate</button></> : <div className="pdfme-properties-empty"><strong>{preview ? 'Preview mode' : 'Choose an element'}</strong><p>{preview ? 'This is the document view that will be sent to PDF generation.' : 'Click text, artwork, or a signature on the paper to see simple editing options here.'}</p><p><b>Protected:</b> {context.sessions.length} saved session(s) remain data-driven and cannot be moved in the designer.</p></div>}{notice && <p className="pdf-editor-notice" role="status">{notice}</p>}</aside></div></div></div>
}
