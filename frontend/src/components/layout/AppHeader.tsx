import { Bell, Menu, Search, Sparkles } from 'lucide-react'
import { StatusDot } from '../ui/StatusDot'
import { ActiveInstitutionSelector } from './ActiveInstitutionSelector'
import type { RoleAssignment, RoleContext } from '../../lib/platformApi'

type AppHeaderProps = { onMenuOpen: () => void; onOpenInstitutionSettings: () => void; connected: boolean; loading: boolean; onRefresh: () => void; pageTitle: string; platformOwner?: boolean; onLogout?: () => void; roleAssignments?: RoleAssignment[]; roleContext?: RoleContext; onRoleChange?: (assignmentId: string) => void }

export function AppHeader({ onMenuOpen, onOpenInstitutionSettings, connected, loading, onRefresh, pageTitle, platformOwner, onLogout, roleAssignments = [], roleContext, onRoleChange }: AppHeaderProps) {
  return <header className="app-header">
    <div className="header-context">
      <button className="mobile-menu-button" type="button" onClick={onMenuOpen} aria-label="Open navigation"><Menu size={21} /></button>
      <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{pageTitle}</strong></div>
    </div>
    <ActiveInstitutionSelector onOpenSettings={onOpenInstitutionSettings} platformOwner={platformOwner} />
    {roleAssignments.length > 0 && <label className="acting-role-selector"><span>Acting as</span><select aria-label="Acting as role" value={roleContext?.assignment_id || ''} onChange={(event) => onRoleChange?.(event.target.value)}><option value="">Select role…</option>{roleAssignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.role.replace(/_/g, ' ')} · {assignment.scope_type}{assignment.scope_id ? ` · ${assignment.scope_id.slice(0, 8)}` : ''}</option>)}</select></label>}
    <div className="header-actions">
      <label className="search-box"><Search size={17} aria-hidden="true" /><input aria-label="Search" placeholder="Search workspace" /></label>
      <button className="header-icon-button" type="button" aria-label="Notifications"><Bell size={18} /><i className="notification-dot" /></button>
      <button className="header-status" type="button" onClick={onRefresh} title="Refresh API status"><StatusDot label={loading ? 'Checking' : connected ? 'API live' : 'API offline'} state={loading ? 'pending' : connected ? 'success' : 'error'} /></button>
      <div className="header-divider" />
      <div className="header-profile"><span className="avatar avatar--header">S</span><div><strong>{platformOwner ? 'Platform Owner' : 'Schedaro'}</strong><span>{platformOwner ? 'Secure workspace' : 'Development'}</span></div><Sparkles size={15} className="profile-spark" />{onLogout && <button type="button" className="header-logout" onClick={onLogout}>Log out</button>}</div>
    </div>
  </header>
}
