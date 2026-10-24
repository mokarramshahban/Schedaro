import type { DayOfWeek, SessionType, TimetableSession } from './timetable'

export const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export type Institution = { id: string; name: string }
export type Department = { id: string; institutionId: string; name: string }
export type Semester = { id: string; departmentId: string; number: number; label: string }
export type ClassGroup = { id: string; departmentId: string; semesterId: string; academicTermId: string; sectionName: string; label: string }
export type Resource = { id: string; code?: string; name: string; roomType?: string }
export type AcademicResources = { subjects: Resource[]; teachers: Resource[]; rooms: Resource[] }
export type SessionPayload = { day: DayOfWeek; startTime: string; endTime: string; subjectId: string; teacherId: string; roomId: string; sessionType: SessionType; notes?: string }

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
  const response = await fetch(`${apiUrl}${path}`, { ...init, signal, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    const message = typeof detail === 'string' ? detail : detail?.message || `Request failed (${response.status})`
    throw new ApiError(message, response.status, detail)
  }
  return body as T
}

function mapDepartment(value: { id: string; institution_id: string; name: string }): Department {
  return { id: value.id, institutionId: value.institution_id, name: value.name }
}

function mapSemester(value: { id: string; department_id: string; number: number; label: string }): Semester {
  return { id: value.id, departmentId: value.department_id, number: value.number, label: value.label }
}

function mapClassGroup(value: { id: string; department_id: string; semester_id: string; academic_term_id: string; section_name: string; label: string }): ClassGroup {
  return { id: value.id, departmentId: value.department_id, semesterId: value.semester_id, academicTermId: value.academic_term_id, sectionName: value.section_name, label: value.label }
}

function mapSession(value: { id: string; academic_term_id: string; class_group_id: string; day: DayOfWeek; start_time: string; end_time: string; subject_id: string; teacher_id: string; room_id: string; session_type: SessionType; notes?: string }): TimetableSession {
  return { id: value.id, classGroupId: value.class_group_id, day: value.day, startTime: value.start_time, endTime: value.end_time, subjectId: value.subject_id, teacherId: value.teacher_id, roomId: value.room_id, type: value.session_type, notes: value.notes ?? '' }
}

export async function getInstitutions(signal?: AbortSignal): Promise<Institution[]> {
  return request<Institution[]>('/api/v1/academic/institutions', {}, signal)
}

export async function getDepartments(institutionId: string, signal?: AbortSignal): Promise<Department[]> {
  const values = await request<{ id: string; institution_id: string; name: string }[]>(`/api/v1/academic/institutions/${institutionId}/departments`, {}, signal)
  return values.map(mapDepartment)
}

export async function getSemesters(departmentId: string, signal?: AbortSignal): Promise<Semester[]> {
  const values = await request<{ id: string; department_id: string; number: number; label: string }[]>(`/api/v1/academic/departments/${departmentId}/semesters`, {}, signal)
  return values.map(mapSemester)
}

export async function getClassGroups(semesterId: string, signal?: AbortSignal): Promise<ClassGroup[]> {
  const values = await request<{ id: string; department_id: string; semester_id: string; academic_term_id: string; section_name: string; label: string }[]>(`/api/v1/academic/semesters/${semesterId}/class-groups`, {}, signal)
  return values.map(mapClassGroup)
}

export async function getResources(institutionId: string, departmentId: string, signal?: AbortSignal): Promise<AcademicResources> {
  const value = await request<{ subjects: Resource[]; teachers: Resource[]; rooms: Array<Resource & { room_type?: string }> }>(`/api/v1/academic/resources?institution_id=${encodeURIComponent(institutionId)}&department_id=${encodeURIComponent(departmentId)}`, {}, signal)
  return { subjects: value.subjects, teachers: value.teachers, rooms: value.rooms.map((room) => ({ ...room, roomType: room.room_type })) }
}

export async function getSessions(classGroupId: string, signal?: AbortSignal): Promise<TimetableSession[]> {
  const values = await request<Parameters<typeof mapSession>[0][]>(`/api/v1/timetables/${classGroupId}/sessions`, {}, signal)
  return values.map(mapSession)
}

function toApiPayload(payload: SessionPayload) {
  return { day: payload.day, start_time: payload.startTime, end_time: payload.endTime, subject_id: payload.subjectId, teacher_id: payload.teacherId, room_id: payload.roomId, session_type: payload.sessionType, notes: payload.notes || null }
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
