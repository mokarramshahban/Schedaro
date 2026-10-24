import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { AppSidebar, type WorkspaceView } from './components/layout/AppSidebar'
import { ResourceManagementPage } from './pages/ResourceManagementPage'
import { TimetablePage } from './pages/TimetablePage'

type Status = { application: string; environment: string; service: string; database_available: boolean; rust_engine_available?: boolean }
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
const pageTitles: Record<WorkspaceView, string> = { timetable: 'Timetable', subjects: 'Subjects', teachers: 'Teachers', rooms: 'Rooms & labs', classes: 'Classes', settings: 'Institution settings' }

function App() {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [view, setView] = useState<WorkspaceView>('timetable')

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

  const connected = Boolean(status?.database_available)
  return <div className="app-shell">
    <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} connected={connected} currentView={view} onNavigate={setView} />
    <div className="app-main"><AppHeader pageTitle={pageTitles[view]} onMenuOpen={() => setSidebarOpen(true)} connected={connected} loading={loading} onRefresh={loadStatus} /><main>{view === 'timetable' ? <TimetablePage connected={connected} environment={status?.environment} error={error} /> : <ResourceManagementPage mode={view} connected={connected} />}</main></div>
  </div>
}

export default App
