import { apiUrl } from './api'

export type PlatformInstitution = { id: string; name: string; portal_slug?: string | null; short_name?: string | null; institution_type?: string | null; contact_email?: string | null; contact_phone?: string | null; address?: string | null; timezone: string; working_week: 'monday-friday' | 'monday-saturday'; daily_start_time: string; daily_end_time: string; status: string; schema_version?: string | null; active: boolean; database_ready: boolean; provisioning_operation_id?: string | null; registered_at?: string | null }
export type PlatformOverview = { institution_count: number; active_institution_count: number; ready_institution_count: number; owner_count: number; institutions: PlatformInstitution[] }
export type Provisioning = { id: string; institution_id: string; status: string; error_message?: string | null; attempts: number; created_at?: string | null; updated_at?: string | null }
export type CreateInstitutionInput = { name: string; short_name?: string; institution_type?: string; contact_email?: string; contact_phone?: string; address?: string; timezone: string; working_week: 'monday-friday' | 'monday-saturday'; daily_start_time: string; daily_end_time: string; initial_departments: string[]; idempotency_key: string }
export type CreateInstitutionResponse = { institution: PlatformInstitution; provisioning: Provisioning }
export type Invitation = { id: string; recipient_email: string; institution_id: string; institution_name: string; portal_slug?: string | null; role: string; method: 'email' | 'manual'; approval_status: string; status: string; delivery_status: string; expires_at: string; created_at?: string | null }
export type ManualInvitationCreated = { invitation: Invitation; activation_url: string; activation_key: string; expires_at: string }
export type RoleAssignment = { id: string; user_id: string; user_email?: string | null; institution_id: string; role: string; scope_type: string; scope_id?: string | null; scope_label?: string | null; designation?: string | null; status: string; granted_by: string; created_at?: string | null }
export type RoleContext = { assignment_id?: string | null; institution_id?: string | null; role?: string | null; scope_type?: string | null; scope_id?: string | null; permissions: string[] }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.detail?.message || 'Platform request failed.')
  return body as T
}

export function getPlatformOverview() { return request<PlatformOverview>('/api/v1/platform/overview') }
export function createInstitution(payload: CreateInstitutionInput) { return request<CreateInstitutionResponse>('/api/v1/platform/institutions', { method: 'POST', body: JSON.stringify(payload) }) }
export function listInvitations(institutionId: string) { return request<Invitation[]>(`/api/v1/platform/institutions/${institutionId}/invitations`) }
export function inviteAdministrator(institutionId: string, email: string) { return request<Invitation>(`/api/v1/platform/institutions/${institutionId}/invitations`, { method: 'POST', body: JSON.stringify({ email, role: 'institution_admin' }) }) }
export function getPortalUrl(slug: string) { return `${window.location.origin}/c/${slug}` }
export function createManualInvitation(institutionId: string, email: string) { return request<ManualInvitationCreated>(`/api/v1/platform/institutions/${institutionId}/manual-invitations`, { method: 'POST', body: JSON.stringify({ email, expiration_hours: 168 }) }) }
export function approveInvitation(invitationId: string, decision: 'approve' | 'reject') { return request<Invitation>(`/api/v1/platform/invitations/${invitationId}/approval`, { method: 'POST', body: JSON.stringify({ decision }) }) }
export function listRoleAssignments() { return request<RoleAssignment[]>('/api/v1/auth/me/role-assignments') }
export function getRoleContext() { return request<RoleContext>('/api/v1/auth/me/role-context') }
export function selectRoleContext(assignmentId: string) { return request<RoleContext>('/api/v1/auth/me/role-context', { method: 'POST', body: JSON.stringify({ assignment_id: assignmentId }) }) }
export function listInstitutionAssignments(institutionId: string) { return request<RoleAssignment[]>(`/api/v1/platform/institutions/${institutionId}/users`) }
export function assignRole(payload: { user_id: string; institution_id: string; role: string; scope_type: string; scope_id?: string; designation?: string }) { return request<RoleAssignment>(`/api/v1/platform/institutions/${payload.institution_id}/role-assignments`, { method: 'POST', body: JSON.stringify(payload) }) }
export function revokeRole(assignmentId: string) { return request<RoleAssignment>(`/api/v1/platform/role-assignments/${assignmentId}/revoke`, { method: 'POST' }) }
