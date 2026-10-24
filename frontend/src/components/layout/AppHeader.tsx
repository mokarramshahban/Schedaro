import { Bell, Menu, Search, Sparkles } from 'lucide-react'
import { StatusDot } from '../ui/StatusDot'

type AppHeaderProps = { onMenuOpen: () => void; connected: boolean; loading: boolean; onRefresh: () => void }

export function AppHeader({ onMenuOpen, connected, loading, onRefresh }: AppHeaderProps) {
  return <header className="app-header">
    <div className="header-context">
      <button className="mobile-menu-button" type="button" onClick={onMenuOpen} aria-label="Open navigation"><Menu size={21} /></button>
      <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>Timetable</strong></div>
    </div>
    <div className="header-actions">
      <label className="search-box"><Search size={17} aria-hidden="true" /><input aria-label="Search" placeholder="Search workspace" /></label>
      <button className="header-icon-button" type="button" aria-label="Notifications"><Bell size={18} /><i className="notification-dot" /></button>
      <button className="header-status" type="button" onClick={onRefresh} title="Refresh API status"><StatusDot label={loading ? 'Checking' : connected ? 'API live' : 'API offline'} state={loading ? 'pending' : connected ? 'success' : 'error'} /></button>
      <div className="header-divider" />
      <div className="header-profile"><span className="avatar avatar--header">S</span><div><strong>Schedaro</strong><span>Development</span></div><Sparkles size={15} className="profile-spark" /></div>
    </div>
  </header>
}
