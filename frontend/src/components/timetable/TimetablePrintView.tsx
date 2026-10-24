import { Printer, X } from 'lucide-react'
import type { AcademicTerm, ClassGroup, Department, Institution, Resource, Semester } from '../../lib/api'
import { DAY_LABELS, DAYS, SCHEDULE_END_MINUTES, SCHEDULE_START_MINUTES, timeToMinutes, type TimetableSession } from '../../lib/timetable'

type Props = {
  institution: Institution
  department: Department
  semester: Semester
  group: ClassGroup
  term?: AcademicTerm
  resources: { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }
  sessions: TimetableSession[]
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
  const range = SCHEDULE_END_MINUTES - SCHEDULE_START_MINUTES
  const topPercent = ((minutes - SCHEDULE_START_MINUTES) / range) * 100
  if (minutes <= SCHEDULE_START_MINUTES) return { topPercent: 0, transform: 'translateY(0)' }
  if (minutes >= SCHEDULE_END_MINUTES) return { topPercent: 100, transform: 'translateY(-100%)' }
  return { topPercent, transform: 'translateY(-50%)' }
}

function resourceName(resources: Resource[], id: string, missingLabel: string) {
  return resources.find((item) => item.id === id)?.name ?? missingLabel
}

export function TimetablePrintView({ institution, department, semester, group, term, resources, sessions, onClose }: Props) {
  const subjectName = (id: string) => resourceName(resources.subjects, id, 'Subject unavailable')
  const teacherName = (id: string) => resourceName(resources.teachers, id, 'Teacher unavailable')
  const roomName = (id: string) => resourceName(resources.rooms, id, 'Room unavailable')
  const academicContext = term ? `${term.academicYear} · ${term.term}` : 'Academic term not configured'
  return <div className="print-preview-backdrop" role="presentation">
    <div className="print-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="print-preview-title">
      <div className="print-preview-toolbar"><div><p className="section-kicker">A4 landscape preview</p><h2 id="print-preview-title">Print / Save PDF</h2></div><div className="print-preview-actions"><button type="button" className="button button--primary" onClick={() => window.print()}><Printer size={16} />Print / Save as PDF</button><button type="button" className="dialog-close" onClick={onClose} aria-label="Close print preview"><X size={19} /></button></div></div>
      <div className="print-preview-scroll"><article className="print-document" aria-label={`${institution.name} timetable`}>
        <header className="print-document__header"><div className="print-document__identity"><p className="print-document__eyebrow">{institution.institutionType || 'Academic institution'}</p><h1>{institution.name}</h1>{institution.address && <p className="print-document__address">{institution.address}</p>}</div><div className="print-document__scope"><p>Weekly Academic Timetable</p><strong>{department.name}</strong><span>{semester.label} — {group.sectionName}</span><span>{academicContext}</span></div></header>
        <div className="print-document__rule" />
        <section className="print-grid" aria-label="Monday through Saturday timetable">
          <div className="print-grid__time-header">Time</div>{DAYS.map((day) => <div className="print-grid__day-header" key={day}>{DAY_LABELS[day]}</div>)}
          <div className="print-grid__body"><div className="print-grid__time-axis">{Array.from({ length: 9 }, (_, index) => { const minutes = SCHEDULE_START_MINUTES + index * 60; const labelPosition = printTimeLabelPosition(minutes); return <span key={minutes} style={{ top: `${labelPosition.topPercent}%`, transform: labelPosition.transform }}>{`${String(Math.floor(minutes / 60)).padStart(2, '0')}:00`}</span> })}</div>{DAYS.map((day) => <div className="print-grid__day" key={day}>{sessions.filter((session) => session.day === day).map((session) => { const position = printSessionPosition(session); return <div className={`print-session print-session--${session.type.toLowerCase()}`} key={session.id} style={{ top: `${position.topPercent}%`, height: `${position.heightPercent}%` }}><strong>{subjectName(session.subjectId)}</strong><span>{session.startTime}–{session.endTime} · {session.type}</span><small>{teacherName(session.teacherId)} · {roomName(session.roomId)}</small></div> })}</div>)}</div>
        </section>
        {sessions.length === 0 && <p className="print-document__empty">No saved sessions are currently assigned to this section.</p>}
        <div className="print-document__signature-space" aria-label="Reserved space for handwritten signatures and institutional stamp" />
      </article></div>
    </div>
  </div>
}
