import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import { Check, Info, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card'
import { StatusDot } from '../components/ui/StatusDot'
import { ApiError, createSession, deleteSession, getClassGroups, getDepartments, getResources, getSemesters, getSessions, getTerms, provisionDevelopmentSetup, updateSession, type AcademicResources, type AcademicTerm, type ClassGroup, type Department, type Institution, type Resource, type Semester, type SessionPayload } from '../lib/api'
import { useInstitution } from '../lib/InstitutionContext'
import { TimetablePrintView } from '../components/timetable/TimetablePrintView'
import { approveProposal, createRequirement, discardProposal, generateTimetable, getRequirements, updateRequirement } from '../lib/generationApi'
import type { GenerateResponse, SchedulingRequirement } from '../lib/api'
import { DAY_LABELS, DAYS, PIXELS_PER_HOUR, SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, SESSION_TYPES, durationToHeight, layoutDaySessions, minutesToPosition, minutesToTime, removeSession, timeLabelPosition, timeToMinutes, upsertSession, validateSession, type DayOfWeek, type SessionType, type TimetableSession } from '../lib/timetable'

type TimetablePageProps = { connected: boolean; environment?: string; error?: string | null }
type SessionDraft = Omit<TimetableSession, 'id' | 'classGroupId'>
type DialogState = { mode: 'add' | 'edit'; sessionId?: string }

const emptyResources: AcademicResources = { subjects: [], teachers: [], rooms: [] }
const emptyDraft = (day: DayOfWeek = 'monday'): SessionDraft => ({ day, startTime: '09:00', endTime: '10:00', subjectId: '', teacherId: '', roomId: '', type: 'Lecture', notes: '', locked: false })

function apiErrorMessages(error: unknown): string[] {
  if (!(error instanceof ApiError)) return [error instanceof Error ? error.message : 'The request could not be completed.']
  const detail = error.detail as { conflicts?: Array<{ message?: string }>; message?: string } | null
  const conflictMessages = detail?.conflicts?.map((conflict) => conflict.message).filter((message): message is string => Boolean(message)) ?? []
  return [...new Set([...conflictMessages, detail?.message ?? error.message])]
}

export function TimetablePage({ connected, environment = 'development', error }: TimetablePageProps) {
  const { activeInstitutionId, activeInstitution, activeInstitutions, loading: institutionLoading, error: institutionError, refreshInstitutions } = useInstitution()
  const [departments, setDepartments] = useState<Department[]>([])
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([])
  const [resources, setResources] = useState<AcademicResources>(emptyResources)
  const [sessions, setSessions] = useState<TimetableSession[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [selectedClassGroup, setSelectedClassGroup] = useState('')
  const [scopeLoading, setScopeLoading] = useState(false)
  const [termsLoading, setTermsLoading] = useState(false)
  const [scopeInstitutionId, setScopeInstitutionId] = useState('')
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
  const [printOpen, setPrintOpen] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [manageRequirementsOpen, setManageRequirementsOpen] = useState(false)
  const [requirements, setRequirements] = useState<SchedulingRequirement[]>([])
  const [generatorLoading, setGeneratorLoading] = useState(false)
  const [generatorError, setGeneratorError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<GenerateResponse | null>(null)
  const [focusedDay, setFocusedDay] = useState<DayOfWeek>('monday')
  const [sessionReload, setSessionReload] = useState(0)
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const selectedDepartmentRecord = departments.find((item) => item.id === selectedDepartment)
  const selectedSemesterRecord = semesters.find((item) => item.id === selectedSemester)
  const selectedGroupRecord = classGroups.find((item) => item.id === selectedClassGroup)
  const selectedTermRecord = terms.find((item) => item.id === selectedGroupRecord?.academicTermId)
  const timelineHeight = minutesToPosition(SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, PIXELS_PER_HOUR)
  const timeLabels = Array.from({ length: 9 }, (_, index) => SCHEDULE_START_MINUTES + index * 60)
  const selectedInstitutionRecord = activeInstitution
  const scopeReady = Boolean(activeInstitutionId && scopeInstitutionId === activeInstitutionId)

  const loadInstitutions = useCallback(async () => {
    await refreshInstitutions()
  }, [refreshInstitutions])

  useEffect(() => {
    if (institutionError) setScopeError(institutionError)
  }, [institutionError])

  useEffect(() => {
    setTerms([])
    if (!activeInstitutionId) { setTermsLoading(false); return }
    const controller = new AbortController()
    setTermsLoading(true)
    void getTerms(activeInstitutionId, controller.signal).then(setTerms).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setTermsLoading(false) })
    return () => controller.abort()
  }, [activeInstitutionId])

  useEffect(() => {
    setDepartments([]); setSemesters([]); setClassGroups([]); setResources(emptyResources); setSessions([]); setSelectedDepartment(''); setSelectedSemester(''); setSelectedClassGroup(''); setScopeInstitutionId('')
    if (!activeInstitutionId) return
    const controller = new AbortController()
    setScopeLoading(true); setScopeError(null)
    void getDepartments(activeInstitutionId, controller.signal).then((values) => {
      setDepartments(values); setSelectedDepartment(values[0]?.id ?? ''); setScopeInstitutionId(activeInstitutionId)
    }).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setScopeLoading(false) })
    return () => controller.abort()
  }, [activeInstitutionId])

  useEffect(() => {
    setSemesters([]); setClassGroups([]); setResources(emptyResources); setSessions([]); setSelectedSemester(''); setSelectedClassGroup('')
    if (!selectedDepartment || !departments.some((department) => department.id === selectedDepartment && department.institutionId === activeInstitutionId)) return
    const controller = new AbortController()
    setScopeLoading(true); setScopeError(null)
    void getSemesters(selectedDepartment, controller.signal).then((values) => {
      setSemesters(values); setSelectedSemester(values[0]?.id ?? '')
    }).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setScopeLoading(false) })
    return () => controller.abort()
  }, [activeInstitutionId, departments, selectedDepartment])

  useEffect(() => {
    setClassGroups([]); setSessions([]); setSelectedClassGroup('')
    if (!selectedSemester || !semesters.some((semester) => semester.id === selectedSemester && semester.departmentId === selectedDepartment)) return
    const controller = new AbortController()
    setScopeLoading(true); setScopeError(null)
    void getClassGroups(selectedSemester, controller.signal).then((values) => {
      setClassGroups(values); setSelectedClassGroup(values[0]?.id ?? '')
    }).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setScopeLoading(false) })
    return () => controller.abort()
  }, [selectedDepartment, selectedSemester])

  useEffect(() => {
    setResources(emptyResources)
    if (!scopeReady || !selectedDepartment || !departments.some((department) => department.id === selectedDepartment && department.institutionId === activeInstitutionId)) return
    const controller = new AbortController()
    setResourcesLoading(true)
    void getResources(activeInstitutionId, selectedDepartment, controller.signal, selectedSemester).then(setResources).catch((reason) => { if ((reason as Error).name !== 'AbortError') setScopeError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setResourcesLoading(false) })
    return () => controller.abort()
  }, [activeInstitutionId, departments, scopeReady, selectedDepartment, selectedSemester])

  useEffect(() => {
    setSessions([]); setSessionError(null); setNotice(null)
    if (!selectedClassGroup || !classGroups.some((group) => group.id === selectedClassGroup)) return
    const controller = new AbortController()
    setSessionsLoading(true)
    void getSessions(selectedClassGroup, controller.signal).then(setSessions).catch((reason) => { if ((reason as Error).name !== 'AbortError') setSessionError(apiErrorMessages(reason)[0]) }).finally(() => { if (!controller.signal.aborted) setSessionsLoading(false) })
    return () => controller.abort()
  }, [classGroups, selectedClassGroup, sessionReload])

  useEffect(() => {
    if (dialog) window.setTimeout(() => firstFieldRef.current?.focus(), 0)
  }, [dialog])

  useEffect(() => {
    setProposal(null); setGeneratorError(null); setRequirements([])
    if (!selectedClassGroup) return
    void getRequirements(selectedClassGroup).then(setRequirements).catch((reason) => setGeneratorError(reason instanceof Error ? reason.message : 'Scheduling requirements could not be loaded.'))
  }, [selectedClassGroup])

  useEffect(() => { setPrintOpen(false); setGeneratorOpen(false); setProposal(null) }, [activeInstitutionId, selectedClassGroup])

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
    const payload: SessionPayload = { day: draft.day, startTime: draft.startTime, endTime: draft.endTime, subjectId: draft.subjectId, teacherId: draft.teacherId, roomId: draft.roomId, sessionType: draft.type, notes: draft.notes, locked: draft.locked }
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
  const noInstitutions = !institutionLoading && activeInstitutions.length === 0 && !scopeError
  const proposalSessions: TimetableSession[] = proposal?.sessions.map((session) => ({ id: session.id, classGroupId: session.classGroupId, day: session.day, startTime: session.startTime, endTime: session.endTime, subjectId: session.subjectId, teacherId: session.teacherId, roomId: session.roomId, type: session.sessionType, generated: true })) ?? []
  const calendarSessions = proposal ? [...sessions, ...proposalSessions] : sessions

  async function runGeneration(selectedRequirementIds: string[], options: { workingDays: DayOfWeek[]; dailyStartTime: string; dailyEndTime: string; quantumMinutes: number; timeLimitSeconds: number; preference: 'balanced' | 'earlier' | 'gaps' }) {
    if (!activeInstitutionId || !selectedTermRecord || !selectedClassGroup) return
    setGeneratorLoading(true); setGeneratorError(null)
    try { const result = await generateTimetable({ institutionId: activeInstitutionId, academicTermId: selectedTermRecord.id, classGroupIds: [selectedClassGroup], selectedRequirementIds, ...options, preserveExisting: true }); setProposal(result); if (result.status === 'OPTIMAL' || result.status === 'FEASIBLE') setGeneratorOpen(false); else setGeneratorError(result.message) } catch (reason) { setGeneratorError(reason instanceof Error ? reason.message : 'Timetable generation failed.') } finally { setGeneratorLoading(false) }
  }

  async function approveGeneratedProposal() {
    if (!proposal?.proposal_id) return
    setGeneratorLoading(true); setGeneratorError(null)
    try { await approveProposal(proposal.proposal_id); setProposal(null); setNotice('Generated proposal approved and saved.'); setSessionReload((value) => value + 1) } catch (reason) { setGeneratorError(reason instanceof Error ? reason.message : 'Proposal approval failed.') } finally { setGeneratorLoading(false) }
  }

  async function discardGeneratedProposal() {
    if (proposal?.proposal_id) await discardProposal(proposal.proposal_id).catch(() => undefined)
    setProposal(null); setNotice('Generated proposal discarded; saved sessions were not changed.')
  }

  return <div className="page-content timetable-page">
    <div className="page-heading">
      <div><p className="eyebrow">Workspace / Timetable</p><h1>Build your academic week.</h1><p className="page-description">Arrange persisted sessions on one shared timeline across Monday through Saturday.</p></div>
      <div className="page-heading__actions"><Button variant="secondary" disabled={!scopeReady || !selectedGroupRecord || scopeLoading || termsLoading || resourcesLoading || sessionsLoading || Boolean(sessionError)} onClick={() => setPrintOpen(true)} title={!selectedGroupRecord ? 'Select a section before printing' : undefined}><Printer size={16} />Print / Save as PDF</Button><Button variant="secondary" disabled={!scopeReady || !selectedGroupRecord || resourcesLoading || termsLoading || generatorLoading} onClick={() => setGeneratorOpen(true)} title={!selectedGroupRecord ? 'Select a class group before generating' : undefined}>Generate Timetable</Button><Button variant="secondary" disabled={!scopeReady || !selectedGroupRecord || generatorLoading} onClick={() => setManageRequirementsOpen(true)}>Manage requirements</Button><Button disabled={!canAdd} onClick={() => openAdd()} title={!canAdd ? 'Select a class group with scheduling resources first' : undefined}><Plus size={17} />Add session</Button></div>
    </div>

    {proposal?.proposal_id && (proposal.status === 'OPTIMAL' || proposal.status === 'FEASIBLE') && <div className="proposal-banner" role="status"><div><strong>Unsaved timetable proposal</strong><p>{proposal.message} {proposal.sessions.length} new session{proposal.sessions.length === 1 ? '' : 's'} · {proposal.solve_time_ms}ms.</p><small>{proposal.requirement_summaries.filter((item) => item.selected).map((item) => `${item.session_type}: ${item.scheduled_count}/${item.required_count} scheduled`).join(' · ')} · Dashed cards are unsaved proposals.</small></div><div className="proposal-banner__actions"><Button type="button" size="sm" variant="secondary" onClick={() => void discardGeneratedProposal()} disabled={generatorLoading}>Discard</Button><Button type="button" size="sm" variant="secondary" onClick={() => setGeneratorOpen(true)} disabled={generatorLoading}>Regenerate</Button><Button type="button" size="sm" onClick={() => void approveGeneratedProposal()} disabled={generatorLoading}>{generatorLoading ? 'Approving…' : 'Approve proposal'}</Button></div></div>}

     {proposal && (proposal.status === 'OPTIMAL' || proposal.status === 'FEASIBLE') && <div className="distribution-card"><div className="generator-section__heading"><div><p className="section-kicker">Proposal distribution</p><strong>{proposal.preference === 'balanced' ? 'Balanced across the week' : proposal.preference === 'earlier' ? 'Prefer earlier periods' : 'Minimize timetable gaps'}</strong></div><span>{proposal.working_days.length === 5 ? 'Monday–Friday' : 'Monday–Saturday'}</span></div>{proposal.warnings.map((warning) => <p key={warning} className="partial-warning">{warning}</p>)}<div className="distribution-grid">{proposal.distribution.filter((item) => !item.excluded || item.sessions > 0).map((item) => <div key={item.day} className={item.excluded ? 'distribution-item distribution-item--excluded' : 'distribution-item'}><strong>{item.day.slice(0, 3).toUpperCase()}</strong><span>{item.minutes} min · {item.sessions} {item.sessions === 1 ? 'session' : 'sessions'}</span><small>{item.saved_sessions} saved · {item.proposed_sessions} proposed</small></div>)}</div></div>}

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
        <div className="selector-grid selector-grid--three">
          <SelectField label="Department" value={selectedDepartment} options={departments.map((item) => ({ id: item.id, label: item.name }))} onChange={setSelectedDepartment} disabled={!activeInstitutionId || scopeLoading} emptyLabel="No departments configured" />
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
      {!scopeReady && activeInstitutionId && <div className="calendar-empty"><h3>Loading the selected institution…</h3><p>Previous institution records are cleared while the new academic scope loads.</p></div>}
      {scopeReady && !selectedClassGroup && <div className="calendar-empty"><h3>Select a section to load its timetable.</h3><p>Choose a department, semester and section above.</p></div>}
      {scopeReady && selectedClassGroup && sessionError && <div className="calendar-empty calendar-empty--error" role="alert"><h3>Timetable could not be loaded.</h3><p>{sessionError}</p><Button type="button" variant="secondary" onClick={() => setSessionReload((current) => current + 1)}><RefreshCw size={14} />Retry</Button></div>}
      {scopeReady && selectedClassGroup && !sessionError && <div className="timetable-scroll">
        {sessionsLoading ? <div className="calendar-empty"><p>Loading saved sessions…</p></div> : <div className="timetable-calendar" style={{ '--timeline-height': `${timelineHeight}px` } as CSSProperties}>
          <div className="timetable-day-header timetable-day-header--time">Time</div>
          {DAYS.map((day) => <div key={day} className={`timetable-day-header ${focusedDay === day ? 'timetable-day-header--focused' : ''}`}><strong>{DAY_LABELS[day]}</strong><span>{calendarSessions.filter((session) => session.day === day).length} {calendarSessions.filter((session) => session.day === day).length === 1 ? 'session' : 'sessions'}</span></div>)}
          <div className="timetable-body"><div className="time-axis" aria-hidden="true">{timeLabels.map((minutes) => { const labelPosition = timeLabelPosition(minutes); return <span key={minutes} className="time-axis__label" style={{ top: minutesToPosition(minutes), transform: labelPosition.transform }}>{minutesToTime(minutes)}</span> })}</div>{DAYS.map((day) => <DayColumn key={day} day={day} sessions={calendarSessions.filter((session) => session.day === day)} timelineHeight={timelineHeight} subjectName={subjectName} teacherName={teacherName} roomName={roomName} onEdit={openEdit} onAdd={() => openAdd(day)} focused={focusedDay === day} />)}</div>
        </div>}
      </div>}
    </Card>

    <div className="timetable-footer"><span><Check size={15} /> {scopeReady ? sessions.length : 0} saved sessions loaded</span><span>API: {environment}{error ? ` · ${error}` : ''}</span></div>

     {printOpen && activeInstitution && selectedDepartmentRecord && selectedSemesterRecord && selectedGroupRecord && <TimetablePrintView institution={activeInstitution} department={selectedDepartmentRecord} semester={selectedSemesterRecord} group={selectedGroupRecord} term={selectedTermRecord} resources={resources} sessions={sessions} onClose={() => setPrintOpen(false)} />}

    {generatorOpen && selectedTermRecord && <GeneratorDialogV2 institution={activeInstitution ?? null} department={selectedDepartmentRecord ?? null} semester={selectedSemesterRecord ?? null} term={selectedTermRecord} group={selectedGroupRecord ?? null} resources={resources} requirements={requirements} sessions={sessions} loading={generatorLoading} error={generatorError} onGenerate={runGeneration} onManage={() => { setGeneratorOpen(false); setManageRequirementsOpen(true) }} onCancel={() => setGeneratorOpen(false)} />}
     {manageRequirementsOpen && selectedGroupRecord && <ManageRequirementsDialog group={selectedGroupRecord} resources={resources} requirements={requirements} onRequirementsChange={setRequirements} onClose={() => setManageRequirementsOpen(false)} />}
     {dialog && <SessionDialog mode={dialog.mode} draft={draft} resources={resources} errors={formErrors} firstFieldRef={firstFieldRef} saving={saving} onChange={updateDraft} onSubmit={submitSession} onCancel={() => setDialog(null)} onRequestDelete={dialog.sessionId ? () => { const target = sessions.find((session) => session.id === dialog.sessionId); setDialog(null); if (target) setDeleteTarget(target) } : undefined} />}
    {deleteTarget && <ConfirmDialog session={deleteTarget} subjectName={subjectName} saving={saving} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}
  </div>
}

type DayColumnProps = { day: DayOfWeek; sessions: TimetableSession[]; timelineHeight: number; subjectName: (id: string) => string; teacherName: (id: string) => string; roomName: (id: string) => string; onEdit: (session: TimetableSession) => void; onAdd: () => void; focused: boolean }
function DayColumn({ day, sessions, timelineHeight, subjectName, teacherName, roomName, onEdit, onAdd, focused }: DayColumnProps) {
  const layouts = layoutDaySessions(sessions, day)
  return <div className={`timetable-day ${focused ? 'timetable-day--focused' : ''}`} style={{ height: timelineHeight }}><div className="timetable-day__grid" />{sessions.map((session) => { const start = timeToMinutes(session.startTime) ?? SCHEDULE_START_MINUTES; const end = timeToMinutes(session.endTime) ?? start + 60; const layout = layouts.get(session.id) ?? { lane: 0, laneCount: 1 }; const gap = 8; const width = `calc(${100 / layout.laneCount}% - ${gap}px)`; const left = `calc(${layout.lane * (100 / layout.laneCount)}% + ${gap / 2}px)`; const height = Math.max(durationToHeight(start, end), 38); return <div key={session.id} className="timetable-session-slot" style={{ top: minutesToPosition(start), height, width, left }}><button type="button" className={`timetable-session timetable-session--${session.type.toLowerCase()} ${session.generated ? 'timetable-session--proposal' : ''}`} onClick={() => { if (!session.generated) onEdit(session) }} aria-label={`${session.generated ? 'Proposed' : 'Edit'} ${subjectName(session.subjectId)} ${session.startTime} to ${session.endTime}`}><span className="timetable-session__type">{session.type}</span><strong>{subjectName(session.subjectId)}</strong><span>{session.startTime}–{session.endTime}</span><small>{teacherName(session.teacherId)} · {roomName(session.roomId)}</small></button></div> })}<button type="button" className="day-add-button" onClick={onAdd}><Plus size={14} /> Add</button></div>
}


type SelectFieldProps = { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean; loading?: boolean; emptyLabel?: string; inputRef?: RefObject<HTMLSelectElement | null> }
function SelectField({ label, value, options, onChange, disabled, loading, emptyLabel = 'No options', inputRef }: SelectFieldProps) {
  return <label className="field"><span>{label}{loading && <em>Loading…</em>}</span><select ref={inputRef} value={value} disabled={disabled || loading} onChange={(event) => onChange(event.target.value)}><option value="">{loading ? 'Loading…' : options.length ? 'Select…' : emptyLabel}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
}

type GeneratorDialogV2Props = { institution: Institution | null; department: Department | null; semester: Semester | null; term: AcademicTerm; group: ClassGroup | null; resources: AcademicResources; requirements: SchedulingRequirement[]; sessions: TimetableSession[]; loading: boolean; error: string | null; onGenerate: (selectedIds: string[], options: { workingDays: DayOfWeek[]; dailyStartTime: string; dailyEndTime: string; quantumMinutes: number; timeLimitSeconds: number; preference: 'balanced' | 'earlier' | 'gaps' }) => Promise<void>; onManage: () => void; onCancel: () => void }
function GeneratorDialogV2({ institution, department, semester, term, group, resources, requirements, sessions, loading, error, onGenerate, onManage, onCancel }: GeneratorDialogV2Props) {
  const activeRequirements = requirements.filter((requirement) => requirement.active)
  const [selectedIds, setSelectedIds] = useState<string[]>(activeRequirements.map((requirement) => requirement.id))
  const [start, setStart] = useState('09:00'); const [end, setEnd] = useState('17:00'); const [workingDays, setWorkingDays] = useState<DayOfWeek[]>([...DAYS]); const [preference, setPreference] = useState<'balanced' | 'earlier' | 'gaps'>('balanced')
  useEffect(() => setSelectedIds(activeRequirements.map((requirement) => requirement.id)), [requirements])
  const summary = requirements.map((requirement) => { const exact = sessions.filter((session) => session.subjectId === requirement.subjectId && session.type === requirement.sessionType && session.teacherId === requirement.teacherId && (timeToMinutes(session.endTime) ?? 0) - (timeToMinutes(session.startTime) ?? 0) === requirement.durationMinutes); const mismatch = sessions.filter((session) => session.subjectId === requirement.subjectId && session.type === requirement.sessionType && !exact.some((match) => match.id === session.id)).length; return { requirement, scheduled: exact.length, remaining: Math.max(requirement.weeklyCount - exact.length, 0), mismatch } })
  const selectedSummary = summary.filter((item) => selectedIds.includes(item.requirement.id)); const totalRequired = selectedSummary.reduce((sum, item) => sum + item.requirement.weeklyCount, 0); const totalScheduled = selectedSummary.reduce((sum, item) => sum + item.scheduled, 0); const totalRemaining = selectedSummary.reduce((sum, item) => sum + item.remaining, 0); const subjectLabel = (id: string) => resources.subjects.find((item) => item.id === id)?.name ?? 'Unknown subject'; const teacherLabel = (id: string) => resources.teachers.find((item) => item.id === id)?.name ?? 'Unknown teacher'
  return <div className="dialog-backdrop" role="presentation"><div className="dialog generator-dialog" role="dialog" aria-modal="true" aria-labelledby="generator-dialog-title"><div className="dialog__header"><div><p className="section-kicker">Automatic timetable proposal</p><h2 id="generator-dialog-title">Generate timetable</h2><p className="dialog__subtitle">Requirements are saved academic obligations. Select which ones participate in this run.</p></div><button type="button" className="dialog-close" onClick={onCancel} aria-label="Close generator"><X size={19} /></button></div>{error && <div className="form-errors" role="alert"><strong>Generation setup</strong><p>{error}</p></div>}<div className="generator-section generator-scope"><p className="section-kicker">1 · Academic scope</p><strong>{institution?.name ?? 'Unknown institution'}</strong><span>{department?.name ?? 'Unknown department'} · {semester?.label ?? 'Unknown semester'} · {group?.sectionName ?? 'Unknown section'} · {term.academicYear} {term.term}</span></div><div className="generator-section"><div className="generator-section__heading"><div><p className="section-kicker">2 · Requirements to generate</p><h3>Choose saved requirements</h3></div><Button type="button" size="sm" variant="secondary" onClick={onManage}>Manage requirements</Button></div>{activeRequirements.length === 0 ? <div className="empty-inline"><p>No active requirements are configured for this section.</p><Button type="button" size="sm" onClick={onManage}>Manage requirements</Button></div> : <div className="requirement-select-list">{summary.filter((item) => item.requirement.active).map(({ requirement, scheduled, remaining, mismatch }) => <label key={requirement.id} className="requirement-select-item"><input type="checkbox" checked={selectedIds.includes(requirement.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, requirement.id] : current.filter((id) => id !== requirement.id))} /><span><strong>{subjectLabel(requirement.subjectId)} · {requirement.sessionType}</strong><small>{requirement.weeklyCount} × {requirement.durationMinutes} minutes · {teacherLabel(requirement.teacherId)} · {requirement.roomType}</small><small>Required {requirement.weeklyCount} · Scheduled {scheduled} · Remaining {remaining}{mismatch ? ` · ${mismatch} existing mismatch${mismatch === 1 ? '' : 'es'}` : ''}</small>{mismatch > 0 && <em>Existing same subject/type sessions with another duration or teacher are not counted.</em>}</span></label>)}</div>}</div><div className="generator-section"><p className="section-kicker">3 · Generation summary</p><div className="generation-summary"><span><strong>{selectedIds.length}</strong> selected requirements</span><span><strong>{totalRequired}</strong> required weekly sessions</span><span><strong>{totalScheduled}</strong> already scheduled</span><span><strong>{totalRemaining}</strong> remaining to generate</span></div>{selectedIds.length > 0 && selectedIds.length < activeRequirements.length && <p className="partial-warning">Partial generation: unselected requirements remain saved and will not produce new sessions.</p>}{selectedIds.length === 0 && <p className="partial-warning">Select at least one saved requirement to generate.</p>}</div><div className="generator-section"><p className="section-kicker">4 · Working days and preferences</p><fieldset className="working-days-fieldset"><legend>Working days</legend><label><input type="radio" name="working-week" checked={workingDays.length === 5} onChange={() => setWorkingDays([...DAYS].slice(0, 5))} /> Monday–Friday (5 days)</label><label><input type="radio" name="working-week" checked={workingDays.length === 6} onChange={() => setWorkingDays([...DAYS])} /> Monday–Saturday (6 days)</label></fieldset><div className="generator-grid generator-grid--compact"><label className="field"><span>Daily start</span><input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="field"><span>Daily end</span><input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label><SelectField label="Optimization" value={preference} options={[{ id: 'balanced', label: 'Balanced across the week (Recommended)' }, { id: 'earlier', label: 'Prefer earlier periods' }, { id: 'gaps', label: 'Minimize timetable gaps' }]} onChange={(value) => setPreference(value as 'balanced' | 'earlier' | 'gaps')} /></div><p className="muted-copy">{workingDays.length === 5 ? 'Monday–Friday' : 'Monday–Saturday'} · 30-minute start grid · saved sessions preserved · solver limit 10 seconds.</p></div><div className="dialog__actions"><Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button><Button type="button" onClick={() => void onGenerate(selectedIds, { workingDays, dailyStartTime: start, dailyEndTime: end, quantumMinutes: 30, timeLimitSeconds: 10, preference })} disabled={loading || selectedIds.length === 0 || totalRemaining === 0}>{loading ? 'Generating…' : totalRemaining > 0 ? `Generate ${totalRemaining} missing session${totalRemaining === 1 ? '' : 's'}` : 'No sessions remaining'}</Button></div></div></div>
}

type ManageRequirementsDialogProps = { group: ClassGroup; resources: AcademicResources; requirements: SchedulingRequirement[]; onRequirementsChange: (requirements: SchedulingRequirement[]) => void; onClose: () => void }
function ManageRequirementsDialog({ group, resources, requirements, onRequirementsChange, onClose }: ManageRequirementsDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null); const [subjectId, setSubjectId] = useState(''); const [teacherId, setTeacherId] = useState(''); const [sessionType, setSessionType] = useState<SessionType>('Lecture'); const [weeklyCount, setWeeklyCount] = useState(1); const [durationMinutes, setDurationMinutes] = useState(60); const [roomType, setRoomType] = useState('classroom'); const [active, setActive] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  const reset = () => { setEditingId(null); setSubjectId(resources.subjects.find((item) => item.active)?.id ?? ''); setTeacherId(resources.teachers.find((item) => item.active)?.id ?? ''); setSessionType('Lecture'); setWeeklyCount(1); setDurationMinutes(60); setRoomType('classroom'); setActive(true); setError(null) }
  useEffect(() => { reset() }, [resources])
  const edit = (requirement: SchedulingRequirement) => { setEditingId(requirement.id); setSubjectId(requirement.subjectId); setTeacherId(requirement.teacherId); setSessionType(requirement.sessionType); setWeeklyCount(requirement.weeklyCount); setDurationMinutes(requirement.durationMinutes); setRoomType(requirement.roomType); setActive(requirement.active); setError(null) }
  async function save() { setBusy(true); setError(null); try { const payload = { subjectId, teacherId, sessionType, weeklyCount, durationMinutes, roomType, active }; const saved = editingId ? await updateRequirement(editingId, payload) : await createRequirement(group.id, payload); onRequirementsChange(editingId ? requirements.map((item) => item.id === editingId ? saved : item) : [...requirements, saved]); reset() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Requirement could not be saved.') } finally { setBusy(false) } }
  async function deactivate(requirement: SchedulingRequirement) { setBusy(true); setError(null); try { const saved = await updateRequirement(requirement.id, { active: false }); onRequirementsChange(requirements.map((item) => item.id === requirement.id ? saved : item)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Requirement could not be deactivated.') } finally { setBusy(false) } }
  return <div className="dialog-backdrop" role="presentation"><div className="dialog generator-dialog" role="dialog" aria-modal="true" aria-labelledby="requirements-dialog-title"><div className="dialog__header"><div><p className="section-kicker">Saved academic obligations</p><h2 id="requirements-dialog-title">Manage requirements</h2><p className="dialog__subtitle">{group.label} · Add, edit or deactivate persisted weekly requirements.</p></div><button type="button" className="dialog-close" onClick={onClose} aria-label="Close requirements"><X size={19} /></button></div>{error && <div className="form-errors" role="alert"><strong>Requirement could not be saved</strong><p>{error}</p></div>}<ul className="requirement-list">{requirements.map((requirement) => <li key={requirement.id}><span><strong>{resources.subjects.find((item) => item.id === requirement.subjectId)?.name ?? 'Unknown subject'} · {requirement.sessionType}</strong><small>{requirement.weeklyCount} × {requirement.durationMinutes} minutes · {resources.teachers.find((item) => item.id === requirement.teacherId)?.name ?? 'Unknown teacher'} · {requirement.roomType} · {requirement.active ? 'Active' : 'Inactive'}</small></span><span className="requirement-row-actions"><Button type="button" size="sm" variant="secondary" onClick={() => edit(requirement)} disabled={busy}>Edit</Button>{requirement.active && <Button type="button" size="sm" variant="secondary" onClick={() => void deactivate(requirement)} disabled={busy}>Deactivate</Button>}</span></li>)}</ul><div className="generator-section"><p className="section-kicker">{editingId ? 'Edit requirement' : 'Add requirement'}</p><div className="generator-grid"><SelectField label="Subject" value={subjectId} options={resources.subjects.filter((item) => item.active || item.id === subjectId).map((item) => ({ id: item.id, label: item.name }))} onChange={setSubjectId} /><SelectField label="Teacher" value={teacherId} options={resources.teachers.filter((item) => item.active || item.id === teacherId).map((item) => ({ id: item.id, label: item.name }))} onChange={setTeacherId} /><SelectField label="Type" value={sessionType} options={SESSION_TYPES.map((item) => ({ id: item, label: item }))} onChange={(value) => setSessionType(value as SessionType)} /><label className="field"><span>Weekly sessions</span><input type="number" min={1} max={20} value={weeklyCount} onChange={(event) => setWeeklyCount(Number(event.target.value))} /></label><label className="field"><span>Duration (minutes)</span><input type="number" min={15} max={240} step={5} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} /></label><SelectField label="Room type" value={roomType} options={['classroom', 'laboratory', 'tutorial', 'any'].map((item) => ({ id: item, label: item }))} onChange={setRoomType} /></div><label className="checkbox-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active requirement</label></div><div className="dialog__actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Close</Button>{editingId && <Button type="button" variant="secondary" onClick={reset} disabled={busy}>Cancel editing</Button>}<Button type="button" onClick={() => void save()} disabled={busy || !subjectId || !teacherId}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add requirement'}</Button></div></div></div>
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
