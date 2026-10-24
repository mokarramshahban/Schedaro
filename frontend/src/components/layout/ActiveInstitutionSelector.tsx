import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Plus, RefreshCw, Search } from 'lucide-react'
import { useInstitution } from '../../lib/InstitutionContext'
import type { Institution } from '../../lib/api'

type Props = { onOpenSettings: () => void }

export function institutionOptionLabel(institution: Institution) {
  return `${institution.name}${institution.shortName ? ` · ${institution.shortName}` : ''}`
}

export function filterInstitutionOptions(institutions: Institution[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return institutions
  return institutions.filter((institution) => institutionOptionLabel(institution).toLowerCase().includes(normalized))
}

export function institutionSelectorTriggerLabel(activeInstitution: Institution | undefined, loading: boolean, error: string | null) {
  return activeInstitution ? institutionOptionLabel(activeInstitution) : loading ? 'Loading institutions…' : error ? 'Institution unavailable' : 'Choose an institution'
}

export function ActiveInstitutionSelector({ onOpenSettings }: Props) {
  const { activeInstitutions, activeInstitutionId, activeInstitution, loading, error, setActiveInstitutionId, refreshInstitutions } = useInstitution()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])

  function chooseInstitution(institutionId: string) {
    setActiveInstitutionId(institutionId); setOpen(false); setQuery(''); triggerRef.current?.focus()
  }

  const currentLabel = institutionSelectorTriggerLabel(activeInstitution, loading, error)
  const options = filterInstitutionOptions(activeInstitutions, query)
  return <section ref={rootRef} className="active-institution active-institution--header" aria-label="Active institution">
    <button ref={triggerRef} type="button" className="active-institution__trigger" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-label={activeInstitution ? `Active institution: ${currentLabel}` : currentLabel} disabled={loading}>
      <Building2 size={16} aria-hidden="true" /><span className="active-institution__trigger-text"><small>Active institution</small><strong title={currentLabel}>{currentLabel}</strong></span><ChevronDown className={`active-institution__trigger-chevron ${open ? 'active-institution__trigger-chevron--open' : ''}`} size={15} aria-hidden="true" />
    </button>
    {open && <div className="active-institution__menu" role="menu" aria-label="Choose active institution">
      {activeInstitutions.length > 5 && <label className="active-institution__search"><Search size={14} aria-hidden="true" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search institutions" aria-label="Search institutions" /></label>}
      {error ? <div className="active-institution__message" role="alert"><strong>Institutions could not be loaded.</strong><span>{error}</span><button type="button" onClick={() => void refreshInstitutions()}><RefreshCw size={13} />Retry</button></div> : activeInstitutions.length === 0 ? <div className="active-institution__message"><strong>No active institution</strong><span>Create an institution to start managing academic data.</span></div> : options.length === 0 ? <div className="active-institution__message"><span>No institutions match “{query}”.</span></div> : <div className="active-institution__options">{options.map((institution) => <button key={institution.id} type="button" role="menuitemradio" aria-checked={institution.id === activeInstitutionId} className={`active-institution__option ${institution.id === activeInstitutionId ? 'active-institution__option--selected' : ''}`} onClick={() => chooseInstitution(institution.id)}><Building2 size={15} aria-hidden="true" /><span title={institutionOptionLabel(institution)}>{institutionOptionLabel(institution)}</span>{institution.id === activeInstitutionId && <Check size={15} aria-hidden="true" />}</button>)}</div>}
      <div className="active-institution__menu-divider" />
      <button type="button" role="menuitem" className="active-institution__manage" onClick={() => { setOpen(false); setQuery(''); onOpenSettings() }}><Plus size={15} />{activeInstitutions.length ? 'Add or manage institutions' : 'Create institution'}</button>
    </div>}
  </section>
}
