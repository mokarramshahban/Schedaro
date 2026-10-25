import { Download, ImagePlus, RotateCcw, Save, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Template } from '@pdfme/common'
import { Designer } from '@pdfme/ui'
import { generate } from '@pdfme/generator'
import { image, line, rectangle, text } from '@pdfme/schemas'
import type { AcademicTerm, ClassGroup, Department, Institution, Resource, Semester } from '../../lib/api'
import { createPdfmeTemplate as createPdfmeTemplateRecord, listPdfmeTemplates, updatePdfmeTemplate } from '../../lib/managementApi'
import type { PdfmeTemplateRecord } from '../../lib/printLayout'
import type { TimetableSession } from '../../lib/timetable'

const pdfmePlugins = { text, image, line, rectangle }
type PdfmeSchema = { name: string; type: string; position: { x: number; y: number }; width: number; height: number; [key: string]: unknown }
type DesignerContext = { institution: Institution; department: Department; semester: Semester; group: ClassGroup; term?: AcademicTerm; resources: { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }; sessions: TimetableSession[]; workingDays: TimetableSession['day'][] }
type Props = DesignerContext & { institutionId: string; onClose: () => void }

function schema(name: string, type: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}): PdfmeSchema { return { name, type, position: { x, y }, width, height, ...extra } }
function resourceName(items: Resource[], id: string, fallback: string) { return items.find((item) => item.id === id)?.name ?? fallback }
function minutes(value: string) { const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins }

export function createPdfmeTemplate(context: DesignerContext, signatureCount = 3, letterheadData?: string): { template: Template; inputs: Record<string, string> } {
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
  workingDays.forEach((day, index) => addText(`day_${day}`, day[0].toUpperCase() + day.slice(1), left + timeWidth + index * dayWidth, top, dayWidth, 7, { fontSize: 7, alignment: 'center', readOnly: true }))
  const start = 8 * 60
  const end = 17 * 60
  const gridTop = top + 8
  const gridHeight = 101
  for (let index = 0; index <= 9; index += 1) addText(`time_${index}`, `${String(8 + index).padStart(2, '0')}:00`, left, gridTop + (index / 9) * gridHeight - 2, timeWidth, 5, { fontSize: 5, alignment: 'center', readOnly: true })
  sessions.filter((session) => workingDays.includes(session.day)).forEach((session) => {
    const dayIndex = workingDays.indexOf(session.day)
    const y = gridTop + ((minutes(session.startTime) - start) / (end - start)) * gridHeight
    const h = Math.max(7, ((minutes(session.endTime) - minutes(session.startTime)) / (end - start)) * gridHeight)
    const name = `session_${session.id}`
    addText(name, `${resourceName(resources.subjects, session.subjectId, 'Subject unavailable')}\n${session.startTime}–${session.endTime} · ${session.type}\n${resourceName(resources.teachers, session.teacherId, 'Teacher unavailable')} · ${resourceName(resources.rooms, session.roomId, 'Room unavailable')}`, left + timeWidth + dayIndex * dayWidth + 1, y, dayWidth - 2, h, { fontSize: 5, alignment: 'center', readOnly: true, backgroundColor: '#eef2ff', borderColor: '#a5b4fc', borderWidth: 0.3 })
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
  return { template: { basePdf: { width: 297, height: 210, padding: [8, 8, 8, 8] }, schemas: [schemas] } as Template, inputs }
}

type PersistedPdfmeTemplate = Template & { __schedaroAssets?: { letterhead?: string } }
function hydratePdfmeInputs(template: Template, context: DesignerContext, assets?: { letterhead?: string }): Record<string, string> {
  const dynamic = createPdfmeTemplate(context, 0).inputs
  const values: Record<string, string> = {}
  for (const page of template.schemas) for (const item of page) values[item.name] = dynamic[item.name] ?? String(item.content ?? '')
  if (assets?.letterhead) values.letterhead = assets.letterhead
  return values
}
function persistableTemplate(template: Template, inputs: Record<string, string>): Record<string, unknown> {
  return { ...(template as Record<string, unknown>), __schedaroAssets: inputs.letterhead ? { letterhead: inputs.letterhead } : undefined }
}

export function PdfmeTemplateDesigner({ institutionId, onClose, ...context }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const designerRef = useRef<Designer | null>(null)
  const [record, setRecord] = useState<PdfmeTemplateRecord | null>(null)
  const [template, setTemplate] = useState<Template>(() => createPdfmeTemplate(context).template)
  const [inputs, setInputs] = useState<Record<string, string>>(() => createPdfmeTemplate(context).inputs)
  const [templates, setTemplates] = useState<PdfmeTemplateRecord[]>([])
  const [name, setName] = useState('Standard academic timetable')
  const [signatureCount, setSignatureCount] = useState(3)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const contextKey = `${context.institution.id}:${context.department.id}:${context.semester.id}:${context.group.id}:${context.term?.id ?? ''}:${context.sessions.length}`
  useEffect(() => { let active = true; void listPdfmeTemplates(institutionId).then((items) => { if (!active) return; setTemplates(items); const defaultItem = items.find((item) => item.isDefault) ?? items[0]; if (defaultItem) { const loaded = defaultItem.template as PersistedPdfmeTemplate; setRecord(defaultItem); setName(defaultItem.name); setTemplate(loaded); setInputs(hydratePdfmeInputs(loaded, context, loaded.__schedaroAssets)); } }).catch(() => { if (active) setNotice('No saved pdfme templates found; using the standard template.') }); return () => { active = false } }, [institutionId])
  useEffect(() => { if (record) { const loaded = template as PersistedPdfmeTemplate; setInputs(hydratePdfmeInputs(loaded, context, loaded.__schedaroAssets)); return } const generated = createPdfmeTemplate(context, signatureCount); setInputs(generated.inputs); setTemplate(generated.template) }, [contextKey, signatureCount, record?.id])
  useEffect(() => {
    if (!containerRef.current) return
    designerRef.current?.destroy()
    const designer = new Designer({ domContainer: containerRef.current, template, plugins: pdfmePlugins, options: { zoomLevel: 0.8, sidebarOpen: true } })
    designer.onChangeTemplate((nextTemplate) => setTemplate(nextTemplate as Template))
    designerRef.current = designer
    return () => { designer.destroy(); designerRef.current = null }
  }, [record?.id])
  useEffect(() => { if (designerRef.current) designerRef.current.updateTemplate(template) }, [template])

  const downloadPdf = async () => { setBusy(true); setNotice(null); try { const pdf = await generate({ template, inputs: [inputs], plugins: pdfmePlugins }); const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'timetable'}.pdf`; anchor.click(); URL.revokeObjectURL(url); setNotice('PDF generated from the current pdfme template.') } catch { setNotice('pdfme could not generate this template. Check the selected schema properties.') } finally { setBusy(false) } }
  const save = async () => { setBusy(true); setNotice(null); try { const saved = record ? await updatePdfmeTemplate(institutionId, record.id, name, persistableTemplate(template, inputs), record.isDefault) : await createPdfmeTemplateRecord(institutionId, name, persistableTemplate(template, inputs), templates.length === 0); setRecord(saved); setTemplates((items) => [...items.filter((item) => item.id !== saved.id), saved]); setNotice('pdfme template saved for this institution.') } catch { setNotice('The pdfme template could not be saved.'); } finally { setBusy(false) } }
  const reset = () => { const generated = createPdfmeTemplate(context, signatureCount); setRecord(null); setTemplate(generated.template); setInputs(generated.inputs); setName('Standard academic timetable'); setNotice('Temporary pdfme changes reset.') }
  const uploadLetterhead = (file: File | undefined) => { if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 2_000_000) { setNotice('Letterhead must be PNG or JPEG and no larger than 2 MB.'); return } const reader = new FileReader(); reader.onload = () => { const generated = createPdfmeTemplate(context, signatureCount, String(reader.result)); setTemplate(generated.template); setInputs(generated.inputs); setRecord(null); setNotice('Letterhead added as a movable image layer.'); }; reader.readAsDataURL(file) }
  const addSignatures = (count: number) => { setSignatureCount(count); setRecord(null); const generated = createPdfmeTemplate(context, count); setTemplate(generated.template); setInputs(generated.inputs) }

  return <div className="pdfme-designer-backdrop" role="presentation"><div className="pdfme-designer-dialog" role="dialog" aria-modal="true" aria-labelledby="pdfme-designer-title"><header className="pdfme-designer-toolbar"><div><p className="section-kicker">pdfme visual designer · A4 landscape</p><h2 id="pdfme-designer-title">Design timetable template</h2></div><div className="pdfme-designer-actions"><button type="button" className="button button--ghost" onClick={reset}><RotateCcw size={15} />Reset</button><button type="button" className="button button--secondary" onClick={() => void save()} disabled={busy}><Save size={15} />Save</button><button type="button" className="button button--primary" onClick={() => void downloadPdf()} disabled={busy}><Download size={15} />Download PDF</button><button type="button" className="dialog-close" onClick={onClose} aria-label="Close pdfme designer"><X size={19} /></button></div></header><div className="pdfme-designer-workspace"><aside className="pdfme-designer-panel pdfme-designer-panel--left"><strong>Templates</strong><select value={record?.id ?? ''} onChange={(event) => { const selected = templates.find((item) => item.id === event.target.value); if (selected) { const loaded = selected.template as PersistedPdfmeTemplate; setRecord(selected); setName(selected.name); setTemplate(loaded); setInputs(hydratePdfmeInputs(loaded, context, loaded.__schedaroAssets)) } }}><option value="">Temporary standard</option>{templates.map((item) => <option value={item.id} key={item.id}>{item.name}{item.isDefault ? ' · default' : ''}</option>)}</select><label>Template name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label><label className="pdfme-upload"><ImagePlus size={15} />Upload letterhead<input type="file" accept="image/png,image/jpeg" onChange={(event) => uploadLetterhead(event.target.files?.[0])} /></label><strong>Signature blocks</strong><div className="pdfme-signature-buttons">{[0, 1, 3, 5, 7, 10].map((count) => <button type="button" key={count} className="button button--ghost" onClick={() => addSignatures(count)}>{count}</button>)}</div><p className="pdfme-help">The center timetable is generated from saved sessions and protected in the template. Header, images, lines, and signature labels remain editable in pdfme.</p></aside><main className="pdfme-designer-canvas" ref={containerRef} /><aside className="pdfme-designer-panel pdfme-designer-panel--right"><strong>Academic context</strong><dl><dt>Institution</dt><dd>{context.institution.name}</dd><dt>Department</dt><dd>{context.department.name}</dd><dt>Group</dt><dd>{context.semester.label} · {context.group.sectionName}</dd><dt>Term</dt><dd>{context.term ? `${context.term.academicYear} · ${context.term.term}` : 'Not configured'}</dd></dl><p className="pdfme-help">Dynamic fields resolve when this class group changes. Use pdfme's selection panel to adjust position, size, typography, and alignment.</p>{notice && <p className="pdf-editor-notice" role="status">{notice}</p>}</aside></div></div></div>
}
