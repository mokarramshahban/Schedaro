import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import { Check, Info, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card'
import { StatusDot } from '../components/ui/StatusDot'
import { ApiError, createSession, deleteSession, getClassGroups, getDepartments, getInstitutions, getResources, getSemesters, getSessions, provisionDevelopmentSetup, updateSession, type AcademicResources, type ClassGroup, type Department, type Institution, type Resource, type Semester, type SessionPayload } from '../lib/api'
import { DAY_LABELS, DAYS, PIXELS_PER_HOUR, SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, SESSION_TYPES, durationToHeight, layoutDaySessions, minutesToPosition, minutesToTime, removeSession, timeToMinutes, upsertSession, validateSession, type DayOfWeek, type SessionType, type TimetableSession } from '../lib/timetable'

type TimetablePageProps = { connected: boolean; environment?: string; error?: string | null }
type SessionDraft = Omit<TimetableSession, 'id' | 'classGroupId'>
type DialogState = { mode: 'add' | 'edit'; sessionId?: string }

const emptyResources: AcademicResources = { subjects: [], teachers: [], rooms: [] }
const emptyDraft = (day: DayOfWeek = 'monday'): SessionDraft => ({ day, startTime: '09:00', endTime: '10:00', subjectId: '', teacherId: '', roomId: '', type: 'Lecture', notes: '' })

function apiErrorMessages(error: unknown): string[] {
  if (!(error instanceof ApiError)) return [error instanceof Error ? error.message : 'The request could not be completed.']
  const detail = error.detail as { conflicts?: Array<{ message?: string }>; message?: string } | null
  const conflictMessages = detail?.conflicts?.map((conflict) => conflict.message).filter((message): message is string => Boolean(message)) ?? []
  return [...new Set([...conflictMessages, detail?.message ?? error.message])]
}

export function TimetablePage({ connected, environment = 'development', error }: TimetablePageProps) {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [resources, setResources] = useState<AcademicResources>(emptyResources)
  const [sessions, setSessions] = useState<TimetableSession[]>([])
  const [selectedInstitution, setSelectedInstitution] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedClassGroup, setSelectedClassGroup] = useState('')
  const [scopeLoading, setScopeLoading] = useState(false)
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [draft, setDraft] = useState<SessionDraft>(emptyDraft())
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TimetableSession | null>(null)
  const [focusedDay, setFocusedDay] = useState<DayOfWeek>('monday')
  const [sessionReload, setSessionReload] = useState(0)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const selectedDepartmentRecord = departments.find((item) => item.id === selectedDepartment)
  const selectedSemesterRecord = semesters.find((item) => item.id === selectedSemester)
  const selectedGroupRecord = classGroups.find((item) => item.id === selectedClassGroup)
  const timelineHeight = minutesToPosition(SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, PIXELS_PER_HOUR)
  const timeLabels = Array.from({ length: 9 }, (_, index) => SCHEDULE_START_MINUTES + index * 60)
  const selectedInstitutionRecord = institutions.find((item) => item.id === selectedInstitution)

  const loadInstitutions = useCallback(async (signal?: AbortSignal) => {
    setScopeLoading(true)
    setScopeError(null)
    try {
      const values = await getInstitutions(signal)
      setInstitutions(values)
      setSelectedInstitution((current) => current && values.some((item) => item.id === current) ? current : values[0]?.id ?? '')
    } catch (reason) {
      if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0])
    } finally {
      if (!signal?.aborted) setScopeLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadInstitutions(controller.signal)
    return () => controller.abort()
  }, [loadInstitutions])

  useEffect(() => {
    setDepartments([]); setSemesters([]); setClassGroups([]); setResources(emptyResources); setSessions([]); setSelectedDepartment(''); setSelectedSemester(''); setSelectedClassGroup('')
    if (!selectedInstitution) return
    const controller = new AbortController()
    setScopeLoading(true); setScopeError(null)
    void getDepartments(selectedInstitution, controller.signal).then((values) => {
      setDepartments(values); setSelectedDepartment(values[0]?.id ?? '')
    }).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setScopeLoading(false) })
    return () => controller.abort()
  }, [selectedInstitution])

  useEffect(() => {
    setSemesters([]); setClassGroups([]); setResources(emptyResources); setSessions([]); setSelectedSemester(''); setSelectedClassGroup('')
    if (!selectedDepartment) return
    const controller = new AbortController()
    setScopeLoading(true); setScopeError(null)
    void getSemesters(selectedDepartment, controller.signal).then((values) => {
      setSemesters(values); setSelectedSemester(values[0]?.id ?? '')
    }).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setScopeLoading(false) })
    return () => controller.abort()
  }, [selectedDepartment])

  useEffect(() => {
    setClassGroups([]); setSessions([]); setSelectedClassGroup('')
    if (!selectedSemester) return
    const controller = new AbortController()
    setScopeLoading(true); setScopeError(null)
    void getClassGroups(selectedSemester, controller.signal).then((values) => {
      setClassGroups(values); setSelectedClassGroup(values[0]?.id ?? '')
    }).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setScopeLoading(false) })
    return () => controller.abort()
  }, [selectedSemester])

  useEffect(() => {
    setResources(emptyResources)
    if (!selectedInstitution || !selectedDepartment) return
    const controller = new AbortController()
    setResourcesLoading(true)
    void getResources(selectedInstitution, selectedDepartment, controller.signal, selectedSemester).then(setResources).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setResourcesLoading(false) })
    return () => controller.abort()
  }, [selectedInstitution, selectedDepartment])

  useEffect(() => {
    setSessions([]); setSessionError(null); setNotice(null)
    if (!selectedClassGroup) return
    const controller = new AbortController()
    setSessionsLoading(true)
    void getSessions(selectedClassGroup, controller.signal).then(setSessions).catch((reason) => { if ((reason as Error).name !== 'AbortError') setSessionError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setSessionsLoading(false) })
    return () => controller.abort()
  }, [selectedClassGroup, sessionReload])

  useEffect(() => {
    if (dialog) window.setTimeout(() => firstFieldRef.current?.focus(), 0)
  }, [dialog])

  const subjectName = (id: string) => { const option = resources.subjects.find((item) => item.id === id); return option ? `${option.name}${option.active ? '' : ' · inactive'}` : 'Unknown subject' }
  const teacherName = (id: string) => { const option = resources.teachers.find((item) => item.id === id); return option ? `${option.name}${option.active ? '' : ' · inactive'}` : 'Unknown teacher' }
  const roomName = (id: string) => { const option = resources.rooms.find((item) => item.id === id); return option ? `${option.name}${option.active ? '' : ' · inactive'}` : 'Unknown room' }

  function openAdd(day: DayOfWeek = focusedDay) {
    setDraft({ ...emptyDraft(day), subjectId: resources.subjects.find((item) => item.active)?.id ?? '', teacherId: resources.teachers.find((item) => item.active)?.id ?? '', roomId: resources.rooms.find((item) => item.active)?.id ?? '' })
    setFormErrors([]); setNotice(null); setDialog({ mode: 'add' })
  }

  function openEdit(session: TimetableSession) {
    const { id: _id, classGroupId: _classGroupId, ...sessionDraft } = session
    setDraft(sessionDraft); setFormErrors([]); setNotice(null); setDialog({ mode: 'edit', sessionId: session.id })
  }

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog || !selectedClassGroup) return
    const candidate: TimetableSession = { ...draft, id: dialog.sessionId ?? 'pending', classGroupId: selectedClassGroup }
    const validation = validateSession(candidate, sessions)
    if (validation.length > 0) { setFormErrors(validation); return }
    const payload: SessionPayload = { day: draft.day, startTime: draft.startTime, endTime: draft.endTime, subjectId: draft.subjectId, teacherId: draft.teacherId, roomId: draft.roomId, sessionType: draft.type, notes: draft.notes }
    setSaving(true); setFormErrors([])
    try {
      const saved = dialog.mode === 'edit' && dialog.sessionId ? await updateSession(dialog.sessionId, payload) : await createSession(selectedClassGroup, payload)
      setSessions((current) => upsertSession(current, saved)); setFocusedDay(saved.day); setDialog(null); setNotice('Session saved to PostgreSQL.')
    } catch (reason) {
      setFormErrors(apiErrorMessages(reason))
    } finally { setSaving(false) }
  }

  function updateDraft<K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); setFormErrors([]) }

  async function confirmDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try { await deleteSession(deleteTarget.id); setSessions((current) => removeSession(current, deleteTarget.id)); setDeleteTarget(null); setNotice('Session removed from PostgreSQL.') } catch (reason) { setSessionError(apiErrorMessages(reason)[0]) } finally { setSaving(false) }
  }

  async function setupWorkspace() {
    setSetupLoading(true); setScopeError(null)
    try { await provisionDevelopmentSetup(); await loadInstitutions(); setNotice('Development academic records are ready in PostgreSQL.') } catch (reason) { setScopeError(apiErrorMessages(reason)[0]) } finally { setSetupLoading(false) }
  }

  const canAdd = Boolean(selectedClassGroup && resources.subjects.some((item) => item.active) && resources.teachers.some((item) => item.active) && resources.rooms.some((item) => item.active) && !resourcesLoading)
  const noInstitutions = !scopeLoading && institutions.length === 0 && !scopeError

  return <div className="page-content timetable-page">
    <div className="page-heading">
      <div><p className="eyebrow">Workspace / Timetable</p><h1>Build your academic week.</h1><p className="page-description">Arrange persisted sessions on one shared timeline across Monday through Saturday.</p></div>
      <Button disabled={!canAdd} onClick={() => openAdd()} title={!canAdd ? 'Select a class group with scheduling resources first' : undefined}><Plus size={17} />Add session</Button>
    </div>

    <div className="status-banner timetable-status" role="status">
      <div className="status-banner__icon"><Info size={18} /></div>
      <div><strong>{connected ? 'PostgreSQL-backed timetable' : 'API connection unavailable'}</strong><p>{notice ?? (connected ? 'Academic scope and timetable changes are saved through the Schedaro API.' : 'Reconnect to the API to load academic data.')}</p></div>
      <StatusDot label={connected ? 'API connected' : 'API unavailable'} state={connected ? 'success' : 'error'} />
    </div>

    <Card className="scope-card">
      <CardHeader><div><p className="section-kicker">Academic scope</p><CardTitle>Choose the persisted class group to display</CardTitle></div><span className="demo-badge"><span />Database records</span></CardHeader>
      <CardBody>
        {scopeError && <div className="form-errors" role="alert"><strong>Academic data could not be loaded</strong><p>{scopeError}</p><Button type="button" variant="secondary" size="sm" onClick={() => void loadInstitutions()}><RefreshCw size={14} />Retry</Button></div>}
        {noInstitutions && <div className="scope-empty"><h3>No institution is configured yet.</h3><p>Provision deterministic local development records to create a usable academic hierarchy.</p><Button type="button" onClick={() => void setupWorkspace()} disabled={setupLoading}>{setupLoading ? 'Provisioning…' : 'Set up development workspace'}</Button></div>}
        <div className="selector-grid">
          <SelectField label="Institution" value={selectedInstitution} options={institutions.map((item) => ({ id: item.id, label: item.name }))} onChange={setSelectedInstitution} loading={scopeLoading && institutions.length === 0} emptyLabel="No institutions" />
          <SelectField label="Department" value={selectedDepartment} options={departments.map((item) => ({ id: item.id, label: item.name }))} onChange={setSelectedDepartment} disabled={!selectedInstitution || scopeLoading} emptyLabel="No departments configured" />
          <SelectField label="Semester" value={selectedSemester} options={semesters.map((item) => ({ id: item.id, label: item.label }))} onChange={setSelectedSemester} disabled={!selectedDepartment || scopeLoading} emptyLabel="No semesters configured" />
          <SelectField label="Section" value={selectedClassGroup} options={classGroups.map((item) => ({ id: item.id, label: item.label }))} onChange={setSelectedClassGroup} disabled={!selectedSemester || scopeLoading} emptyLabel="No sections configured" />
        </div>
      </CardBody>
    </Card>

    <div className="timetable-toolbar">
      <div><p className="section-kicker">Weekly calendar</p><h2>{selectedInstitutionRecord?.name ?? 'Select an institution'}{selectedDepartmentRecord ? ` · ${selectedDepartmentRecord.name}` : ''}{selectedSemesterRecord ? ` · ${selectedSemesterRecord.label}` : ''}{selectedGroupRecord ? ` · ${selectedGroupRecord.sectionName}` : ''}</h2></div>
      <div className="timetable-toolbar__meta"><span className="legend-dot legend-dot--lecture" /> Lecture <span className="legend-dot legend-dot--lab" /> Lab <span className="legend-dot legend-dot--tutorial" /> Tutorial</div>
    </div>

    <Card className="timetable-card">
      <div className="mobile-day-picker" aria-label="Focused day preview">{DAYS.map((day) => <button key={day} type="button" className={focusedDay === day ? 'mobile-day-picker__item mobile-day-picker__item--active' : 'mobile-day-picker__item'} onClick={() => setFocusedDay(day)}>{DAY_LABELS[day].slice(0, 3)}</button>)}</div>
      {!selectedClassGroup && <div className="calendar-empty"><h3>Select a section to load its timetable.</h3><p>Choose an institution, department, semester and section above.</p></div>}
      {selectedClassGroup && sessionError && <div className="calendar-empty calendar-empty--error" role="alert"><h3>Timetable could not be loaded.</h3><p>{sessionError}</p><Button type="button" variant="secondary" onClick={() => setSessionReload((current) => current + 1)}><RefreshCw size={14} />Retry</Button></div>}
      {selectedClassGroup && !sessionError && <div className="timetable-scroll">
        {sessionsLoading ? <div className="calendar-empty"><p>Loading saved sessions…</p></div> : <div className="timetable-calendar" style={{ '--timeline-height': `${timelineHeight}px` } as CSSProperties}>
          <div className="timetable-day-header timetable-day-header--time">Time</div>
          {DAYS.map((day) => <div key={day} className={`timetable-day-header ${focusedDay === day ? 'timetable-day-header--focused' : ''}`}><strong>{DAY_LABELS[day]}</strong><span>{sessions.filter((session) => session.day === day).length} sessions</span></div>)}
          <div className="timetable-body"><div className="time-axis" aria-hidden="true">{timeLabels.map((minutes) => <span key={minutes} className="time-axis__label" style={{ top: minutesToPosition(minutes) }}>{minutesToTime(minutes)}</span>)}</div>{DAYS.map((day) => <DayColumn key={day} day={day} sessions={sessions.filter((session) => session.day === day)} timelineHeight={timelineHeight} subjectName={subjectName} teacherName={teacherName} roomName={roomName} onEdit={openEdit} onAdd={() => openAdd(day)} focused={focusedDay === day} />)}</div>
        </div>}
      </div>}
    </Card>

    <div className="timetable-footer"><span><Check size={15} /> {sessions.length} saved sessions loaded</span><span>API: {environment}{error ? ` · ${error}` : ''}</span></div>

    {dialog && <SessionDialog mode={dialog.mode} draft={draft} resources={resources} errors={formErrors} firstFieldRef={firstFieldRef} saving={saving} onChange={updateDraft} onSubmit={submitSession} onCancel={() => setDialog(null)} onRequestDelete={dialog.sessionId ? () => { const target = sessions.find((session) => session.id === dialog.sessionId); setDialog(null); if (target) setDeleteTarget(target) } : undefined} />}
    {deleteTarget && <ConfirmDialog session={deleteTarget} subjectName={subjectName} saving={saving} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}
  </div>
}

type DayColumnProps = { day: DayOfWeek; sessions: TimetableSession[]; timelineHeight: number; subjectName: (id: string) => string; teacherName: (id: string) => string; roomName: (id: string) => string; onEdit: (session: TimetableSession) => void; onAdd: () => void; focused: boolean }
function DayColumn({ day, sessions, timelineHeight, subjectName, teacherName, roomName, onEdit, onAdd, focused }: DayColumnProps) {
  const layouts = layoutDaySessions(sessions, day)
  return <div className={`timetable-day ${focused ? 'timetable-day--focused' : ''}`} style={{ height: timelineHeight }}><div className="timetable-day__grid" />{sessions.map((session) => { const start = timeToMinutes(session.startTime) ?? SCHEDULE_START_MINUTES; const end = timeToMinutes(session.endTime) ?? start + 60; const layout = layouts.get(session.id) ?? { lane: 0, laneCount: 1 }; const gap = 8; const width = `calc(${100 / layout.laneCount}% - ${gap}px)`; const left = `calc(${layout.lane * (100 / layout.laneCount)}% + ${gap / 2}px)`; return <button key={session.id} type="button" className={`timetable-session timetable-session--${session.type.toLowerCase()}`} style={{ top: minutesToPosition(start), height: Math.max(durationToHeight(start, end), 38), width, left }} onClick={() => onEdit(session)} aria-label={`Edit ${subjectName(session.subjectId)} ${session.startTime} to ${session.endTime}`}><span className="timetable-session__type">{session.type}</span><strong>{subjectName(session.subjectId)}</strong><span>{session.startTime}–{session.endTime}</span><small>{teacherName(session.teacherId)} · {roomName(session.roomId)}</small></button> })}<button type="button" className="day-add-button" onClick={onAdd}><Plus size={14} /> Add</button></div>
}


type SelectFieldProps = { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean; loading?: boolean; emptyLabel?: string; inputRef?: RefObject<HTMLSelectElement | null> }
function SelectField({ label, value, options, onChange, disabled, loading, emptyLabel = 'No options', inputRef }: SelectFieldProps) {
  return <label className="field"><span>{label}{loading && <em>Loading…</em>}</span><select ref={inputRef} value={value} disabled={disabled || loading} onChange={(event) => onChange(event.target.value)}><option value="">{loading ? 'Loading…' : options.length ? 'Select…' : emptyLabel}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
}

type SessionDialogProps = { mode: 'add' | 'edit'; draft: SessionDraft; resources: AcademicResources; errors: string[]; firstFieldRef: RefObject<HTMLSelectElement | null>; saving: boolean; onChange: <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; onRequestDelete?: () => void }
function SessionDialog({ mode, draft, resources, errors, firstFieldRef, saving, onChange, onSubmit, onCancel, onRequestDelete }: SessionDialogProps) {
  const toOptions = (values: Resource[], selectedId: string) => values.filter((value) => value.active || value.id === selectedId).map((value) => ({ id: value.id, label: `${value.name}${value.active ? '' : ' · inactive'}` }))
  return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="session-dialog-title"><div className="dialog__header"><div><p className="section-kicker">Persisted session</p><h2 id="session-dialog-title">{mode === 'add' ? 'Add session' : 'Edit session'}</h2></div><button type="button" className="dialog-close" onClick={onCancel} aria-label="Close dialog"><X size={19} /></button></div><form onSubmit={onSubmit}>{errors.length > 0 && <div className="form-errors" role="alert"><strong>Session could not be saved</strong><ul>{errors.map((item) => <li key={item}>{item}</li>)}</ul></div>}<div className="dialog-grid"><SelectField label="Day" value={draft.day} options={DAYS.map((day) => ({ id: day, label: DAY_LABELS[day] }))} onChange={(value) => onChange('day', value as DayOfWeek)} inputRef={firstFieldRef} /><SelectField label="Subject" value={draft.subjectId} options={toOptions(resources.subjects, draft.subjectId)} onChange={(value) => onChange('subjectId', value)} /><SelectField label="Teacher" value={draft.teacherId} options={toOptions(resources.teachers, draft.teacherId)} onChange={(value) => onChange('teacherId', value)} /><SelectField label="Room / lab" value={draft.roomId} options={toOptions(resources.rooms, draft.roomId)} onChange={(value) => onChange('roomId', value)} /><SelectField label="Session type" value={draft.type} options={SESSION_TYPES.map((type) => ({ id: type, label: type }))} onChange={(value) => onChange('type', value as SessionType)} /><label className="field"><span>Start time</span><input type="time" value={draft.startTime} onChange={(event) => onChange('startTime', event.target.value)} /></label><label className="field"><span>End time</span><input type="time" value={draft.endTime} onChange={(event) => onChange('endTime', event.target.value)} /></label><label className="field field--full"><span>Notes <em>Optional</em></span><textarea rows={3} value={draft.notes ?? ''} onChange={(event) => onChange('notes', event.target.value)} placeholder="Add a planning note" /></label></div><div className="dialog__actions">{mode === 'edit' && onRequestDelete && <Button type="button" variant="ghost" className="button--danger-ghost" onClick={onRequestDelete} disabled={saving}><Trash2 size={15} />Remove</Button>}<span className="dialog__actions-spacer" /><Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : mode === 'add' ? 'Save session' : 'Apply changes'}</Button></div></form></div></div>
}

type ConfirmDialogProps = { session: TimetableSession; subjectName: (id: string) => string; saving: boolean; onCancel: () => void; onConfirm: () => void }
function ConfirmDialog({ session, subjectName, saving, onCancel, onConfirm }: ConfirmDialogProps) {
  return <div className="dialog-backdrop" role="presentation"><div className="dialog dialog--compact" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title"><div className="dialog__header"><div><p className="section-kicker">Delete persisted session</p><h2 id="delete-dialog-title">Remove this session?</h2></div><button type="button" className="dialog-close" onClick={onCancel} aria-label="Close confirmation"><X size={19} /></button></div><p className="confirm-copy"><strong>{subjectName(session.subjectId)}</strong> on {DAY_LABELS[session.day]} from {session.startTime} to {session.endTime} will be removed from PostgreSQL.</p><div className="dialog__actions"><Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Keep session</Button><Button type="button" className="button--danger" onClick={onConfirm} disabled={saving}><Trash2 size={15} />{saving ? 'Removing…' : 'Remove session'}</Button></div></div></div>
}
