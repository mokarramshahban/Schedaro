import { ArrowRight, CalendarClock, Check, ClipboardList, Info, Plus, Sparkles } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card'
import { StatusDot } from '../components/ui/StatusDot'

type TimetablePageProps = { connected: boolean; environment?: string; error?: string | null }

export function TimetablePage({ connected, environment = 'development', error }: TimetablePageProps) {
  return <div className="page-content">
    <div className="page-heading">
      <div><p className="eyebrow">Workspace / Timetable</p><h1>Build your week with clarity.</h1><p className="page-description">Set up the foundations for a conflict-free academic timetable.</p></div>
      <Button disabled title="Timetable creation arrives in Stage 2"><Plus size={17} />Create timetable</Button>
    </div>

    <div className="status-banner" role="status">
      <div className="status-banner__icon"><Info size={18} /></div>
      <div><strong>Stage 1 foundation</strong><p>The timetable workspace is ready for the weekly builder. Scheduling controls will be introduced in the next stage.</p></div>
      <StatusDot label={connected ? 'API connected' : 'API unavailable'} state={connected ? 'success' : 'error'} />
    </div>

    <div className="overview-grid">
      <Card className="workspace-card">
        <CardHeader><div><p className="section-kicker">Primary workspace</p><CardTitle>Weekly timetable</CardTitle></div><span className="planned-badge">Stage 2</span></CardHeader>
        <CardBody><div className="empty-workspace"><div className="empty-icon"><CalendarClock size={30} strokeWidth={1.6} /></div><h2>Your weekly view will live here.</h2><p>When the builder is enabled, you will arrange classes, teachers, subjects, and rooms from this focused workspace.</p><div className="empty-actions"><Button disabled title="Available in Stage 2"><Plus size={16} />Add first session</Button><Button variant="secondary" disabled>Preview print layout</Button></div></div></CardBody>
      </Card>
      <Card className="setup-card">
        <CardHeader><div><p className="section-kicker">Getting started</p><CardTitle>Prepare your workspace</CardTitle></div><ClipboardList size={20} className="card-header-icon" /></CardHeader>
        <CardBody><div className="setup-list"><SetupItem label="Choose your timetable scope" done={false} /><SetupItem label="Add subjects and teachers" done={false} /><SetupItem label="Set up rooms and classes" done={false} /></div><div className="setup-note"><Sparkles size={16} /><span>These foundations become available in the supporting tabs stage.</span></div></CardBody>
      </Card>
    </div>

    <div className="foundation-grid">
      <Card><CardBody><div className="foundation-icon foundation-icon--indigo"><CalendarClock size={18} /></div><div><p className="foundation-label">Current focus</p><h3>Timetable-first workspace</h3><p className="foundation-copy">No dashboards or unrelated modules—just the space needed to build the academic week.</p></div><ArrowRight size={17} className="foundation-arrow" /></CardBody></Card>
      <Card><CardBody><div className="foundation-icon foundation-icon--green"><Check size={18} /></div><div><p className="foundation-label">Infrastructure</p><h3>{connected ? 'All systems connected' : 'Connection needs attention'}</h3><p className="foundation-copy">API environment: <strong>{environment}</strong>{error ? ` · ${error}` : ''}</p></div><StatusDot label={connected ? 'Ready' : 'Check'} state={connected ? 'success' : 'error'} /></CardBody></Card>
    </div>
  </div>
}

function SetupItem({ label, done }: { label: string; done: boolean }) {
  return <div className="setup-item"><span className={`setup-check ${done ? 'setup-check--done' : ''}`}>{done && <Check size={13} />}</span><span>{label}</span><span className="setup-item__state">Planned</span></div>
}
