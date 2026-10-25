import type { DayOfWeek, SessionType, TimetableSession } from './timetable'

export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export type WorkingWeek = 'monday-friday' | 'monday-saturday'
export type Institution = { id: string; name: string; shortName?: string; portalSlug?: string; institutionType?: string; address?: string; workingWeek?: WorkingWeek; active: boolean }
export type WorkingWeekSettings = { institutionId: string; workingWeek: WorkingWeek; workingDays: DayOfWeek[]; saturdayExceptionCount: number; warning?: string | null }
export type Department = { id: string; institutionId: string; code?: string; name: string; active: boolean }
export type AcademicTerm = { id: string; institutionId: string; academicYear: string; term: string; startDate?: string; endDate?: string; active: boolean }
export type Semester = { id: string; departmentId: string; number: number; label: string; active: boolean }
export type ClassGroup = { id: string; departmentId: string; semesterId: string; academicTermId: string; sectionName: string; label: string; active: boolean }
export type Resource = { id: string; code?: string; name: string; roomType?: string; active: boolean; departmentId?: string; semesterId?: string; description?: string; building?: string; capacity?: number; email?: string }
export type Subject = { id: string; institutionId: string; departmentId?: string; semesterId?: string; code: string; name: string; description?: string; active: boolean }
export type Teacher = { id: string; institutionId: string; departmentId?: string; code?: string; name: string; email?: string; active: boolean }
export type Room = { id: string; institutionId: string; code: string; name: string; building?: string; capacity?: number; roomType: string; active: boolean }
export type AcademicResources = { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }
export type SessionPayload = { day: DayOfWeek; startTime: string; endTime: string; subjectId: string; teacherId: string; roomId: string; sessionType: SessionType; notes?: string; locked?: boolean }
export type SchedulingRequirement = { id: string; classGroupId: string; subjectId: string; teacherId: string; sessionType: SessionType; weeklyCount: number; durationMinutes: number; roomType: string; active: boolean }
export type GenerateRequest = { institutionId: string; academicTermId: string; classGroupIds: string[]; selectedRequirementIds: string[]; dailyStartTime?: string; dailyEndTime?: string; quantumMinutes?: number; timeLimitSeconds?: number; preference?: 'balanced' | 'earlier' | 'gaps'; preserveExisting?: boolean }
export type GeneratedSession = { id: string; academicTermId: string; classGroupId: string; day: DayOfWeek; startTime: string; endTime: string; subjectId: string; teacherId: string; roomId: string; sessionType: SessionType; locked: boolean; generated: boolean }
export type RequirementSummary = { requirement_id: string; subject_id: string; teacher_id: string; session_type: SessionType; duration_minutes: number; room_type: string; required_count: number; scheduled_count: number; remaining_count: number; selected: boolean; duration_mismatch_count: number; teacher_mismatch_count: number; warning?: string | null }
export type DayDistribution = { day: DayOfWeek; sessions: number; minutes: number; saved_sessions: number; proposed_sessions: number; excluded: boolean }
export type GenerateResponse = { working_days: DayOfWeek[]; preference: 'balanced' | 'earlier' | 'gaps'; warnings: string[]; distribution: DayDistribution[]; proposal_id: string | null; status: 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'MODEL_INVALID' | 'UNKNOWN'; message: string; requirement_summaries: RequirementSummary[]; sessions: GeneratedSession[]; preserved_sessions: GeneratedSession[]; objective_value?: number | null; solve_time_ms: number }

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(message: string, status: number, detail: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, signal, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    const message = typeof detail === 'string' ? detail : detail?.message || `Request failed (${response.status})`
    throw new ApiError(message, response.status, detail)
  }
  return body as T
}

function mapInstitution(value: { id: string; name: string; short_name?: string; portal_slug?: string; institution_type?: string; address?: string; working_week?: WorkingWeek; active?: boolean }): Institution {
  return { id: value.id, name: value.name, shortName: value.short_name ?? '', portalSlug: value.portal_slug ?? '', institutionType: value.institution_type ?? '', address: value.address ?? '', workingWeek: value.working_week ?? 'monday-saturday', active: value.active ?? true }
}

function mapDepartment(value: { id: string; institution_id: string; code?: string; name: string; active?: boolean }): Department {
  return { id: value.id, institutionId: value.institution_id, code: value.code ?? '', name: value.name, active: value.active ?? true }
}

function mapTerm(value: { id: string; institution_id: string; academic_year: string; term: string; start_date?: string; end_date?: string; active: boolean }): AcademicTerm {
  return { id: value.id, institutionId: value.institution_id, academicYear: value.academic_year, term: value.term, startDate: value.start_date, endDate: value.end_date, active: value.active }
}

function mapSemester(value: { id: string; department_id: string; number: number; label: string; active?: boolean }): Semester {
  return { id: value.id, departmentId: value.department_id, number: value.number, label: value.label, active: value.active ?? true }
}

function mapClassGroup(value: { id: string; department_id: string; semester_id: string; academic_term_id: string; section_name: string; label: string; active?: boolean }): ClassGroup {
  return { id: value.id, departmentId: value.department_id, semesterId: value.semester_id, academicTermId: value.academic_term_id, sectionName: value.section_name, label: value.label, active: value.active ?? true }
}

function mapSession(value: { id: string; academic_term_id: string; class_group_id: string; day: DayOfWeek; start_time: string; end_time: string; subject_id: string; teacher_id: string; room_id: string; session_type: SessionType; notes?: string; locked?: boolean }): TimetableSession {
  return { id: value.id, classGroupId: value.class_group_id, day: value.day, startTime: value.start_time, endTime: value.end_time, subjectId: value.subject_id, teacherId: value.teacher_id, roomId: value.room_id, type: value.session_type, notes: value.notes ?? '' }
}

function mapRequirement(value: { id: string; class_group_id: string; subject_id: string; teacher_id: string; session_type: SessionType; weekly_count: number; duration_minutes: number; room_type: string; active: boolean }): SchedulingRequirement {
  return { id: value.id, classGroupId: value.class_group_id, subjectId: value.subject_id, teacherId: value.teacher_id, sessionType: value.session_type, weeklyCount: value.weekly_count, durationMinutes: value.duration_minutes, roomType: value.room_type, active: value.active }
}

export async function getInstitutions(signal?: AbortSignal, includeInactive = true): Promise<Institution[]> {
  const values = await request<Parameters<typeof mapInstitution>[0][]>(`/api/v1/academic/institutions?include_inactive=${includeInactive}`, {}, signal)
  return values.map(mapInstitution)
}

export async function getAuthorizedInstitutions(signal?: AbortSignal): Promise<Institution[]> {
  const values = await request<Array<{ institution_id: string; institution_name: string; portal_slug?: string; working_week?: WorkingWeek; role: string; active: boolean }>>('/api/v1/auth/me/institutions', {}, signal)
  return values.map((value) => ({ id: value.institution_id, name: value.institution_name, shortName: '', portalSlug: value.portal_slug ?? '', institutionType: '', address: '', workingWeek: value.working_week ?? 'monday-saturday', active: value.active }))
}

export async function getDepartments(institutionId: string, signal?: AbortSignal, includeInactive = true): Promise<Department[]> {
  const values = await request<Parameters<typeof mapDepartment>[0][]>(`/api/v1/academic/institutions/${institutionId}/departments?include_inactive=${includeInactive}`, {}, signal)
  return values.map(mapDepartment)
}

export async function getTerms(institutionId: string, signal?: AbortSignal, includeInactive = true): Promise<AcademicTerm[]> {
  const values = await request<Parameters<typeof mapTerm>[0][]>(`/api/v1/academic/institutions/${institutionId}/terms?include_inactive=${includeInactive}`, {}, signal)
  return values.map(mapTerm)
}

export async function getSemesters(departmentId: string, signal?: AbortSignal, includeInactive = true): Promise<Semester[]> {
  const values = await request<Parameters<typeof mapSemester>[0][]>(`/api/v1/academic/departments/${departmentId}/semesters?include_inactive=${includeInactive}`, {}, signal)
  return values.map(mapSemester)
}

export async function getClassGroups(semesterId: string, signal?: AbortSignal, includeInactive = true): Promise<ClassGroup[]> {
  const values = await request<Parameters<typeof mapClassGroup>[0][]>(`/api/v1/academic/semesters/${semesterId}/class-groups?include_inactive=${includeInactive}`, {}, signal)
  return values.map(mapClassGroup)
}

export async function getAllClassGroups(institutionId: string, departmentId?: string, signal?: AbortSignal, includeInactive = true): Promise<ClassGroup[]> {
  const query = new URLSearchParams({ institution_id: institutionId, include_inactive: String(includeInactive) })
  if (departmentId) query.set('department_id', departmentId)
  const values = await request<Parameters<typeof mapClassGroup>[0][]>(`/api/v1/academic/class-groups?${query}`, {}, signal)
  return values.map(mapClassGroup)
}

export async function getResources(institutionId: string, departmentId: string, signal?: AbortSignal, semesterId?: string): Promise<AcademicResources> {
  const query = new URLSearchParams({ institution_id: institutionId, department_id: departmentId })
  if (semesterId) query.set('semester_id', semesterId)
  const value = await request<{ subjects: Resource[]; teachers: Resource[]; rooms: Array<Resource & { room_type?: string }> }>(`/api/v1/academic/resources?${query}`, {}, signal)
  return { subjects: value.subjects, teachers: value.teachers, rooms: value.rooms.map((room) => ({ ...room, roomType: room.room_type })) }
}

export async function getSessions(classGroupId: string, signal?: AbortSignal): Promise<TimetableSession[]> {
  const values = await request<Parameters<typeof mapSession>[0][]>(`/api/v1/timetables/${classGroupId}/sessions`, {}, signal)
  return values.map(mapSession)
}

function toApiPayload(payload: SessionPayload) {
  return { day: payload.day, start_time: payload.startTime, end_time: payload.endTime, subject_id: payload.subjectId, teacher_id: payload.teacherId, room_id: payload.roomId, session_type: payload.sessionType, notes: payload.notes || null, locked: payload.locked ?? false }
}

export async function createSession(classGroupId: string, payload: SessionPayload): Promise<TimetableSession> {
  const value = await request<Parameters<typeof mapSession>[0]>(`/api/v1/timetables/${classGroupId}/sessions`, { method: 'POST', body: JSON.stringify(toApiPayload(payload)) })
  return mapSession(value)
}

export async function updateSession(sessionId: string, payload: SessionPayload): Promise<TimetableSession> {
  const value = await request<Parameters<typeof mapSession>[0]>(`/api/v1/timetable-sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(toApiPayload(payload)) })
  return mapSession(value)
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request<void>(`/api/v1/timetable-sessions/${sessionId}`, { method: 'DELETE' })
}

export async function provisionDevelopmentSetup(): Promise<{ created: boolean; message: string }> {
  return request<{ created: boolean; message: string }>('/api/v1/academic/setup', { method: 'POST', body: '{}' })
}
