import { apiUrl, ApiError } from './api'

export type PlatformUser = { id: string; email: string; role: 'platform_owner' | string; active: boolean }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    throw new ApiError(typeof detail === 'string' ? detail : detail?.message || `Request failed (${response.status})`, response.status, detail)
  }
  return body as T
}

export function login(email: string, password: string) {
  return request<PlatformUser>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function getCurrentUser() {
  return request<PlatformUser>('/api/v1/auth/me')
}

export function logout() {
  return request<void>('/api/v1/auth/logout', { method: 'POST' })
}
