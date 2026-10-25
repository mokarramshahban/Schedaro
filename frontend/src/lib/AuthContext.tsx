import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, login as loginRequest, logout as logoutRequest, type PlatformUser } from './authApi'

type AuthContextValue = { user: PlatformUser | null; loading: boolean; error: string | null; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; refresh: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(async () => {
    try { setError(null); setUser(await getCurrentUser()) } catch { setUser(null) } finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  const login = useCallback(async (email: string, password: string) => { setError(null); try { setUser(await loginRequest(email, password)) } catch (reason) { const message = reason instanceof Error ? reason.message : 'Login failed.'; setError(message); throw reason } }, [])
  const logout = useCallback(async () => { await logoutRequest(); setUser(null) }, [])
  const value = useMemo(() => ({ user, loading, error, login, logout, refresh }), [error, loading, login, logout, refresh, user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value }
