import type { LucideIcon } from 'lucide-react'
import { CalendarDays, ChevronRight, CircleHelp, DoorOpen, GraduationCap, LayoutGrid, Settings2, Shapes, UsersRound, X } from 'lucide-react'
import { StatusDot } from '../ui/StatusDot'

type NavItem = { label: string; icon: LucideIcon; active?: boolean; disabled?: boolean }

const navItems: NavItem[] = [
  { label: 'Timetable', icon: CalendarDays, active: true },
  { label: 'Subjects', icon: Shapes, disabled: true },
  { label: 'Teachers', icon: UsersRound, disabled: true },
  { label: 'Rooms', icon: DoorOpen, disabled: true },
  { label: 'Classes', icon: GraduationCap, disabled: true },
]

type AppSidebarProps = { open: boolean; onClose: () => void; connected: boolean }

export function AppSidebar({ open, onClose, connected }: AppSidebarProps) {
  return <>
    <div className={`sidebar-backdrop ${open ? 'sidebar-backdrop--visible' : ''}`} onClick={onClose} aria-hidden="true" />
    <aside className={`app-sidebar ${open ? 'app-sidebar--open' : ''}`} aria-label="Primary navigation">
      <div className="sidebar-rail">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div className="rail-icons" aria-hidden="true">
          <LayoutGrid className="rail-icon rail-icon--active" size={18} strokeWidth={1.8} />
          <CircleHelp className="rail-icon" size={18} strokeWidth={1.8} />
        </div>
        <button className="rail-close" type="button" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="sidebar-panel">
        <div className="sidebar-brand">
          <div><p className="brand-name">Schedaro</p><p className="brand-subtitle">Smart Academic Timetable Builder</p></div>
          <span className="brand-version">v0.2</span>
        </div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="primary-nav">
          {navItems.map(({ label, icon: Icon, active, disabled }) => <button key={label} className={`nav-item ${active ? 'nav-item--active' : ''} ${disabled ? 'nav-item--disabled' : ''}`} type="button" disabled={disabled} aria-current={active ? 'page' : undefined} title={disabled ? `${label} is planned for a later stage` : undefined}>
            <Icon size={18} strokeWidth={active ? 2.2 : 1.8} /><span>{label}</span>{disabled ? <span className="nav-soon">Soon</span> : <ChevronRight className="nav-chevron" size={15} />}
          </button>)}
        </nav>
        <div className="sidebar-section-label sidebar-section-label--lower">System</div>
        <button className="nav-item nav-item--disabled" type="button" disabled title="Settings is planned for a later stage"><Settings2 size={18} strokeWidth={1.8} /><span>Settings</span><span className="nav-soon">Soon</span></button>
        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <div className="sidebar-status__top"><span className="sidebar-status__label">Development API</span><StatusDot label={connected ? 'Live' : 'Offline'} state={connected ? 'success' : 'error'} /></div>
          <p>Connection status reflects the running Schedaro API.</p>
        </div>
        <div className="sidebar-footer"><span className="avatar">S</span><div><strong>Schedaro workspace</strong><span>Local development</span></div></div>
      </div>
    </aside>
  </>
}
