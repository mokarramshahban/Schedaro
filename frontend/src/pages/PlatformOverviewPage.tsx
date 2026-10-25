import { useEffect, useState } from 'react'
import { Building2, Database, ShieldCheck } from 'lucide-react'
import { Card, CardBody } from '../components/ui/Card'
import { apiUrl } from '../lib/api'

type InstitutionSummary = { id: string; name: string; short_name?: string | null; status: string; schema_version?: string | null; active: boolean; database_ready: boolean }
type Overview = { institution_count: number; active_institution_count: number; ready_institution_count: number; owner_count: number; institutions: InstitutionSummary[] }

export function PlatformOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { fetch(`${apiUrl}/api/v1/platform/overview`, { credentials: 'include' }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body?.detail?.message || 'Platform overview unavailable.'); return body as Overview }).then(setOverview).catch((reason) => setError(reason instanceof Error ? reason.message : 'Platform overview unavailable.')) }, [])
  return <div className="page-content platform-overview"><div><p className="eyebrow">Platform administration</p><h1>Schedaro Platform Overview</h1><p className="page-description">Central registry and database readiness for authorized institution workspaces.</p></div>{error && <div className="form-errors" role="alert">{error}</div>}{overview && <><div className="platform-summary-grid"><Card><CardBody><Building2 size={20} /><strong>{overview.institution_count}</strong><span>Registered institutions</span></CardBody></Card><Card><CardBody><ShieldCheck size={20} /><strong>{overview.active_institution_count}</strong><span>Active institutions</span></CardBody></Card><Card><CardBody><Database size={20} /><strong>{overview.ready_institution_count}</strong><span>Ready databases</span></CardBody></Card></div><Card><CardBody><div className="section-heading"><div><p className="section-kicker">Institution registry</p><h2>Authorized workspaces</h2></div><span className="muted-copy">{overview.owner_count} active Platform Owner account{overview.owner_count === 1 ? '' : 's'}</span></div><div className="platform-institution-list">{overview.institutions.map((institution) => <div className="platform-institution-row" key={institution.id}><div><strong>{institution.name}</strong><span>{institution.short_name || 'No short name'} · schema {institution.schema_version || 'unknown'}</span></div><span className={`status-pill ${institution.database_ready ? 'status-pill--success' : 'status-pill--warning'}`}>{institution.database_ready ? 'Database ready' : 'Unavailable'}</span></div>)}</div></CardBody></Card></>}</div>
}
