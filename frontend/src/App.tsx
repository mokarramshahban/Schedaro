import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { AppSidebar } from './components/layout/AppSidebar'
import { TimetablePage } from './pages/TimetablePage'

type Status = { application: string; environment: string; service: string; database_available: boolean }
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'

function App() {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const loadStatus = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`${apiUrl}/api/v1/status`)
      .then((response) => { if (!response.ok) throw new Error('Backend request failed'); return response.json() as Promise<Status> })
      .then(setStatus)
      .catch((reason: Error) => { setStatus(null); setError(reason.message) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  return <div className="app-shell">
    <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} connected={Boolean(status?.database_available)} />
    <div className="app-main"><AppHeader onMenuOpen={() => setSidebarOpen(true)} connected={Boolean(status?.database_available)} loading={loading} onRefresh={loadStatus} /><main><TimetablePage connected={Boolean(status?.database_available)} environment={status?.environment} error={error} /></main></div>
  </div>
}

export default App
