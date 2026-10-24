import {
  apiUrl,
  type AcademicTerm,
  type ClassGroup,
  type Department,
  type Institution,
  type Room,
  type Semester,
  type Subject,
  type Teacher,
  ApiError,
} from './api'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    throw new ApiError(typeof detail === 'string' ? detail : detail?.message || `Request failed (${response.status})`, response.status, detail)
  }
  return body as T
}

const query = (values: Record<string, string | undefined>) => {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, value) })
  return params.toString()
}

export type InstitutionPayload = { name: string; shortName?: string; institutionType?: string; address?: string; active?: boolean }
export type DepartmentPayload = { name: string; code?: string; active?: boolean }
export type TermPayload = { academicYear: string; term: string; startDate?: string; endDate?: string; active?: boolean }
export type SemesterPayload = { number: number; label: string; active?: boolean }
export type ClassGroupPayload = { departmentId: string; semesterId?: string; academicTermId: string; sectionName: string; active?: boolean }
export type SubjectPayload = { departmentId?: string; semesterId?: string; code: string; name: string; description?: string; active?: boolean }
export type TeacherPayload = { departmentId?: string; code?: string; name: string; email?: string; active?: boolean }
export type RoomPayload = { code: string; name: string; building?: string; capacity?: number; roomType: string; active?: boolean }

const toInstitution = (value: any): Institution => ({ id: value.id, name: value.name, shortName: value.short_name ?? '', institutionType: value.institution_type ?? '', address: value.address ?? '', active: value.active ?? true })
const toDepartment = (value: any): Department => ({ id: value.id, institutionId: value.institution_id, code: value.code ?? '', name: value.name, active: value.active ?? true })
const toTerm = (value: any): AcademicTerm => ({ id: value.id, institutionId: value.institution_id, academicYear: value.academic_year, term: value.term, startDate: value.start_date, endDate: value.end_date, active: value.active })
const toSemester = (value: any): Semester => ({ id: value.id, departmentId: value.department_id, number: value.number, label: value.label, active: value.active ?? true })
const toGroup = (value: any): ClassGroup => ({ id: value.id, departmentId: value.department_id, semesterId: value.semester_id, academicTermId: value.academic_term_id, sectionName: value.section_name, label: value.label, active: value.active ?? true })
const toSubject = (value: any): Subject => ({ id: value.id, institutionId: value.institution_id, departmentId: value.department_id, semesterId: value.semester_id, code: value.code, name: value.name, description: value.description ?? '', active: value.active })
const toTeacher = (value: any): Teacher => ({ id: value.id, institutionId: value.institution_id, departmentId: value.department_id, code: value.code ?? '', name: value.name, email: value.email ?? '', active: value.active })
const toRoom = (value: any): Room => ({ id: value.id, institutionId: value.institution_id, code: value.code, name: value.name, building: value.building ?? '', capacity: value.capacity ?? undefined, roomType: value.room_type, active: value.active })

const snake = (payload: Record<string, unknown>) => Object.fromEntries(Object.entries(payload).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value === '' ? null : value]))

export async function createInstitution(payload: InstitutionPayload) { return toInstitution(await request('/api/v1/academic/institutions', { method: 'POST', body: JSON.stringify(snake(payload)) })) }
export async function updateInstitution(id: string, payload: Partial<InstitutionPayload>) { return toInstitution(await request(`/api/v1/academic/institutions/${id}`, { method: 'PATCH', body: JSON.stringify(snake(payload)) })) }
export async function createDepartment(institutionId: string, payload: DepartmentPayload) { return toDepartment(await request(`/api/v1/academic/institutions/${institutionId}/departments`, { method: 'POST', body: JSON.stringify(snake(payload)) })) }
export async function updateDepartment(id: string, payload: Partial<DepartmentPayload>) { return toDepartment(await request(`/api/v1/academic/departments/${id}`, { method: 'PATCH', body: JSON.stringify(snake(payload)) })) }
export async function createTerm(institutionId: string, payload: TermPayload) { return toTerm(await request(`/api/v1/academic/institutions/${institutionId}/terms`, { method: 'POST', body: JSON.stringify(snake(payload)) })) }
export async function updateTerm(id: string, payload: Partial<TermPayload>) { return toTerm(await request(`/api/v1/academic/terms/${id}`, { method: 'PATCH', body: JSON.stringify(snake(payload)) })) }
export async function createSemester(departmentId: string, payload: SemesterPayload) { return toSemester(await request(`/api/v1/academic/departments/${departmentId}/semesters`, { method: 'POST', body: JSON.stringify(snake(payload)) })) }
export async function updateSemester(id: string, payload: Partial<SemesterPayload>) { return toSemester(await request(`/api/v1/academic/semesters/${id}`, { method: 'PATCH', body: JSON.stringify(snake(payload)) })) }
export async function createClassGroup(semesterId: string, payload: ClassGroupPayload) { return toGroup(await request(`/api/v1/academic/semesters/${semesterId}/class-groups`, { method: 'POST', body: JSON.stringify(snake(payload)) })) }
export async function updateClassGroup(id: string, payload: Partial<ClassGroupPayload>) { return toGroup(await request(`/api/v1/academic/class-groups/${id}`, { method: 'PATCH', body: JSON.stringify(snake(payload)) })) }

export async function listSubjects(institutionId: string, filters: { departmentId?: string; semesterId?: string; search?: string; includeInactive?: boolean } = {}) {
  const value = await request<any[]>(`/api/v1/academic/subjects?${query({ institution_id: institutionId, department_id: filters.departmentId, semester_id: filters.semesterId, search: filters.search, include_inactive: String(filters.includeInactive ?? true) })}`)
  return value.map(toSubject)
}
export async function createSubject(institutionId: string, payload: SubjectPayload) { return toSubject(await request(`/api/v1/academic/institutions/${institutionId}/subjects`, { method: 'POST', body: JSON.stringify(snake(payload)) })) }
export async function updateSubject(id: string, payload: Partial<SubjectPayload>) { return toSubject(await request(`/api/v1/academic/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(snake(payload)) })) }

export async function listTeachers(institutionId: string, filters: { departmentId?: string; search?: string; includeInactive?: boolean } = {}) {
  const value = await request<any[]>(`/api/v1/academic/teachers?${query({ institution_id: institutionId, department_id: filters.departmentId, search: filters.search, include_inactive: String(filters.includeInactive ?? true) })}`)
  return value.map(toTeacher)
}
export async function createTeacher(institutionId: string, payload: TeacherPayload) { return toTeacher(await request(`/api/v1/academic/institutions/${institutionId}/teachers`, { method: 'POST', body: JSON.stringify(snake(payload)) })) }
export async function updateTeacher(id: string, payload: Partial<TeacherPayload>) { return toTeacher(await request(`/api/v1/academic/teachers/${id}`, { method: 'PATCH', body: JSON.stringify(snake(payload)) })) }

export async function listRooms(institutionId: string, filters: { search?: string; roomType?: string; includeInactive?: boolean } = {}) {
  const value = await request<any[]>(`/api/v1/academic/rooms?${query({ institution_id: institutionId, search: filters.search, room_type: filters.roomType, include_inactive: String(filters.includeInactive ?? true) })}`)
  return value.map(toRoom)
}
export async function createRoom(institutionId: string, payload: RoomPayload) { return toRoom(await request(`/api/v1/academic/institutions/${institutionId}/rooms`, { method: 'POST', body: JSON.stringify(snake(payload)) })) }
export async function updateRoom(id: string, payload: Partial<RoomPayload>) { return toRoom(await request(`/api/v1/academic/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(snake(payload)) })) }

export async function listManagementGroups(institutionId: string, departmentId?: string) {
  const value = await request<any[]>(`/api/v1/academic/class-groups?${query({ institution_id: institutionId, department_id: departmentId, include_inactive: 'true' })}`)
  return value.map(toGroup)
}

export { ApiError }
