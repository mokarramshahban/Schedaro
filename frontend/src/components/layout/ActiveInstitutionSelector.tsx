import { useEffect, useState } from 'react'
import { Building2, ChevronDown, Plus } from 'lucide-react'
import { useInstitution } from '../../lib/InstitutionContext'

type Props = { onOpenSettings: () => void }

export function ActiveInstitutionSelector({ onOpenSettings }: Props) {
  const { activeInstitutions, activeInstitutionId, activeInstitution, loading, error, setActiveInstitutionId } = useInstitution()
  const [searchValue, setSearchValue] = useState('')
  const label = activeInstitution?.name ?? 'Choose an institution'
  useEffect(() => { setSearchValue(activeInstitution ? `${activeInstitution.name}${activeInstitution.shortName ? ` · ${activeInstitution.shortName}` : ''}` : '') }, [activeInstitution])
  return <section className="active-institution active-institution--header" aria-label="Active institution">
    <div className="active-institution__heading"><Building2 size={15} /><span>Active institution</span></div>
    {loading ? <div className="active-institution__loading">Loading institutions…</div> : activeInstitutions.length > 0 ? <div className="active-institution__control">{activeInstitutions.length > 5 ? <><input list="active-institution-options" value={searchValue} onChange={(event) => { setSearchValue(event.target.value); const match = activeInstitutions.find((institution) => `${institution.name}${institution.shortName ? ` · ${institution.shortName}` : ''}` === event.target.value); if (match) setActiveInstitutionId(match.id) }} aria-label="Search and change active institution" placeholder="Search institutions…" /><datalist id="active-institution-options">{activeInstitutions.map((institution) => <option key={institution.id} value={`${institution.name}${institution.shortName ? ` · ${institution.shortName}` : ''}`} />)}</datalist></> : <><select value={activeInstitutionId} onChange={(event) => setActiveInstitutionId(event.target.value)} aria-label="Change active institution"><option value="">Choose an institution…</option>{activeInstitutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}{institution.shortName ? ` · ${institution.shortName}` : ''}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></>}</div> : <div className="active-institution__empty"><strong>{error ? 'Institution unavailable' : 'No active institution'}</strong><span>{error ?? 'Create an institution to begin.'}</span></div>}
    <p className="active-institution__current" title={label}>{activeInstitution ? <><strong>{label}</strong><span>{activeInstitution.shortName || 'Current workspace'}</span></> : <span>Select the institution that owns this data.</span>}</p>
    <button type="button" className="active-institution__action" onClick={onOpenSettings}><Plus size={13} />{activeInstitutions.length ? 'Add or manage institution' : 'Create institution'}</button>
  </section>
}
