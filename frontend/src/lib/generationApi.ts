import type { DayDistribution, GenerateRequest, GenerateResponse, GeneratedSession, RequirementSummary, SchedulingRequirement } from './api'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.detail?.message || body?.detail || `Request failed (${response.status})`)
  return body as T
}

export async function getRequirements(classGroupId: string): Promise<SchedulingRequirement[]> {
  const values = await request<Array<Parameters<typeof mapRequirement>[0]>>(`/api/v1/scheduling/class-groups/${classGroupId}/requirements`)
  return values.map(mapRequirement)
}

function mapRequirement(value: { id: string; class_group_id: string; subject_id: string; teacher_id: string; session_type: SchedulingRequirement['sessionType']; weekly_count: number; duration_minutes: number; room_type: string; active: boolean }): SchedulingRequirement {
  return { id: value.id, classGroupId: value.class_group_id, subjectId: value.subject_id, teacherId: value.teacher_id, sessionType: value.session_type, weeklyCount: value.weekly_count, durationMinutes: value.duration_minutes, roomType: value.room_type, active: value.active }
}

export async function createRequirement(classGroupId: string, payload: Omit<SchedulingRequirement, 'id' | 'classGroupId' | 'active'> & { active?: boolean }): Promise<SchedulingRequirement> {
  const value = await request<Parameters<typeof mapRequirement>[0]>(`/api/v1/scheduling/class-groups/${classGroupId}/requirements`, { method: 'POST', body: JSON.stringify({ subject_id: payload.subjectId, teacher_id: payload.teacherId, session_type: payload.sessionType, weekly_count: payload.weeklyCount, duration_minutes: payload.durationMinutes, room_type: payload.roomType, active: payload.active ?? true }) })
  return mapRequirement(value)
}

function mapSummary(value: RequirementSummary): RequirementSummary { return value }

function mapGenerated(value: { id: string; academic_term_id: string; class_group_id: string; day: GeneratedSession['day']; start_time: string; end_time: string; subject_id: string; teacher_id: string; room_id: string; session_type: GeneratedSession['sessionType']; locked?: boolean; generated?: boolean }): GeneratedSession {
  return { id: value.id, academicTermId: value.academic_term_id, classGroupId: value.class_group_id, day: value.day, startTime: value.start_time, endTime: value.end_time, subjectId: value.subject_id, teacherId: value.teacher_id, roomId: value.room_id, sessionType: value.session_type, locked: value.locked ?? false, generated: value.generated ?? true }
}

export async function updateRequirement(requirementId: string, payload: Partial<Omit<SchedulingRequirement, 'id' | 'classGroupId'>>): Promise<SchedulingRequirement> {
  const value = await request<Parameters<typeof mapRequirement>[0]>(`/api/v1/scheduling/requirements/${requirementId}`, { method: 'PATCH', body: JSON.stringify({ subject_id: payload.subjectId, teacher_id: payload.teacherId, session_type: payload.sessionType, weekly_count: payload.weeklyCount, duration_minutes: payload.durationMinutes, room_type: payload.roomType, active: payload.active }) })
  return mapRequirement(value)
}

export async function deleteRequirement(requirementId: string) { return request<void>(`/api/v1/scheduling/requirements/${requirementId}`, { method: 'DELETE' }) }

export async function generateTimetable(payload: GenerateRequest): Promise<GenerateResponse> {
  const value = await request<{ working_days: GenerateResponse['working_days']; preference: GenerateResponse['preference']; warnings: string[]; distribution: DayDistribution[]; proposal_id: string | null; status: GenerateResponse['status']; message: string; requirement_summaries: RequirementSummary[]; sessions: Array<Parameters<typeof mapGenerated>[0]>; preserved_sessions: Array<Parameters<typeof mapGenerated>[0]>; objective_value?: number | null; solve_time_ms: number }>('/api/v1/scheduling/generate', { method: 'POST', body: JSON.stringify({ institution_id: payload.institutionId, academic_term_id: payload.academicTermId, class_group_ids: payload.classGroupIds, selected_requirement_ids: payload.selectedRequirementIds, daily_start_time: payload.dailyStartTime, daily_end_time: payload.dailyEndTime, quantum_minutes: payload.quantumMinutes, time_limit_seconds: payload.timeLimitSeconds, preference: payload.preference, preserve_existing: payload.preserveExisting }) })
  return { working_days: value.working_days, preference: value.preference, warnings: value.warnings, distribution: value.distribution, proposal_id: value.proposal_id, status: value.status, message: value.message, requirement_summaries: value.requirement_summaries.map(mapSummary), sessions: value.sessions.map(mapGenerated), preserved_sessions: value.preserved_sessions.map((session) => mapGenerated({ ...session, generated: false })), objective_value: value.objective_value, solve_time_ms: value.solve_time_ms }
}

export async function approveProposal(proposalId: string) {
  return request<{ proposal_id: string; status: 'approved'; saved_sessions: Array<Parameters<typeof mapSavedSession>[0]>; message: string }>(`/api/v1/scheduling/proposals/${proposalId}/approve`, { method: 'POST' })
}

function mapSavedSession(value: { id: string; academic_term_id: string; class_group_id: string; day: string; start_time: string; end_time: string; subject_id: string; teacher_id: string; room_id: string; session_type: string; notes?: string }) { return value }

export async function discardProposal(proposalId: string) {
  return request<void>(`/api/v1/scheduling/proposals/${proposalId}`, { method: 'DELETE' })
}
