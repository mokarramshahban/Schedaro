import { Printer, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { AcademicTerm, ClassGroup, Department, Institution, Resource, Semester } from '../../lib/api'
import { getPrintLayout, savePrintLayout } from '../../lib/managementApi'
const PdfmeTemplateDesigner = lazy(() => import('./PdfmeTemplateDesigner').then((module) => ({ default: module.PdfmeTemplateDesigner })))
import { DAY_LABELS, DAYS, SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, timeLabelPosition, timeToMinutes, type TimetableSession } from '../../lib/timetable'
import { clampElement, clampSignature, defaultPrintLayout, resolveField, type LayoutField, type PrintElement, type PrintLayout, type SignatureElement, type TextAlign } from '../../lib/printLayout'

 type Props = {
  institution: Institution
  department: Department
  semester: Semester
  group: ClassGroup
  term?: AcademicTerm
  resources: { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }
  sessions: TimetableSession[]
  workingDays: Array<TimetableSession['day']>
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

function resourceName(resources: Resource[], id: string, missingLabel: string) {
  return resources.find((item) => item.id === id)?.name ?? missingLabel
}

type LayoutContext = { institution: Institution; department: Department; semester: Semester; group: ClassGroup; term?: AcademicTerm }
type DragState = { type: 'header' | 'footer'; id: string; startX: number; startY: number; originalX: number; originalY: number; width: number; height: number; region: HTMLElement }

export function TimetablePrintView({ institution, department, semester, group, term, resources, sessions, workingDays, onClose }: Props) {
  const context = { institution, department, semester, group, term }
  const [layout, setLayout] = useState<PrintLayout>(defaultPrintLayout)
  const [savedLayout, setSavedLayout] = useState<PrintLayout>(defaultPrintLayout)
  const [editing, setEditing] = useState(false)
  const [pdfmeOpen, setPdfmeOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customText, setCustomText] = useState('')
  const [dynamicField, setDynamicField] = useState<LayoutField>('institution_type')
  const [signatureLabel, setSignatureLabel] = useState('Prepared By')
  const [loadingTemplate, setLoadingTemplate] = useState(true)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  useEffect(() => {
    let mounted = true
    void getPrintLayout(institution.id).then((stored) => { if (!mounted) return; const next = stored ?? defaultPrintLayout(); setLayout(next); setSavedLayout(next) }).catch(() => { if (mounted) setNotice('No saved template was available; using the standard layout.') }).finally(() => { if (mounted) setLoadingTemplate(false) })
    return () => { mounted = false }
  }, [institution.id])

  useEffect(() => {
    if (!drag) return
    const move = (event: PointerEvent) => {
      const dx = ((event.clientX - drag.startX) / drag.region.getBoundingClientRect().width) * 100
      const dy = ((event.clientY - drag.startY) / drag.region.getBoundingClientRect().height) * 100
      setLayout((current) => drag.type === 'header' ? { ...current, headerElements: current.headerElements.map((item) => item.id === drag.id ? clampElement({ ...item, x: drag.originalX + dx, y: drag.originalY + dy }) : item) } : { ...current, footerElements: current.footerElements.map((item) => item.id === drag.id ? clampSignature({ ...item, x: drag.originalX + dx, y: drag.originalY + dy }) : item) })
    }
    const stop = () => setDrag(null)
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
  }, [drag])

  const displayDays = [...workingDays, ...DAYS.filter((day) => !workingDays.includes(day) && sessions.some((session) => session.day === day))]
  const exceptionDays = DAYS.filter((day) => !workingDays.includes(day) && sessions.some((session) => session.day === day))
  const subjectName = (id: string) => resourceName(resources.subjects, id, 'Subject unavailable')
  const teacherName = (id: string) => resourceName(resources.teachers, id, 'Teacher unavailable')
  const roomName = (id: string) => resourceName(resources.rooms, id, 'Room unavailable')

  function startDrag(event: ReactPointerEvent<HTMLElement>, type: DragState['type'], element: PrintElement | SignatureElement) {
    if (!editing) return
    event.preventDefault(); event.stopPropagation(); setSelectedId(element.id)
    const region = event.currentTarget.parentElement
    if (!region) return
    setDrag({ type, id: element.id, startX: event.clientX, startY: event.clientY, originalX: element.x, originalY: element.y, width: element.width, height: element.height, region })
  }

  function updateSelected(update: Partial<PrintElement>) {
    if (!selectedId) return
    setLayout((current) => ({ ...current, headerElements: current.headerElements.map((item) => item.id === selectedId ? clampElement({ ...item, ...update }) : item) }))
  }

  function removeSelected() {
    if (!selectedId) return
    setLayout((current) => ({ ...current, headerElements: current.headerElements.filter((item) => item.id !== selectedId), footerElements: current.footerElements.filter((item) => item.id !== selectedId) })); setSelectedId(null)
  }

  function moveSelected(dx: number, dy: number) {
    if (!selectedId) return
    setLayout((current) => ({ ...current, headerElements: current.headerElements.map((item) => item.id === selectedId ? clampElement({ ...item, x: item.x + dx, y: item.y + dy }) : item), footerElements: current.footerElements.map((item) => item.id === selectedId ? clampSignature({ ...item, x: item.x + dx, y: item.y + dy }) : item) }))
  }

  function addDynamicElement(field: LayoutField) {
    const item: PrintElement = { id: `dynamic-${field}-${Date.now()}`, kind: 'dynamic', field, x: 8, y: 70, width: 84, height: 8, align: 'center', fontSize: 8, bold: false, visible: true }
    setLayout((current) => ({ ...current, headerElements: [...current.headerElements, item] })); setSelectedId(item.id)
  }

  function addCustomElement() {
    const text = customText.trim()
    if (!text) return
    const item: PrintElement = { id: `custom-${Date.now()}`, kind: 'custom', text, x: 8, y: 84, width: 84, height: 10, align: 'center', fontSize: 9, bold: false, visible: true }
    setLayout((current) => ({ ...current, headerElements: [...current.headerElements, item] })); setSelectedId(item.id); setCustomText('')
  }

  function addSignature() {
    if (layout.footerElements.length >= 5) return
    const count = layout.footerElements.length + 1
    const columns = Math.min(count, 3)
    const rows = Math.ceil(count / columns)
    const index = layout.footerElements.length
    const width = 86 / columns
    const row = Math.floor(index / columns)
    const column = index % columns
    const item: SignatureElement = { id: `signature-${Date.now()}`, label: signatureLabel.trim() || 'Signature', x: 7 + column * (width + 3), y: 12 + row * 46, width, height: rows === 1 ? 70 : 38, align: 'center', showLine: true }
    setLayout((current) => ({ ...current, footerElements: [...current.footerElements, item] })); setSelectedId(item.id)
  }

  function applySignaturePreset(count: number) {
    if (count === 0) { setLayout((current) => ({ ...current, footerElements: [] })); setSelectedId(null); return }
    const gap = count <= 3 ? 4.5 : 2.5
    const width = (90 - (count - 1) * gap) / count
    const elements = Array.from({ length: count }, (_, index): SignatureElement => ({ id: `signature-${index + 1}`, label: ['Prepared By', 'Class In-Charge', 'Head of Department', 'Dean', 'Director'][index], x: 5 + index * (width + gap), y: 20, width, height: 65, align: 'center', showLine: true }))
    setLayout((current) => ({ ...current, footerElements: elements })); setSelectedId(elements[0]?.id ?? null)
  }

  async function saveTemplate() {
    setSavingTemplate(true); setNotice(null)
    try { const stored = await savePrintLayout(institution.id, layout); setLayout(stored); setSavedLayout(stored); setNotice('Layout saved as this institution’s default template.') } catch { setNotice('The layout could not be saved.') } finally { setSavingTemplate(false) }
  }

  function resetSaved() { setLayout(savedLayout); setSelectedId(null); setNotice('Unsaved changes were reset.') }
  function resetDefault() { const next = defaultPrintLayout(); setLayout(next); setSelectedId(null); setNotice('Standard layout restored for this print preview. Save it to make it the institution default.') }
  function selectLogo(file: File | undefined) {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1_000_000) { setNotice('Logo must be a PNG or JPEG no larger than 1 MB.'); return }
    const reader = new FileReader(); reader.onload = () => setLayout((current) => { const hasLogo = current.headerElements.some((item) => item.kind === 'logo'); const headerElements = hasLogo ? current.headerElements : [...current.headerElements.map((item) => item.id === 'institution' && item.x === 5 && item.width === 90 ? { ...item, x: 22, width: 73, align: 'left' as const } : item), { id: `logo-${Date.now()}`, kind: 'logo', x: 4, y: 4, width: 14, height: 18, align: 'center', fontSize: 8, bold: false, visible: true } as PrintElement]; return { ...current, logoDataUrl: String(reader.result), headerElements } }); reader.readAsDataURL(file)
  }

  return <>
  <div className="print-preview-backdrop" role="presentation">
    <div className="print-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="print-preview-title">
      <div className="print-preview-toolbar"><div><p className="section-kicker">A4 landscape preview</p><h2 id="print-preview-title">Print / Save PDF</h2></div><div className="print-preview-actions"><button type="button" className="button button--secondary" onClick={() => setEditing((value) => !value)}>{editing ? 'Preview document' : 'Customize Layout'}</button><button type="button" className="button button--secondary" onClick={() => setPdfmeOpen(true)}>Visual Designer (pdfme)</button><button type="button" className="button button--primary" onClick={() => window.print()}><Printer size={16} />Print / Save as PDF</button><button type="button" className="dialog-close" onClick={onClose} aria-label="Close print preview"><X size={19} /></button></div></div>
      {editing && <EditorToolbar layout={layout} selectedId={selectedId} customText={customText} dynamicField={dynamicField} signatureLabel={signatureLabel} saving={savingTemplate} onCustomTextChange={setCustomText} onDynamicFieldChange={setDynamicField} onAddDynamic={() => addDynamicElement(dynamicField)} onSignatureLabelChange={setSignatureLabel} onAddCustom={addCustomElement} onAddSignature={addSignature} onPreset={applySignaturePreset} onAlign={(align) => updateSelected({ align })} onRemove={removeSelected} onMove={moveSelected} onBold={() => { const selected = layout.headerElements.find((item) => item.id === selectedId); if (selected) updateSelected({ bold: !selected.bold }) }} onFontSize={(fontSize) => updateSelected({ fontSize })} onResetSaved={resetSaved} onResetDefault={resetDefault} onSave={() => void saveTemplate()} onLogo={selectLogo} notice={notice} />}
      <div className="print-preview-scroll">{loadingTemplate ? <div className="print-editor-loading">Loading institution print template…</div> : <PrintableDocument context={context} layout={layout} sessions={sessions} resources={resources} displayDays={displayDays} exceptionDays={exceptionDays} editing={editing} selectedId={selectedId} onSelect={setSelectedId} onDrag={startDrag} subjectName={subjectName} teacherName={teacherName} roomName={roomName} />}</div>
    </div>
  </div>
  {pdfmeOpen && <Suspense fallback={<div className="pdfme-designer-backdrop"><div className="pdfme-designer-loading">Loading visual designer…</div></div>}><PdfmeTemplateDesigner institutionId={institution.id} institution={institution} department={department} semester={semester} group={group} term={term} resources={resources} sessions={sessions} workingDays={workingDays} onClose={() => setPdfmeOpen(false)} /></Suspense>}
  </>
}

type EditorToolbarProps = { layout: PrintLayout; selectedId: string | null; customText: string; dynamicField: LayoutField; signatureLabel: string; saving: boolean; notice: string | null; onCustomTextChange: (value: string) => void; onDynamicFieldChange: (value: LayoutField) => void; onAddDynamic: () => void; onSignatureLabelChange: (value: string) => void; onAddCustom: () => void; onAddSignature: () => void; onPreset: (count: number) => void; onAlign: (align: TextAlign) => void; onRemove: () => void; onMove: (dx: number, dy: number) => void; onBold: () => void; onFontSize: (size: number) => void; onResetSaved: () => void; onResetDefault: () => void; onSave: () => void; onLogo: (file: File | undefined) => void }
function EditorToolbar({ layout, selectedId, customText, dynamicField, signatureLabel, saving, notice, onCustomTextChange, onDynamicFieldChange, onAddDynamic, onSignatureLabelChange, onAddCustom, onAddSignature, onPreset, onAlign, onRemove, onMove, onBold, onFontSize, onResetSaved, onResetDefault, onSave, onLogo }: EditorToolbarProps) {
  const selected = layout.headerElements.find((item) => item.id === selectedId)
  return <div className="print-editor-toolbar" aria-label="Print layout editor controls"><div className="print-editor-toolbar__group"><strong>Layout editor</strong><span>Drag header and signature elements inside their regions.</span></div><div className="print-editor-toolbar__group"><label className="print-editor-input">Custom text<input value={customText} onChange={(event) => onCustomTextChange(event.target.value)} maxLength={240} placeholder="Add a label" /></label><button type="button" className="button button--secondary" onClick={onAddCustom}>Add</button><label className="print-editor-input">Dynamic field<select value={dynamicField} onChange={(event) => onDynamicFieldChange(event.target.value as LayoutField)}><option value="institution_type">Institution type</option><option value="address">Address</option><option value="department_name">Department</option><option value="semester_section">Semester / section</option><option value="academic_term">Academic term</option><option value="timetable_title">Timetable title</option></select></label><button type="button" className="button button--secondary" onClick={onAddDynamic}>Add field</button><label className="print-editor-input">Signature label<input value={signatureLabel} onChange={(event) => onSignatureLabelChange(event.target.value)} maxLength={80} /></label><button type="button" className="button button--secondary" onClick={onAddSignature} disabled={layout.footerElements.length >= 5}>Add signature</button><label className="print-editor-input">Logo<input type="file" accept="image/png,image/jpeg" onChange={(event) => onLogo(event.target.files?.[0])} /></label></div><div className="print-editor-toolbar__group"><span>Signatures:</span>{[0, 3, 4, 5].map((count) => <button key={count} type="button" className="button button--ghost" onClick={() => onPreset(count)}>{count}</button>)}<span>Move:</span><button type="button" className="button button--ghost" onClick={() => onMove(-1, 0)}>←</button><button type="button" className="button button--ghost" onClick={() => onMove(1, 0)}>→</button><button type="button" className="button button--ghost" onClick={() => onMove(0, -1)}>↑</button><button type="button" className="button button--ghost" onClick={() => onMove(0, 1)}>↓</button><span>Selected:</span>{selected ? <><button type="button" className="button button--ghost" onClick={() => onAlign('left')}>Left</button><button type="button" className="button button--ghost" onClick={() => onAlign('center')}>Center</button><button type="button" className="button button--ghost" onClick={() => onAlign('right')}>Right</button><button type="button" className="button button--ghost" onClick={onBold}>Bold</button><button type="button" className="button button--ghost" onClick={onRemove}>Remove optional</button><select aria-label="Selected font size" value={selected.fontSize} onChange={(event) => onFontSize(Number(event.target.value))}><option value={8}>8pt</option><option value={10}>10pt</option><option value={12}>12pt</option><option value={16}>16pt</option><option value={20}>20pt</option></select></> : <span>Choose a header item</span>}<button type="button" className="button button--ghost" onClick={onResetSaved}>Reset saved</button><button type="button" className="button button--ghost" onClick={onResetDefault}>Reset standard</button><button type="button" className="button button--primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save template'}</button></div>{notice && <p className="print-editor-notice" role="status">{notice}</p>}</div>
}

type PrintableProps = { context: LayoutContext; layout: PrintLayout; sessions: TimetableSession[]; resources: { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }; displayDays: TimetableSession['day'][]; exceptionDays: TimetableSession['day'][]; editing: boolean; selectedId: string | null; onSelect: (id: string | null) => void; onDrag: (event: ReactPointerEvent<HTMLElement>, type: 'header' | 'footer', element: PrintElement | SignatureElement) => void; subjectName: (id: string) => string; teacherName: (id: string) => string; roomName: (id: string) => string }
function PrintableDocument({ context, layout, sessions, resources, displayDays, exceptionDays, editing, selectedId, onSelect, onDrag, subjectName, teacherName, roomName }: PrintableProps) {
  const renderElement = (element: PrintElement) => { if (!element.visible) return null; const style = { left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`, textAlign: element.align, fontSize: `${element.fontSize}pt`, fontWeight: element.bold ? 700 : 400 } as const; const content = element.kind === 'dynamic' && element.field ? resolveField(element.field, context) : element.kind === 'custom' ? element.text : element.kind === 'logo' && layout.logoDataUrl ? <img src={layout.logoDataUrl} alt="Authorized institution logo" /> : element.kind === 'divider' ? null : ''; return <div key={element.id} className={`print-layout-element print-layout-element--${element.kind} ${selectedId === element.id ? 'print-layout-element--selected' : ''}`} style={style} tabIndex={editing ? 0 : undefined} onPointerDown={(event) => onDrag(event, 'header', element)} onClick={() => editing && onSelect(element.id)} onKeyDown={(event) => { if (!editing) return; if (event.key === 'ArrowLeft') onSelect(element.id); if (event.key === 'ArrowRight') onSelect(element.id) }}>{content}</div> }
  return <article className={`print-document ${editing ? 'print-document--editor' : ''}`} aria-label={`${context.institution.name} timetable`} onClick={() => editing && onSelect(null)}>
    <header className={`print-document__header print-layout-region ${editing ? 'print-layout-region--editable' : ''}`} onClick={(event) => event.stopPropagation()}>{layout.headerElements.map(renderElement)}</header>
    <div className="print-document__rule" />
    <section className="print-grid" aria-label={`${displayDays.map((day) => DAY_LABELS[day]).join(', ')} timetable`} style={{ gridTemplateColumns: `18mm repeat(${displayDays.length}, minmax(0, 1fr))` }}>
      <div className="print-grid__time-header">Time</div>{displayDays.map((day) => <div className={`print-grid__day-header ${exceptionDays.includes(day) ? 'print-grid__day-header--exception' : ''}`} key={day}>{DAY_LABELS[day]}{exceptionDays.includes(day) ? ' · exception' : ''}</div>)}
      <div className="print-grid__body" style={{ gridTemplateColumns: `18mm repeat(${displayDays.length}, minmax(0, 1fr))` }}><div className="print-grid__time-axis">{Array.from({ length: 9 }, (_, index) => { const minutes = SCHEDULE_START_MINUTES + index * 60; const labelPosition = printTimeLabelPosition(minutes); return <span key={minutes} style={{ top: `${labelPosition.topPercent}%`, transform: labelPosition.transform }}>{`${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`}</span> })}</div>{displayDays.map((day) => <div className="print-grid__day" key={day}>{sessions.filter((session) => session.day === day).map((session) => { const position = printSessionPosition(session); return <div className={`print-session print-session--${session.type.toLowerCase()}`} key={session.id} style={{ top: `${position.topPercent}%`, height: `${position.heightPercent}%` }}><strong>{subjectName(session.subjectId)}</strong><span>{session.startTime}–{session.endTime} · {session.type}</span><small>{teacherName(session.teacherId)} · {roomName(session.roomId)}</small></div> })}</div>)}</div>
    </section>
    {sessions.length === 0 && <p className="print-document__empty">No saved sessions are currently assigned to this section.</p>}
    <footer className={`print-document__signature-region print-layout-region ${editing ? 'print-layout-region--editable' : ''}`} onClick={(event) => event.stopPropagation()}>{layout.footerElements.map((element) => { const style = { left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%`, textAlign: element.align } as const; return <div key={element.id} className={`print-signature-element ${selectedId === element.id ? 'print-layout-element--selected' : ''}`} style={style} tabIndex={editing ? 0 : undefined} onPointerDown={(event) => onDrag(event, 'footer', element)} onClick={() => editing && onSelect(element.id)}><div className="print-signature-element__space" />{element.showLine && <div className="print-signature-element__line" />}<strong>{element.label}</strong>{element.secondaryText && <small>{element.secondaryText}</small>}</div>})}</footer>
  </article>
}
