import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getAuthorizedInstitutions, type Institution } from './api'

const ACTIVE_INSTITUTION_KEY = 'schedaro.activeInstitutionId'

type InstitutionContextValue = {
  institutions: Institution[]
  activeInstitutions: Institution[]
  activeInstitutionId: string
  activeInstitution?: Institution
  loading: boolean
  error: string | null
  setActiveInstitutionId: (institutionId: string) => void
  refreshInstitutions: (preferredId?: string) => Promise<void>
}

const InstitutionContext = createContext<InstitutionContextValue | null>(null)

export function resolveActiveInstitutionId(institutions: Institution[], currentId: string, storedId: string | null): string {
  const active = institutions.filter((institution) => institution.active)
  if (currentId && active.some((institution) => institution.id === currentId)) return currentId
  if (storedId && active.some((institution) => institution.id === storedId)) return storedId
  return active.length === 1 ? active[0].id : ''
}

function readStoredInstitutionId() {
  try { return window.localStorage.getItem(ACTIVE_INSTITUTION_KEY) } catch { return null }
}

function persistInstitutionId(institutionId: string) {
  try {
    if (institutionId) window.localStorage.setItem(ACTIVE_INSTITUTION_KEY, institutionId)
    else window.localStorage.removeItem(ACTIVE_INSTITUTION_KEY)
  } catch { /* localStorage is a convenience, PostgreSQL remains authoritative. */ }
}

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [activeInstitutionId, setActiveInstitutionIdState] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  const refreshInstitutions = useCallback(async (preferredId?: string) => {
    const sequence = ++requestSequence.current
    setLoading(true)
    setError(null)
    try {
      const values = await getAuthorizedInstitutions()
      if (sequence !== requestSequence.current) return
      setInstitutions(values)
      setActiveInstitutionIdState((currentId) => {
        const nextId = resolveActiveInstitutionId(values, preferredId ?? currentId, preferredId ?? readStoredInstitutionId())
        persistInstitutionId(nextId)
        return nextId
      })
    } catch (reason) {
      if (sequence !== requestSequence.current) return
      setError(reason instanceof Error ? reason.message : 'Institutions could not be loaded.')
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void refreshInstitutions() }, [refreshInstitutions])

  const setActiveInstitutionId = useCallback((institutionId: string) => {
    setActiveInstitutionIdState((currentId) => {
      const next = institutions.some((institution) => institution.id === institutionId && institution.active) ? institutionId : ''
      if (next !== currentId) persistInstitutionId(next)
      return next
    })
  }, [institutions])

  const activeInstitutions = useMemo(() => institutions.filter((institution) => institution.active), [institutions])
  const activeInstitution = activeInstitutions.find((institution) => institution.id === activeInstitutionId)

  const value = useMemo(() => ({ institutions, activeInstitutions, activeInstitutionId, activeInstitution, loading, error, setActiveInstitutionId, refreshInstitutions }), [activeInstitution, activeInstitutionId, activeInstitutions, error, institutions, loading, refreshInstitutions, setActiveInstitutionId])
  return <InstitutionContext.Provider value={value}>{children}</InstitutionContext.Provider>
}

export function useInstitution() {
  const value = useContext(InstitutionContext)
  if (!value) throw new Error('useInstitution must be used inside InstitutionProvider')
  return value
}
