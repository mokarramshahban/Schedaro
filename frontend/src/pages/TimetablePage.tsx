import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import { Check, Info, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card'
import { StatusDot } from '../components/ui/StatusDot'
import { departmentOptions, demoSessions, institutionOptions, roomOptions, sectionOptions, semesterOptions, subjectOptions, teacherOptions } from '../data/timetableDemo'
import { DAY_LABELS, DAYS, PIXELS_PER_HOUR, SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, SESSION_TYPES, durationToHeight, layoutDaySessions, minutesToPosition, minutesToTime, removeSession, sessionsForClassGroup, timeToMinutes, upsertSession, validateSession, type DayOfWeek, type SessionType, type TimetableSession } from '../lib/timetable'

type TimetablePageProps = { connected: boolean; environment?: string; error?: string | null }
type SessionDraft = Omit<TimetableSession, 'id' | 'classGroupId'>
type DialogState = { mode: 'add' | 'edit'; sessionId?: string }

const createDraft = (day: DayOfWeek = 'monday'): SessionDraft => ({
  day,
  startTime: '09:00',
  endTime: '10:00',
  subjectId: subjectOptions[0].id,
  teacherId: teacherOptions[0].id,
  roomId: roomOptions[0].id,
  type: 'Lecture',
  notes: '',
})

export function TimetablePage({ connected, environment = 'development', error }: TimetablePageProps) {
  const [sessions, setSessions] = useState<TimetableSession[]>(demoSessions)
  const [selectedInstitution, setSelectedInstitution] = useState(institutionOptions[0].id)
  const [selectedDepartment, setSelectedDepartment] = useState(departmentOptions[0].id)
  const [selectedSemester, setSelectedSemester] = useState(semesterOptions[0].id)
  const [selectedSection, setSelectedSection] = useState(sectionOptions[0].id)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [draft, setDraft] = useState<SessionDraft>(createDraft())
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<TimetableSession | null>(null)
  const [focusedDay, setFocusedDay] = useState<DayOfWeek>('monday')
  const firstFieldRef = useRef<HTMLSelectElement>(null)

  const visibleSessions = useMemo(() => sessionsForClassGroup(sessions, selectedSection), [sessions, selectedSection])
  const timelineHeight = minutesToPosition(SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, PIXELS_PER_HOUR)
  const timeLabels = Array.from({ length: 9 }, (_, index) => SCHEDULE_START_MINUTES + index * 60)

  useEffect(() => {
    if (dialog) window.setTimeout(() => firstFieldRef.current?.focus(), 0)
  }, [dialog])

  const subjectName = (id: string) => subjectOptions.find((option) => option.id === id)?.label ?? 'Unknown subject'
  const teacherName = (id: string) => teacherOptions.find((option) => option.id === id)?.label ?? 'Unknown teacher'
  const roomName = (id: string) => roomOptions.find((option) => option.id === id)?.label ?? 'Unknown room'

  function openAdd(day: DayOfWeek = focusedDay) {
    setDraft(createDraft(day))
    setFormErrors([])
    setDialog({ mode: 'add' })
  }

  function openEdit(session: TimetableSession) {
    const { id: _id, classGroupId: _classGroupId, ...sessionDraft } = session
    setDraft(sessionDraft)
    setFormErrors([])
    setDialog({ mode: 'edit', sessionId: session.id })
  }

  function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dialog) return
    const candidate: TimetableSession = {
      ...draft,
      id: dialog.sessionId ?? `session-${Date.now()}`,
      classGroupId: selectedSection,
    }
    const errors = validateSession(candidate, sessions)
    if (errors.length > 0) {
      setFormErrors(errors)
      return
    }
    setSessions((current) => upsertSession(current, candidate))
    setFocusedDay(candidate.day)
    setDialog(null)
  }

  function updateDraft<K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setFormErrors([])
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setSessions((current) => removeSession(current, deleteTarget.id))
    setDeleteTarget(null)
  }

  return <div className="page-content timetable-page">
    <div className="page-heading">
      <div><p className="eyebrow">Workspace / Timetable</p><h1>Build your academic week.</h1><p className="page-description">Arrange sessions on one shared timeline across Monday through Saturday.</p></div>
      <Button onClick={() => openAdd()}><Plus size={17} />Add session</Button>
    </div>

    <div className="status-banner timetable-status" role="status">
      <div className="status-banner__icon"><Info size={18} /></div>
      <div><strong>Temporary planning workspace</strong><p>Demo changes are held in memory only and reset when the page refreshes. PostgreSQL saving arrives in Stage 3.</p></div>
      <StatusDot label={connected ? 'API connected' : 'API unavailable'} state={connected ? 'success' : 'error'} />
    </div>

    <Card className="scope-card">
      <CardHeader><div><p className="section-kicker">Academic scope</p><CardTitle>Choose the class group to display</CardTitle></div><span className="demo-badge"><span />Demo data</span></CardHeader>
      <CardBody><div className="selector-grid">
        <SelectField label="Institution" value={selectedInstitution} options={institutionOptions} onChange={setSelectedInstitution} />
        <SelectField label="Department" value={selectedDepartment} options={departmentOptions} onChange={setSelectedDepartment} />
        <SelectField label="Semester" value={selectedSemester} options={semesterOptions} onChange={setSelectedSemester} />
        <SelectField label="Section" value={selectedSection} options={sectionOptions} onChange={setSelectedSection} />
      </div></CardBody>
    </Card>

    <div className="timetable-toolbar">
      <div><p className="section-kicker">Weekly calendar</p><h2>{sectionOptions.find((option) => option.id === selectedSection)?.label}</h2></div>
      <div className="timetable-toolbar__meta"><span className="legend-dot legend-dot--lecture" /> Lecture <span className="legend-dot legend-dot--lab" /> Lab <span className="legend-dot legend-dot--tutorial" /> Tutorial</div>
    </div>

    <Card className="timetable-card">
      <div className="mobile-day-picker" aria-label="Focused day preview">
        {DAYS.map((day) => <button key={day} type="button" className={focusedDay === day ? 'mobile-day-picker__item mobile-day-picker__item--active' : 'mobile-day-picker__item'} onClick={() => setFocusedDay(day)}>{DAY_LABELS[day].slice(0, 3)}</button>)}
      </div>
      <div className="timetable-scroll">
        <div className="timetable-calendar" style={{ '--timeline-height': `${timelineHeight}px` } as CSSProperties}>
          <div className="timetable-day-header timetable-day-header--time">Time</div>
          {DAYS.map((day) => <div key={day} className={`timetable-day-header ${focusedDay === day ? 'timetable-day-header--focused' : ''}`}><strong>{DAY_LABELS[day]}</strong><span>{visibleSessions.filter((session) => session.day === day).length} sessions</span></div>)}
          <div className="timetable-body">
            <div className="time-axis" aria-hidden="true">
              {timeLabels.map((minutes) => <span key={minutes} className="time-axis__label" style={{ top: minutesToPosition(minutes) }}>{minutesToTime(minutes)}</span>)}
            </div>
            {DAYS.map((day) => <DayColumn key={day} day={day} sessions={visibleSessions.filter((session) => session.day === day)} timelineHeight={timelineHeight} subjectName={subjectName} teacherName={teacherName} roomName={roomName} onEdit={openEdit} onAdd={() => openAdd(day)} focused={focusedDay === day} />)}
          </div>
        </div>
      </div>
    </Card>

    <div className="timetable-footer"><span><Check size={15} /> {visibleSessions.length} temporary sessions loaded</span><span>API: {environment}{error ? ` · ${error}` : ''}</span></div>

    {dialog && <SessionDialog mode={dialog.mode} draft={draft} errors={formErrors} firstFieldRef={firstFieldRef} onChange={updateDraft} onSubmit={submitSession} onCancel={() => setDialog(null)} onRequestDelete={dialog.sessionId ? () => { const target = sessions.find((session) => session.id === dialog.sessionId); setDialog(null); if (target) setDeleteTarget(target) } : undefined} />}
    {deleteTarget && <ConfirmDialog session={deleteTarget} subjectName={subjectName} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />}
  </div>
}

type DayColumnProps = { day: DayOfWeek; sessions: TimetableSession[]; timelineHeight: number; subjectName: (id: string) => string; teacherName: (id: string) => string; roomName: (id: string) => string; onEdit: (session: TimetableSession) => void; onAdd: () => void; focused: boolean }

function DayColumn({ day, sessions, timelineHeight, subjectName, teacherName, roomName, onEdit, onAdd, focused }: DayColumnProps) {
  const layouts = layoutDaySessions(sessions, day)
  return <div className={`timetable-day ${focused ? 'timetable-day--focused' : ''}`} style={{ height: timelineHeight }}>
    <div className="timetable-day__grid" />
    {sessions.map((session) => {
      const start = timeToMinutes(session.startTime) ?? SCHEDULE_START_MINUTES
      const end = timeToMinutes(session.endTime) ?? start + 60
      const layout = layouts.get(session.id) ?? { lane: 0, laneCount: 1 }
      const gap = 8
      const width = `calc(${100 / layout.laneCount}% - ${gap}px)`
      const left = `calc(${layout.lane * (100 / layout.laneCount)}% + ${gap / 2}px)`
      return <button key={session.id} type="button" className={`timetable-session timetable-session--${session.type.toLowerCase()}`} style={{ top: minutesToPosition(start), height: Math.max(durationToHeight(start, end), 38), width, left }} onClick={() => onEdit(session)} aria-label={`Edit ${subjectName(session.subjectId)} ${session.startTime} to ${session.endTime}`}>
        <span className="timetable-session__type">{session.type}</span><strong>{subjectName(session.subjectId)}</strong><span>{session.startTime}–{session.endTime}</span><small>{teacherName(session.teacherId)} · {roomName(session.roomId)}</small>
      </button>
    })}
    <button type="button" className="day-add-button" onClick={onAdd}><Plus size={14} /> Add</button>
  </div>
}

type SelectFieldProps = { label: string; value: string; options: { id: string; label: string }[]; onChange: (value: string) => void; inputRef?: RefObject<HTMLSelectElement | null> }
function SelectField({ label, value, options, onChange, inputRef }: SelectFieldProps) {
  return <label className="field"><span>{label}</span><select ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
}

type SessionDialogProps = { mode: 'add' | 'edit'; draft: SessionDraft; errors: string[]; firstFieldRef: RefObject<HTMLSelectElement | null>; onChange: <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void; onRequestDelete?: () => void }
function SessionDialog({ mode, draft, errors, firstFieldRef, onChange, onSubmit, onCancel, onRequestDelete }: SessionDialogProps) {
  return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-labelledby="session-dialog-title"><div className="dialog__header"><div><p className="section-kicker">Temporary session</p><h2 id="session-dialog-title">{mode === 'add' ? 'Add session' : 'Edit session'}</h2></div><button type="button" className="dialog-close" onClick={onCancel} aria-label="Close dialog"><X size={19} /></button></div><form onSubmit={onSubmit}>
    {errors.length > 0 && <div className="form-errors" role="alert"><strong>Check this session</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    <div className="dialog-grid"><SelectField label="Day" value={draft.day} options={DAYS.map((day) => ({ id: day, label: DAY_LABELS[day] }))} onChange={(value) => onChange('day', value as DayOfWeek)} inputRef={firstFieldRef} /><SelectField label="Subject" value={draft.subjectId} options={subjectOptions} onChange={(value) => onChange('subjectId', value)} /><SelectField label="Teacher" value={draft.teacherId} options={teacherOptions} onChange={(value) => onChange('teacherId', value)} /><SelectField label="Room / lab" value={draft.roomId} options={roomOptions} onChange={(value) => onChange('roomId', value)} /><SelectField label="Session type" value={draft.type} options={SESSION_TYPES.map((type) => ({ id: type, label: type }))} onChange={(value) => onChange('type', value as SessionType)} /><label className="field"><span>Start time</span><input type="time" value={draft.startTime} onChange={(event) => onChange('startTime', event.target.value)} /></label><label className="field"><span>End time</span><input type="time" value={draft.endTime} onChange={(event) => onChange('endTime', event.target.value)} /></label><label className="field field--full"><span>Notes <em>Optional</em></span><textarea rows={3} value={draft.notes ?? ''} onChange={(event) => onChange('notes', event.target.value)} placeholder="Add a short planning note" /></label></div>
    <div className="dialog__actions">{mode === 'edit' && onRequestDelete && <Button type="button" variant="ghost" className="button--danger-ghost" onClick={onRequestDelete}><Trash2 size={15} />Remove</Button>}<span className="dialog__actions-spacer" /><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit">{mode === 'add' ? 'Add session' : 'Apply changes'}</Button></div>
  </form></div></div>
}

type ConfirmDialogProps = { session: TimetableSession; subjectName: (id: string) => string; onCancel: () => void; onConfirm: () => void }
function ConfirmDialog({ session, subjectName, onCancel, onConfirm }: ConfirmDialogProps) {
  return <div className="dialog-backdrop" role="presentation"><div className="dialog dialog--compact" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title"><div className="dialog__header"><div><p className="section-kicker">Remove temporary session</p><h2 id="delete-dialog-title">Remove this session?</h2></div><button type="button" className="dialog-close" onClick={onCancel} aria-label="Close confirmation"><X size={19} /></button></div><p className="confirm-copy"><strong>{subjectName(session.subjectId)}</strong> on {DAY_LABELS[session.day]} from {session.startTime} to {session.endTime} will be removed from this temporary timetable.</p><div className="dialog__actions"><Button type="button" variant="secondary" onClick={onCancel}>Keep session</Button><Button type="button" className="button--danger" onClick={onConfirm}><Trash2 size={15} />Remove session</Button></div></div></div>
}
