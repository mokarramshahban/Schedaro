import { useState, type FormEvent } from 'react'
import { Building2, Check, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { createInstitution } from '../lib/managementApi'
import { useInstitution } from '../lib/InstitutionContext'

function message(reason: unknown) {
  const detail = reason && typeof reason === 'object' && 'detail' in reason ? (reason as { detail?: { message?: string } }).detail : null
  return detail?.message ?? (reason instanceof Error ? reason.message : 'Institution could not be created.')
}

export function InstitutionSetupPage() {
  const { refreshInstitutions, setActiveInstitutionId } = useInstitution()
  const [name, setName] = useState('')
  const [shortName, setShortName] = useState('')
  const [institutionType, setInstitutionType] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      const institution = await createInstitution({ name, shortName, institutionType, address, active: true })
      await refreshInstitutions(institution.id)
      setCreated(true)
    } catch (reason) { setError(message(reason)) } finally { setSaving(false) }
  }

  return <div className="page-content institution-setup-page"><div className="institution-setup-page__intro"><div className="institution-setup-page__icon"><Building2 size={24} /></div><p className="eyebrow">First-time setup</p><h1>Welcome to Schedaro</h1><p>Create your first institution to begin managing academic timetables. All departments, subjects, teachers, rooms and classes will be organized under this institution.</p></div><Card className="institution-setup-card"><CardBody>{created ? <div className="institution-setup-success"><Check size={22} /><h2>Institution created</h2><p>Your institution is now the active workspace. Continue by choosing a section from the navigation.</p></div> : <form onSubmit={submit}><div className="setup-form-grid"><label className="field"><span>Institution name</span><input required autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Example Engineering College" /></label><label className="field"><span>Short name or code <em>Optional</em></span><input value={shortName} onChange={(event) => setShortName(event.target.value)} placeholder="EEC" /></label><label className="field"><span>Institution type <em>Optional</em></span><input value={institutionType} onChange={(event) => setInstitutionType(event.target.value)} placeholder="College or university" /></label><label className="field"><span>Address <em>Optional</em></span><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Campus address" /></label></div>{error && <div className="form-errors" role="alert"><strong>Could not create institution</strong><p>{error}</p></div>}<div className="dialog__actions"><Button type="submit" disabled={saving}><Plus size={16} />{saving ? 'Creating…' : 'Create Institution'}</Button></div></form>}</CardBody></Card></div>
}
