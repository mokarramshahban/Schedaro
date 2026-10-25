export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
export type DayOfWeek = typeof DAYS[number]
export type WorkingWeek = 'monday-friday' | 'monday-saturday'
export function workingDaysForWeek(workingWeek: WorkingWeek): DayOfWeek[] { return workingWeek === 'monday-friday' ? [...DAYS].slice(0, 5) : [...DAYS] }

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
}

export const SESSION_TYPES = ['Lecture', 'Laboratory', 'Tutorial'] as const
export type SessionType = typeof SESSION_TYPES[number]

export type TimetableSession = {
  id: string
  classGroupId: string
  day: DayOfWeek
  startTime: string
  endTime: string
  subjectId: string
  teacherId: string
  roomId: string
  type: SessionType
  notes?: string
  locked?: boolean
  generated?: boolean
}

export type SelectOption = { id: string; label: string }

export const SCHEDULE_START_MINUTES = 9 * 60
export const SCHEDULE_END_MINUTES = 17 * 60
export const PIXELS_PER_HOUR = 84

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60).toString().padStart(2, '0')
  const remainder = (minutes % 60).toString().padStart(2, '0')
  return `${hours}:${remainder}`
}

export type TimeLabelPosition = { topPercent: number; transform: string }

/** Physical label top inside a timetable gutter. Endpoint labels are inset from borders. */
export function timeLabelY(minutes: number, origin: number, end: number, topMm: number, bottomMm: number, labelHeightMm = 4, edgeInsetMm = 0.8): number {
  const ratio = Math.max(0, Math.min(1, (minutes - origin) / (end - origin)))
  if (ratio <= 0) return topMm + edgeInsetMm
  if (ratio >= 1) return bottomMm - labelHeightMm - edgeInsetMm
  return topMm + ratio * (bottomMm - topMm) - labelHeightMm / 2
}

export type SessionCardGeometry = { x: number; y: number; width: number; height: number; insetMm: number }

/** Inner visual card geometry; the outer interval remains the exact schedule rectangle. */
export function sessionCardGeometry(x: number, y: number, width: number, height: number, preferredInsetMm = 1): SessionCardGeometry {
  const insetMm = Math.min(preferredInsetMm, Math.max(0.35, (height - 4) / 2))
  return { x: x + insetMm, y: y + insetMm, width: Math.max(1, width - insetMm * 2), height: Math.max(2, height - insetMm * 2), insetMm }
}

export function minutesToPosition(minutes: number, origin = SCHEDULE_START_MINUTES, pixelsPerHour = PIXELS_PER_HOUR): number {
  return ((minutes - origin) / 60) * pixelsPerHour
}

export function timeLabelPosition(minutes: number, origin = SCHEDULE_START_MINUTES, end = SCHEDULE_END_MINUTES, edgeInset = '4px'): TimeLabelPosition {
  const range = end - origin
  const topPercent = ((minutes - origin) / range) * 100
  if (minutes <= origin) return { topPercent: 0, transform: `translateY(${edgeInset})` }
  if (minutes >= end) return { topPercent: 100, transform: `translateY(calc(-100% - ${edgeInset}))` }
  return { topPercent, transform: 'translateY(-50%)' }
}

export function durationToHeight(startMinutes: number, endMinutes: number, pixelsPerHour = PIXELS_PER_HOUR): number {
  return ((endMinutes - startMinutes) / 60) * pixelsPerHour
}

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

export type SessionConflict = {
  kind: 'class' | 'teacher' | 'room'
  session: TimetableSession
  message: string
}

export function findSessionConflicts(candidate: TimetableSession, sessions: TimetableSession[]): SessionConflict[] {
  const candidateStart = timeToMinutes(candidate.startTime)
  const candidateEnd = timeToMinutes(candidate.endTime)
  if (candidateStart === null || candidateEnd === null) return []

  return sessions.flatMap((session) => {
    if (session.id === candidate.id || session.day !== candidate.day) return []
    const start = timeToMinutes(session.startTime)
    const end = timeToMinutes(session.endTime)
    if (start === null || end === null || !rangesOverlap(candidateStart, candidateEnd, start, end)) return []

    const conflicts: SessionConflict[] = []
    if (candidate.classGroupId === session.classGroupId) {
      conflicts.push({ kind: 'class', session, message: 'This class group already has an overlapping session.' })
    }
    if (candidate.teacherId === session.teacherId) {
      conflicts.push({ kind: 'teacher', session, message: 'This teacher is already scheduled at that time.' })
    }
    if (candidate.roomId === session.roomId) {
      conflicts.push({ kind: 'room', session, message: 'This room is already booked at that time.' })
    }
    return conflicts
  })
}

export function sessionsForClassGroup(sessions: TimetableSession[], classGroupId: string): TimetableSession[] {
  return sessions.filter((session) => session.classGroupId === classGroupId)
}

export function upsertSession(sessions: TimetableSession[], nextSession: TimetableSession): TimetableSession[] {
  const exists = sessions.some((session) => session.id === nextSession.id)
  return exists ? sessions.map((session) => session.id === nextSession.id ? nextSession : session) : [...sessions, nextSession]
}

export function removeSession(sessions: TimetableSession[], sessionId: string): TimetableSession[] {
  return sessions.filter((session) => session.id !== sessionId)
}

export function validateSession(candidate: TimetableSession, sessions: TimetableSession[]): string[] {
  const errors: string[] = []
  const start = timeToMinutes(candidate.startTime)
  const end = timeToMinutes(candidate.endTime)

  if (!candidate.subjectId || !candidate.teacherId || !candidate.roomId) errors.push('Subject, teacher, and room are required.')
  if (start === null || end === null) errors.push('Enter valid start and end times.')
  if (start !== null && end !== null) {
    if (start < SCHEDULE_START_MINUTES || end > SCHEDULE_END_MINUTES) errors.push('Sessions must stay within the 09:00–17:00 workspace window.')
    if (start >= end) errors.push('End time must be later than start time.')
  }

  if (errors.length === 0) {
    errors.push(...findSessionConflicts(candidate, sessions).map((conflict) => conflict.message))
  }
  return [...new Set(errors)]
}

type SessionLayout = { lane: number; laneCount: number }

export function layoutDaySessions(sessions: TimetableSession[], day: DayOfWeek): Map<string, SessionLayout> {
  const daySessions = sessions
    .filter((session) => session.day === day)
    .map((session) => ({ session, start: timeToMinutes(session.startTime) ?? 0, end: timeToMinutes(session.endTime) ?? 0 }))
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const lanes: Array<{ end: number; id: string }> = []
  const layouts = new Map<string, SessionLayout>()

  daySessions.forEach(({ session, start, end }) => {
    let lane = lanes.findIndex((current) => current.end <= start)
    if (lane === -1) lane = lanes.length
    lanes[lane] = { end, id: session.id }
    layouts.set(session.id, { lane, laneCount: 1 })
  })

  daySessions.forEach(({ session, start, end }) => {
    const overlapping = daySessions.filter((other) => rangesOverlap(start, end, other.start, other.end))
    const current = layouts.get(session.id)
    if (current) layouts.set(session.id, { ...current, laneCount: Math.max(current.laneCount, overlapping.length) })
  })
  return layouts
}
