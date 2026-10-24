import { useCallback, useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { AppHeader } from './components/layout/AppHeader'
import { AppSidebar, type WorkspaceView } from './components/layout/AppSidebar'
import { Button } from './components/ui/Button'
import { Card, CardBody } from './components/ui/Card'
import { InstitutionProvider, useInstitution } from './lib/InstitutionContext'
import { InstitutionSetupPage } from './pages/InstitutionSetupPage'
import { ResourceManagementPage } from './pages/ResourceManagementPage'
import { TimetablePage } from './pages/TimetablePage'

type Status = { application: string; environment: string; service: string; database_available: boolean; rust_engine_available?: boolean }
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
const pageTitles: Record<WorkspaceView, string> = { timetable: 'Timetable', subjects: 'Subjects', teachers: 'Teachers', rooms: 'Rooms & labs', classes: 'Classes', settings: 'Institution settings' }

function App() { return <InstitutionProvider><AppShell /></InstitutionProvider> }

function AppShell() {
  const { activeInstitutions, activeInstitutionId, loading: institutionLoading, error: institutionError } = useInstitution()
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [view, setView] = useState<WorkspaceView>('timetable')

  const loadStatus = useCallback(() => {
    setLoading(true); setError(null)
    fetch(`${apiUrl}/api/v1/status`)
      .then((response) => { if (!response.ok) throw new Error('Backend request failed'); return response.json() as Promise<Status> })
      .then(setStatus)
      .catch((reason: Error) => { setStatus(null); setError(reason.message) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const connected = Boolean(status?.database_available)
  const noActiveInstitution = !institutionLoading && !institutionError && activeInstitutions.length === 0
  const needsInstitutionChoice = !institutionLoading && view !== 'settings' && activeInstitutions.length > 1 && !activeInstitutionId
  const content = noActiveInstitution ? <InstitutionSetupPage /> : needsInstitutionChoice ? <InstitutionChoicePage /> : view === 'timetable' ? <TimetablePage connected={connected} environment={status?.environment} error={error} onOpenSettings={() => setView('settings')} /> : <ResourceManagementPage mode={view} connected={connected} />
  return <div className="app-shell">
    <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} connected={connected} currentView={view} onNavigate={setView} />
    <div className="app-main"><AppHeader pageTitle={noActiveInstitution ? 'Institution setup' : pageTitles[view]} onMenuOpen={() => setSidebarOpen(true)} onOpenInstitutionSettings={() => setView('settings')} connected={connected} loading={loading} onRefresh={loadStatus} /><main>{content}</main></div>
  </div>
}

function InstitutionChoicePage() {
  const { activeInstitutions, activeInstitutionId, setActiveInstitutionId } = useInstitution()
  return <div className="page-content institution-choice-page"><Card className="institution-choice-card"><CardBody><div className="institution-setup-page__icon"><Building2 size={24} /></div><p className="eyebrow">Choose your workspace</p><h1>Select an institution</h1><p>Choose the institution whose departments, resources and timetable you want to manage. Schedaro will keep this context active across the application.</p><label className="field"><span>Active institution</span><select required autoFocus value={activeInstitutionId} onChange={(event) => setActiveInstitutionId(event.target.value)}><option value="">Select an institution…</option>{activeInstitutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}{institution.shortName ? ` · ${institution.shortName}` : ''}</option>)}</select></label><Button type="button" onClick={() => setActiveInstitutionId(activeInstitutionId)} disabled={!activeInstitutionId}>Continue</Button></CardBody></Card></div>
}

export default App
