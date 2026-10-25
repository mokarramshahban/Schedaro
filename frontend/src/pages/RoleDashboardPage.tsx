import { useEffect, useState } from 'react'
import { Card, CardBody } from '../components/ui/Card'
import { useInstitution } from '../lib/InstitutionContext'
import { formatRole, getWorkflowDashboard, type WorkflowDashboard } from '../lib/platformApi'

export function RoleDashboardPage() {
  const { activeInstitutionId, activeInstitution } = useInstitution(); const [data, setData] = useState<WorkflowDashboard | null>(null); const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (activeInstitutionId) void getWorkflowDashboard(activeInstitutionId).then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : 'Dashboard data could not be loaded.')) }, [activeInstitutionId])
  return <div className="page-content"><div className="page-heading"><div><p className="eyebrow">{activeInstitution?.name || 'Institution'} operations</p><h1>{data?.role ? formatRole(data.role) : 'Academic dashboard'}</h1><p className="muted-copy">Authorized timetable workflow status from PostgreSQL records.</p></div></div>{error && <div className="form-errors" role="alert">{error}</div>}<div className="overview-grid"><Card><CardBody><p className="eyebrow">Authorized sections</p><strong className="overview-stat">{data?.authorized_class_group_ids.length ?? '—'}</strong></CardBody></Card><Card><CardBody><p className="eyebrow">Drafts</p><strong className="overview-stat">{data?.draft_count ?? '—'}</strong></CardBody></Card><Card><CardBody><p className="eyebrow">Submitted</p><strong className="overview-stat">{data?.submitted_count ?? '—'}</strong></CardBody></Card><Card><CardBody><p className="eyebrow">Published</p><strong className="overview-stat">{data?.published_count ?? '—'}</strong></CardBody></Card></div><Card><CardBody><h2>Workflow status</h2><p className="muted-copy">HOD and Class In-Charge assignments use the shared timetable editor. Approval and publication remain separate server-side actions.</p></CardBody></Card></div>
}
