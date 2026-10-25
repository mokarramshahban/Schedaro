import type { LucideIcon } from 'lucide-react'
import { CalendarDays, ChevronRight, CircleHelp, DoorOpen, GraduationCap, LayoutGrid, Settings2, Shapes, UsersRound, X } from 'lucide-react'
import { StatusDot } from '../ui/StatusDot'

export type WorkspaceView = 'dashboard' | 'timetable' | 'subjects' | 'teachers' | 'rooms' | 'classes' | 'access' | 'settings'
type NavItem = { label: string; icon: LucideIcon; view: WorkspaceView }

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutGrid, view: 'dashboard' },
  { label: 'Timetable', icon: CalendarDays, view: 'timetable' },
  { label: 'Subjects', icon: Shapes, view: 'subjects' },
  { label: 'Teachers', icon: UsersRound, view: 'teachers' },
  { label: 'Rooms', icon: DoorOpen, view: 'rooms' },
  { label: 'Classes', icon: GraduationCap, view: 'classes' },
  { label: 'Users & Access', icon: UsersRound, view: 'access' },
]

type AppSidebarProps = { open: boolean; onClose: () => void; connected: boolean; currentView: WorkspaceView; onNavigate: (view: WorkspaceView) => void; platformOverview?: boolean }

export function AppSidebar({ open, onClose, connected, currentView, onNavigate, platformOverview = false }: AppSidebarProps) {
  return <>
    <div className={`sidebar-backdrop ${open ? 'sidebar-backdrop--visible' : ''}`} onClick={onClose} aria-hidden="true" />
    <aside className={`app-sidebar ${open ? 'app-sidebar--open' : ''}`} aria-label="Primary navigation">
      <div className="sidebar-rail">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div className="rail-icons" aria-hidden="true"><LayoutGrid className="rail-icon rail-icon--active" size={18} strokeWidth={1.8} /><CircleHelp className="rail-icon" size={18} strokeWidth={1.8} /></div>
        <button className="rail-close" type="button" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="sidebar-panel">
        <div className="sidebar-brand"><div><p className="brand-name">Schedaro</p><p className="brand-subtitle">Smart Academic Timetable Builder</p></div><span className="brand-version">v0.2</span></div>
        <div className="sidebar-section-label">{platformOverview ? 'Platform administration' : 'Workspace'}</div>
        <nav className="primary-nav">
          {platformOverview ? <div className="nav-item nav-item--active" aria-current="page"><LayoutGrid size={18} /><span>Overview</span><ChevronRight className="nav-chevron" size={15} /></div> : navItems.map(({ label, icon: Icon, view }) => { const active = currentView === view; return <button key={label} className={`nav-item ${active ? 'nav-item--active' : ''}`} type="button" onClick={() => { onNavigate(view); onClose() }} aria-current={active ? 'page' : undefined}><Icon size={18} strokeWidth={active ? 2.2 : 1.8} /><span>{label}</span>{active ? <ChevronRight className="nav-chevron" size={15} /> : null}</button> })}
        </nav>
        {!platformOverview && <><div className="sidebar-section-label sidebar-section-label--lower">System</div><button className={`nav-item ${currentView === 'settings' ? 'nav-item--active' : ''}`} type="button" onClick={() => { onNavigate('settings'); onClose() }} aria-current={currentView === 'settings' ? 'page' : undefined}><Settings2 size={18} strokeWidth={currentView === 'settings' ? 2.2 : 1.8} /><span>Settings</span>{currentView === 'settings' ? <ChevronRight className="nav-chevron" size={15} /> : null}</button></>}
        <div className="sidebar-spacer" />
        <div className="sidebar-status"><div className="sidebar-status__top"><span className="sidebar-status__label">Development API</span><StatusDot label={connected ? 'Live' : 'Offline'} state={connected ? 'success' : 'error'} /></div><p>Connection status reflects the running Schedaro API.</p></div>
        <div className="sidebar-footer"><span className="avatar">S</span><div><strong>Schedaro workspace</strong><span>Local development</span></div></div>
      </div>
    </aside>
  </>
}
