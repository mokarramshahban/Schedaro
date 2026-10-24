import { Bell, Menu, Search, Sparkles } from 'lucide-react'
import { StatusDot } from '../ui/StatusDot'
import { ActiveInstitutionSelector } from './ActiveInstitutionSelector'

type AppHeaderProps = { onMenuOpen: () => void; onOpenInstitutionSettings: () => void; connected: boolean; loading: boolean; onRefresh: () => void; pageTitle: string }

export function AppHeader({ onMenuOpen, onOpenInstitutionSettings, connected, loading, onRefresh, pageTitle }: AppHeaderProps) {
  return <header className="app-header">
    <div className="header-context">
      <button className="mobile-menu-button" type="button" onClick={onMenuOpen} aria-label="Open navigation"><Menu size={21} /></button>
      <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{pageTitle}</strong></div>
    </div>
    <ActiveInstitutionSelector onOpenSettings={onOpenInstitutionSettings} />
    <div className="header-actions">
      <label className="search-box"><Search size={17} aria-hidden="true" /><input aria-label="Search" placeholder="Search workspace" /></label>
      <button className="header-icon-button" type="button" aria-label="Notifications"><Bell size={18} /><i className="notification-dot" /></button>
      <button className="header-status" type="button" onClick={onRefresh} title="Refresh API status"><StatusDot label={loading ? 'Checking' : connected ? 'API live' : 'API offline'} state={loading ? 'pending' : connected ? 'success' : 'error'} /></button>
      <div className="header-divider" />
      <div className="header-profile"><span className="avatar avatar--header">S</span><div><strong>Schedaro</strong><span>Development</span></div><Sparkles size={15} className="profile-spark" /></div>
    </div>
  </header>
}
