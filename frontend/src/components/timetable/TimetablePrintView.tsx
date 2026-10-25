import { Download, Printer, X } from 'lucide-react'
import type { Template } from '@pdfme/common'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { AcademicTerm, ClassGroup, Department, Institution, Resource, Semester } from '../../lib/api'
import { listPdfmeTemplates, updatePdfmeTemplate } from '../../lib/managementApi'
import type { PdfmeTemplateRecord } from '../../lib/printLayout'
import { SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, timeLabelPosition, timeToMinutes, type TimetableSession } from '../../lib/timetable'

const PdfmeTemplateDesigner = lazy(() => import('./PdfmeTemplateDesigner').then((module) => ({ default: module.PdfmeTemplateDesigner })))

type PersistedPdfmeTemplate = Template & { __schedaroAssets?: { letterhead?: string }; __schedaroInputs?: Record<string, string> }
type Props = {
  institution: Institution
  department: Department
  semester: Semester
  group: ClassGroup
  term?: AcademicTerm
  resources: { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }
  sessions: TimetableSession[]
  workingDays: TimetableSession['day'][]
  onClose: () => void
}

export type PrintSessionPosition = { topPercent: number; heightPercent: number }
export type PrintTimeLabelPosition = { topPercent: number; transform: string }

export function printSessionPosition(session: Pick<TimetableSession, 'startTime' | 'endTime'>): PrintSessionPosition {
  const start = timeToMinutes(session.startTime) ?? SCHEDULE_START_MINUTES
  const end = timeToMinutes(session.endTime) ?? start + 60
  const range = SCHEDULE_END_MINUTES - SCHEDULE_START_MINUTES
  return { topPercent: ((start - SCHEDULE_START_MINUTES) / range) * 100, heightPercent: ((end - start) / range) * 100 }
}

export function printTimeLabelPosition(minutes: number): PrintTimeLabelPosition {
  return timeLabelPosition(minutes, SCHEDULE_START_MINUTES, SCHEDULE_END_MINUTES, '0.8mm')
}

function contextKey(props: Props) {
  const sessionKey = props.sessions.map((session) => `${session.id}:${session.startTime}:${session.endTime}:${session.subjectId}:${session.teacherId}:${session.roomId}`).join('|')
  return [props.institution.id, props.department.id, props.semester.id, props.group.id, props.term?.id ?? '', props.workingDays.join(','), sessionKey].join('::')
}

function templateContext(props: Props) {
  return { institution: props.institution, department: props.department, semester: props.semester, group: props.group, term: props.term, resources: props.resources, sessions: props.sessions, workingDays: props.workingDays }
}

export function TimetablePrintView(props: Props) {
  const { institution, onClose } = props
  const [templates, setTemplates] = useState<PdfmeTemplateRecord[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [renderingPdf, setRenderingPdf] = useState(true)
  const [designerOpen, setDesignerOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const renderVersion = useRef(0)
  const key = contextKey(props)
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? null

  useEffect(() => {
    let active = true
    setLoadingTemplates(true)
    void listPdfmeTemplates(institution.id).then((items) => {
      if (!active) return
      setTemplates(items)
      setSelectedTemplateId((current) => current && items.some((item) => item.id === current) ? current : (items.find((item) => item.isDefault)?.id ?? items[0]?.id ?? null))
      setNotice(items.length ? null : 'No saved template exists yet. The standard academic layout is being previewed temporarily.')
    }).catch(() => { if (active) setNotice('Saved templates could not be loaded. The standard academic layout is being previewed temporarily.') }).finally(() => { if (active) setLoadingTemplates(false) })
    return () => { active = false }
  }, [institution.id])

  useEffect(() => {
    let active = true
    const version = ++renderVersion.current
    setRenderingPdf(true)
    void (async () => {
      try {
        const designer = await import('./PdfmeTemplateDesigner')
        const raw = selectedTemplate?.template as PersistedPdfmeTemplate | undefined
        const base = selectedTemplate ? designer.materializePdfmeTemplate(selectedTemplate.template as Template, templateContext(props)) : designer.createPdfmeTemplate(templateContext(props)).template
        const inputs = designer.hydratePdfmeInputs(base, templateContext(props), raw?.__schedaroAssets, raw?.__schedaroInputs)
        const bytes = await designer.generatePdfmePdf(base, inputs)
        if (!active || version !== renderVersion.current) return
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const nextUrl = URL.createObjectURL(blob)
        setPdfUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl })
        setPdfBlob(blob)
        setNotice(null)
      } catch {
        if (active && version === renderVersion.current) setNotice('The selected template could not be rendered as a PDF.')
      } finally {
        if (active && version === renderVersion.current) setRenderingPdf(false)
      }
    })()
    return () => { active = false }
  }, [key, selectedTemplateId, templates])

  function handleSaved(saved: PdfmeTemplateRecord) {
    setTemplates((current) => [...current.filter((item) => item.id !== saved.id).map((item) => saved.isDefault ? { ...item, isDefault: false } : item), saved])
    setSelectedTemplateId(saved.id)
    setNotice(saved.isDefault ? 'Saved template is now the institution default and is shown in this preview.' : 'Saved template selected for this print.')
  }

  async function setDefault() {
    if (!selectedTemplate) return
    try {
      const saved = await updatePdfmeTemplate(institution.id, selectedTemplate.id, selectedTemplate.name, selectedTemplate.template, true, selectedTemplate.active)
      handleSaved(saved)
    } catch { setNotice('The template could not be set as the institution default.') }
  }

  function downloadPdf() {
    if (!pdfBlob) return
    const url = URL.createObjectURL(pdfBlob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${(selectedTemplate?.name ?? 'standard-academic-timetable').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div className="print-preview-backdrop" role="presentation"><div className="print-preview-dialog print-preview-dialog--pdfme" role="dialog" aria-modal="true" aria-labelledby="print-preview-title"><header className="print-preview-toolbar"><div><p className="section-kicker">A4 landscape · institution template</p><h2 id="print-preview-title">Print / Save as PDF</h2><p className="print-preview-context">{institution.name} · {props.department.name} · {props.semester.label} · {props.group.sectionName}</p></div><div className="print-preview-actions"><button type="button" className="button button--secondary" onClick={() => setDesignerOpen(true)}>Edit Template</button><button type="button" className="button button--primary" onClick={downloadPdf} disabled={!pdfBlob || renderingPdf}><Download size={16} />Download PDF</button><button type="button" className="dialog-close" onClick={onClose} aria-label="Close print preview"><X size={19} /></button></div></header><section className="print-template-picker" aria-label="Print template selection"><label><strong>Print Template</strong><select value={selectedTemplateId ?? ''} onChange={(event) => setSelectedTemplateId(event.target.value || null)} disabled={loadingTemplates}><option value="">Standard Academic (temporary)</option>{templates.map((item) => <option value={item.id} key={item.id}>{item.name}{item.isDefault ? ' · default' : ''}</option>)}</select></label><div className="print-template-picker__actions">{selectedTemplate && <><span className="print-template-owner">Owned by {institution.name}</span><button type="button" className="button button--ghost" onClick={setDefault} disabled={selectedTemplate.isDefault}>Set as Default</button><button type="button" className="button button--ghost" onClick={() => setDesignerOpen(true)}>Use for This Print</button></>}{!selectedTemplate && <span className="print-template-owner">Temporary standard layout</span>}</div></section>{(notice || loadingTemplates) && <p className="print-editor-notice" role="status">{loadingTemplates ? 'Loading institution templates…' : notice}</p>}<main className="pdfme-main-preview">{renderingPdf || !pdfUrl ? <div className="pdfme-main-preview__loading"><Printer size={22} /><span>Rendering the selected template and current academic sessions…</span></div> : <iframe className="pdfme-main-preview__frame" title="Selected timetable PDF preview" src={pdfUrl} />}</main></div>{designerOpen && <Suspense fallback={<div className="pdfme-designer-backdrop"><div className="pdfme-designer-loading">Loading visual designer…</div></div>}><PdfmeTemplateDesigner institutionId={institution.id} institution={institution} department={props.department} semester={props.semester} group={props.group} term={props.term} resources={props.resources} sessions={props.sessions} workingDays={props.workingDays} onSaved={handleSaved} onClose={() => setDesignerOpen(false)} /></Suspense>}</div>
}
