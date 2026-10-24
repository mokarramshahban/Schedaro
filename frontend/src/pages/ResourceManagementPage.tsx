import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Building2, Check, Edit3, GraduationCap, Plus, Search, UsersRound, DoorOpen, BookOpen, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card'
import { ApiError, getDepartments, getSemesters, getTerms, type AcademicTerm, type ClassGroup, type Department, type Institution, type Room, type Semester, type Subject, type Teacher } from '../lib/api'
import { useInstitution } from '../lib/InstitutionContext'
import { createClassGroup, createDepartment, createInstitution, createRoom, createSemester, createSubject, createTeacher, createTerm, listManagementGroups, listRooms, listSubjects, listTeachers, updateClassGroup, updateDepartment, updateInstitution, updateRoom, updateSemester, updateSubject, updateTeacher, updateTerm, type ClassGroupPayload, type DepartmentPayload, type InstitutionPayload, type RoomPayload, type SemesterPayload, type SubjectPayload, type TeacherPayload, type TermPayload } from '../lib/managementApi'

type ManagementMode = 'subjects' | 'teachers' | 'rooms' | 'classes' | 'settings'
type Props = { mode: ManagementMode; connected: boolean }
type FormKind = 'subject' | 'teacher' | 'room' | 'department' | 'semester' | 'group' | 'term' | 'institution'

type FormState = Record<string, string | number | boolean | undefined>
const emptyForm: FormState = {}

const modeMeta: Record<ManagementMode, { title: string; description: string; icon: typeof BookOpen }> = {
  subjects: { title: 'Subjects', description: 'Manage the courses available to your academic timetable.', icon: BookOpen },
  teachers: { title: 'Teachers', description: 'Keep faculty records current without breaking timetable assignments.', icon: UsersRound },
  rooms: { title: 'Rooms & labs', description: 'Manage the institution spaces used by scheduled sessions.', icon: DoorOpen },
  classes: { title: 'Classes', description: 'Configure departments, semesters, terms and sections.', icon: GraduationCap },
  settings: { title: 'Institution settings', description: 'Maintain the institution identity used by future timetable outputs.', icon: Building2 },
}

function errorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    const detail = reason.detail as { message?: string } | null
    return detail?.message ?? reason.message
  }
  return reason instanceof Error ? reason.message : 'The request could not be completed.'
}

export function ResourceManagementPage({ mode, connected }: Props) {
  const { institutions, activeInstitutionId, activeInstitution, loading: institutionLoading, error: institutionError, refreshInstitutions } = useInstitution()
  const institutionId = activeInstitutionId
  const [departments, setDepartments] = useState<Department[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [groups, setGroups] = useState<ClassGroup[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [search, setSearch] = useState('')
  const [classTab, setClassTab] = useState<'departments' | 'semesters' | 'sections' | 'terms'>('departments')
  const [loading, setLoading] = useState(true)
  const [loadedInstitutionId, setLoadedInstitutionId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState<{ kind: FormKind; id?: string; values: FormState } | null>(null)
  const meta = modeMeta[mode]

  useEffect(() => {
    if (institutionError) setError(institutionError)
  }, [institutionError])
  useEffect(() => {
    setDepartments([]); setSemesters([]); setTerms([]); setGroups([]); setSubjects([]); setTeachers([]); setRooms([]); setDepartmentId(''); setLoadedInstitutionId('')
    if (!institutionId) return
    const controller = new AbortController()
    void getDepartments(institutionId, controller.signal).then((values) => { setDepartments(values); setDepartmentId((current) => current && values.some((item) => item.id === current) ? current : values[0]?.id ?? '') }).catch((reason) => { if ((reason as Error).name !== 'AbortError') setError(errorMessage(reason)) })
    return () => controller.abort()
  }, [institutionId])
  useEffect(() => {
    if (!departmentId) { setSemesters([]); return }
    const controller = new AbortController()
    void getSemesters(departmentId, controller.signal).then(setSemesters).catch((reason) => { if ((reason as Error).name !== 'AbortError') setError(errorMessage(reason)) })
    return () => controller.abort()
  }, [departmentId])

  const refresh = useCallback(async () => {
    if (mode === 'settings' || !institutionId) { setLoading(false); return }
    setLoading(true); setError(null)
    const scopedDepartmentId = departments.some((department) => department.id === departmentId && department.institutionId === institutionId) ? departmentId : undefined
    try {
      if (mode === 'subjects') setSubjects(await listSubjects(institutionId, { departmentId: scopedDepartmentId, search }))
      if (mode === 'teachers') setTeachers(await listTeachers(institutionId, { departmentId: scopedDepartmentId, search }))
      if (mode === 'rooms') setRooms(await listRooms(institutionId, { search }))
      if (mode === 'classes') {
        setTerms(await getTerms(institutionId))
        setGroups(await listManagementGroups(institutionId, scopedDepartmentId))
        if (scopedDepartmentId) setSemesters(await getSemesters(scopedDepartmentId))
      }
      setLoadedInstitutionId(institutionId)
    } catch (reason) { setError(errorMessage(reason)) } finally { setLoading(false) }
  }, [departmentId, departments, institutionId, mode, search])

  useEffect(() => { void refresh() }, [refresh])

  function openForm(kind: FormKind, values: FormState = {}, id?: string) { setNotice(null); setError(null); setForm({ kind, id, values }) }
  function updateField(key: string, value: string | number | boolean) { setForm((current) => current ? { ...current, values: { ...current.values, [key]: value } } : current) }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!form) return
    setSaving(true); setError(null)
    try {
      const v = form.values
      if (form.kind === 'subject') { const payload: SubjectPayload = { code: String(v.code ?? ''), name: String(v.name ?? ''), description: String(v.description ?? ''), departmentId: String(v.departmentId || '') || undefined, semesterId: String(v.semesterId || '') || undefined, active: Boolean(v.active) }; form.id ? await updateSubject(form.id, payload) : await createSubject(institutionId, payload) }
      if (form.kind === 'teacher') { const payload: TeacherPayload = { name: String(v.name ?? ''), code: String(v.code ?? ''), email: String(v.email ?? ''), departmentId: String(v.departmentId || '') || undefined, active: Boolean(v.active) }; form.id ? await updateTeacher(form.id, payload) : await createTeacher(institutionId, payload) }
      if (form.kind === 'room') { const payload: RoomPayload = { code: String(v.code ?? ''), name: String(v.name ?? ''), building: String(v.building ?? ''), capacity: v.capacity ? Number(v.capacity) : undefined, roomType: String(v.roomType ?? 'classroom'), active: Boolean(v.active) }; form.id ? await updateRoom(form.id, payload) : await createRoom(institutionId, payload) }
      if (form.kind === 'department') { const payload: DepartmentPayload = { name: String(v.name ?? ''), code: String(v.code ?? ''), active: Boolean(v.active) }; form.id ? await updateDepartment(form.id, payload) : await createDepartment(institutionId, payload) }
      if (form.kind === 'semester') { const payload: SemesterPayload = { number: Number(v.number), label: String(v.label ?? ''), active: Boolean(v.active) }; form.id ? await updateSemester(form.id, payload) : await createSemester(departmentId, payload) }
      if (form.kind === 'term') { const payload: TermPayload = { academicYear: String(v.academicYear ?? ''), term: String(v.term ?? ''), startDate: String(v.startDate ?? '') || undefined, endDate: String(v.endDate ?? '') || undefined, active: Boolean(v.active) }; form.id ? await updateTerm(form.id, payload) : await createTerm(institutionId, payload) }
      if (form.kind === 'group') { const payload: ClassGroupPayload = { departmentId: String(v.departmentId ?? departmentId), academicTermId: String(v.academicTermId ?? ''), sectionName: String(v.sectionName ?? ''), active: Boolean(v.active) }; form.id ? await updateClassGroup(form.id, { ...payload, semesterId: String(v.semesterId ?? '') }) : await createClassGroup(String(v.semesterId ?? ''), payload) }
      if (form.kind === 'institution') { const payload: InstitutionPayload = { name: String(v.name ?? ''), shortName: String(v.shortName ?? ''), institutionType: String(v.institutionType ?? ''), address: String(v.address ?? ''), active: Boolean(v.active) }; form.id ? await updateInstitution(form.id, payload) : await createInstitution(payload) }
      setForm(null); setNotice('Saved to PostgreSQL.'); await refresh(); await refreshInstitutions()
    } catch (reason) { setError(errorMessage(reason)) } finally { setSaving(false) }
  }

  function openDefaultForm() {
    if (mode === 'subjects') openForm('subject', { active: true, departmentId, semesterId: semesters[0]?.id ?? '' })
    else if (mode === 'teachers') openForm('teacher', { active: true, departmentId })
    else if (mode === 'rooms') openForm('room', { active: true, roomType: 'classroom' })
    else if (mode === 'settings') openForm('institution', { active: true })
    else if (classTab === 'departments') openForm('department', { active: true })
    else if (classTab === 'semesters') openForm('semester', { active: true, number: semesters.length + 1, label: `Semester ${semesters.length + 1}` })
    else if (classTab === 'terms') openForm('term', { active: true, academicYear: new Date().getFullYear().toString() })
    else openForm('group', { active: true, departmentId, semesterId: semesters[0]?.id ?? '', academicTermId: terms[0]?.id ?? '', sectionName: 'Section A' })
  }
  const filteredDepartments = useMemo(() => departments.filter((item) => `${item.code ?? ''} ${item.name}`.toLowerCase().includes(search.toLowerCase())), [departments, search])
  const filteredSubjects = subjects.filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(search.toLowerCase()))
  const filteredTeachers = teachers.filter((item) => `${item.code ?? ''} ${item.name} ${item.email ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const filteredRooms = rooms.filter((item) => `${item.code} ${item.name} ${item.building ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const title = meta.title
  const Icon = meta.icon
  const actionLabel = mode === 'subjects' ? 'Add Subject' : mode === 'teachers' ? 'Add Teacher' : mode === 'rooms' ? 'Add Room' : mode === 'settings' ? 'Add Institution' : classTab === 'departments' ? 'Add Department' : classTab === 'semesters' ? 'Add Semester' : classTab === 'sections' ? 'Add Section' : 'Add Academic Term'
  const pageDescription = mode === 'settings' ? 'View and maintain the institutions available to this Schedaro installation.' : `${meta.description}${activeInstitution ? ` Currently managing records at ${activeInstitution.name}${activeInstitution.shortName ? ` (${activeInstitution.shortName})` : ''}.` : ' Choose an active institution to continue.'}`
  const institutionContext = mode === 'settings' ? 'Institution directory' : activeInstitution ? `${activeInstitution.name}${activeInstitution.shortName ? ` · ${activeInstitution.shortName}` : ''}` : 'No active institution selected'
  const showScopedData = mode === 'settings' || loadedInstitutionId === institutionId
  const pageLoading = loading || institutionLoading || (mode !== 'settings' && !showScopedData)

  return <div className="page-content management-page">
    <div className="page-heading"><div><p className="eyebrow">Workspace / {title}</p><h1>{title}</h1><p className="page-description">{pageDescription}</p></div><Button onClick={openDefaultForm} disabled={!activeInstitutionId && mode !== 'settings'}><Plus size={17} />{actionLabel}</Button></div>
    <div className="institution-context-banner"><Building2 size={17} /><div><span>Managing institution</span><strong>{institutionContext}</strong></div>{mode !== 'settings' && <small>All records on this page are scoped to the active institution.</small>}</div>
    <div className="status-banner management-status"><div className="status-banner__icon"><Icon size={18} /></div><div><strong>{connected ? 'PostgreSQL-backed management' : 'API connection unavailable'}</strong><p>{notice ?? 'Changes are validated and persisted through the Schedaro API.'}</p></div><span className={connected ? 'status-chip status-chip--success' : 'status-chip status-chip--error'}><i />{connected ? 'API connected' : 'API unavailable'}</span></div>
    {error && <div className="form-errors management-error" role="alert"><strong>Request failed</strong><p>{error}</p><Button size="sm" variant="secondary" type="button" onClick={() => void refresh()}>Retry</Button></div>}
    <Card className="management-card"><CardHeader><div><p className="section-kicker">Records</p><CardTitle>{mode === 'settings' ? 'Institutions' : mode === 'classes' ? 'Academic structure' : `Saved ${title.toLowerCase()}`}</CardTitle></div><div className="management-filters"><label className="management-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" aria-label="Search records" /></label>{mode !== 'settings' && mode !== 'classes' && <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} aria-label="Filter department"><option value="">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div></CardHeader><CardBody>{pageLoading ? <div className="management-empty">Loading records…</div> : mode === 'subjects' ? <SubjectList rows={filteredSubjects} departments={departments} semesters={semesters} onEdit={(row) => openForm('subject', rowToForm(row), row.id)} /> : mode === 'teachers' ? <TeacherList rows={filteredTeachers} departments={departments} onEdit={(row) => openForm('teacher', rowToForm(row), row.id)} /> : mode === 'rooms' ? <RoomList rows={filteredRooms} onEdit={(row) => openForm('room', rowToForm(row), row.id)} /> : mode === 'classes' ? <ClassStructure departments={filteredDepartments} semesters={semesters} terms={terms} groups={groups} selectedDepartment={departmentId} onDepartmentChange={setDepartmentId} tab={classTab} setTab={setClassTab} onEdit={openForm} onAdd={openDefaultForm} /> : <InstitutionList rows={institutions.filter((item) => `${item.name} ${item.shortName ?? ''}`.toLowerCase().includes(search.toLowerCase()))} onEdit={(row) => openForm('institution', rowToForm(row), row.id)} />}</CardBody></Card>
    {form && <ManagementDialog form={form} institution={activeInstitution} departments={departments} semesters={semesters} terms={terms} saving={saving} onChange={updateField} onCancel={() => setForm(null)} onSubmit={submit} />}
  </div>
}


function rowToForm(row: any): FormState {
  const values: FormState = { ...row }
  Object.keys(values).forEach((key) => { if (key.endsWith('Id')) values[key] = values[key] ?? '' })
  return values
}

function SubjectList({ rows, departments, semesters, onEdit }: { rows: Subject[]; departments: Department[]; semesters: Semester[]; onEdit: (row: Subject) => void }) { return <RecordTable headers={['Code', 'Subject', 'Department', 'Semester', 'Status', '']} rows={rows.map((row) => [row.code, row.name, departments.find((item) => item.id === row.departmentId)?.name ?? 'Institution-wide', semesters.find((item) => item.id === row.semesterId)?.label ?? 'All semesters', <StatusPill active={row.active} />, <EditButton onClick={() => onEdit(row)} />])} empty="No subjects match this scope." /> }
function TeacherList({ rows, departments, onEdit }: { rows: Teacher[]; departments: Department[]; onEdit: (row: Teacher) => void }) { return <RecordTable headers={['Teacher', 'Code', 'Department', 'Email', 'Status', '']} rows={rows.map((row) => [row.name, row.code || '—', departments.find((item) => item.id === row.departmentId)?.name ?? 'Institution-wide', row.email || '—', <StatusPill active={row.active} />, <EditButton onClick={() => onEdit(row)} />])} empty="No teachers match this scope." /> }
function RoomList({ rows, onEdit }: { rows: Room[]; onEdit: (row: Room) => void }) { return <RecordTable headers={['Code', 'Room', 'Building', 'Type', 'Capacity', 'Status', '']} rows={rows.map((row) => [row.code, row.name, row.building || '—', row.roomType, row.capacity ?? '—', <StatusPill active={row.active} />, <EditButton onClick={() => onEdit(row)} />])} empty="No rooms match this scope." /> }
function InstitutionList({ rows, onEdit }: { rows: Institution[]; onEdit: (row: Institution) => void }) { return <RecordTable headers={['Institution', 'Short name', 'Type', 'Address', 'Status', '']} rows={rows.map((row) => [row.name, row.shortName || '—', row.institutionType || '—', row.address || '—', <StatusPill active={row.active} />, <EditButton onClick={() => onEdit(row)} />])} empty="No institutions configured." /> }
function StatusPill({ active }: { active: boolean }) { return <span className={active ? 'record-status record-status--active' : 'record-status'}><i />{active ? 'Active' : 'Inactive'}</span> }
function EditButton({ onClick }: { onClick: () => void }) { return <button type="button" className="table-edit-button" onClick={onClick}><Edit3 size={14} />Edit</button> }
function RecordTable({ headers, rows, empty }: { headers: string[]; rows: Array<Array<React.ReactNode>>; empty: string }) { return rows.length ? <div className="management-table-wrap"><table className="management-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : <div className="management-empty"><Check size={18} /><strong>{empty}</strong><span>Use Add new to create a record.</span></div> }

function ClassStructure({ departments, semesters, terms, groups, selectedDepartment, onDepartmentChange, tab, setTab, onEdit, onAdd }: any) {
  const tabs = [['departments', 'Departments'], ['semesters', 'Semesters'], ['sections', 'Sections'], ['terms', 'Academic terms']] as const
  return <div><div className="management-tabs">{tabs.map(([value, label]) => <button key={value} type="button" className={tab === value ? 'management-tab management-tab--active' : 'management-tab'} onClick={() => setTab(value)}>{label}</button>)}</div>{tab === 'departments' && <RecordTable headers={['Code', 'Department', 'Status', '']} rows={departments.map((row: Department) => [row.code || '—', row.name, <StatusPill active={row.active} />, <EditButton onClick={() => onEdit('department', rowToForm(row), row.id)} />])} empty="No departments configured." />}{tab === 'semesters' && <><label className="inline-filter"><span>Department</span><select value={selectedDepartment} onChange={(event) => onDepartmentChange(event.target.value)}><option value="">Select department</option>{departments.map((row: Department) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><RecordTable headers={['Number', 'Label', 'Status', '']} rows={semesters.filter((row: Semester) => !selectedDepartment || row.departmentId === selectedDepartment).map((row: Semester) => [row.number, row.label, <StatusPill active={row.active} />, <EditButton onClick={() => onEdit('semester', rowToForm(row), row.id)} />])} empty="No semesters configured." /></>}{tab === 'sections' && <RecordTable headers={['Section', 'Department', 'Term', 'Status', '']} rows={groups.map((row: ClassGroup) => [row.sectionName, departments.find((item: Department) => item.id === row.departmentId)?.name ?? '—', terms.find((item: AcademicTerm) => item.id === row.academicTermId)?.term ?? '—', <StatusPill active={row.active} />, <EditButton onClick={() => onEdit('group', rowToForm(row), row.id)} />])} empty="No sections configured." />}{tab === 'terms' && <RecordTable headers={['Academic year', 'Term', 'Dates', 'Status', '']} rows={terms.map((row: AcademicTerm) => [`${row.academicYear}`, row.term, `${row.startDate || '—'} → ${row.endDate || '—'}`, <StatusPill active={row.active} />, <EditButton onClick={() => onEdit('term', rowToForm(row), row.id)} />])} empty="No academic terms configured." />}</div>
}

function ManagementDialog({ form, institution, departments, semesters, terms, saving, onChange, onCancel, onSubmit }: { form: { kind: FormKind; id?: string; values: FormState }; institution?: Institution; departments: Department[]; semesters: Semester[]; terms: AcademicTerm[]; saving: boolean; onChange: (key: string, value: string | number | boolean) => void; onCancel: () => void; onSubmit: (event: FormEvent) => void }) {
  const labels: Record<FormKind, string> = { subject: 'Subject', teacher: 'Teacher', room: 'Room', department: 'Department', semester: 'Semester', group: 'Section', term: 'Academic term', institution: 'Institution' }
  const title = `${form.id ? 'Edit' : 'Add'} ${labels[form.kind]}`
  const field = (key: string, label: string, type = 'text', options?: Array<{ id: string; label: string }>, required = true) => options ? <label className="field"><span>{label}{!required && <em>Optional</em>}</span><select required={required} value={String(form.values[key] ?? '')} onChange={(event) => onChange(key, event.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label> : <label className="field"><span>{label}{!required && <em>Optional</em>}</span><input required={required} type={type} value={String(form.values[key] ?? '')} onChange={(event) => onChange(key, type === 'number' ? Number(event.target.value) : event.target.value)} /></label>
  const checkbox = (key: string, label: string) => <label className="checkbox-field"><input type="checkbox" checked={Boolean(form.values[key])} onChange={(event) => onChange(key, event.target.checked)} />{label}</label>
  return <div className="dialog-backdrop" role="presentation"><div className="dialog management-dialog" role="dialog" aria-modal="true"><div className="dialog__header"><div><p className="section-kicker">PostgreSQL record</p><h2>{title}</h2></div><button type="button" className="dialog-close" onClick={onCancel} aria-label="Close dialog"><X size={19} /></button></div>{form.kind !== 'institution' && <div className="dialog-institution-context"><Building2 size={17} /><div><span>Institution</span><strong>{institution?.name ?? 'Active institution'}</strong><small>This record will be stored under the selected institution.</small></div></div>}<form onSubmit={onSubmit}><div className="dialog-grid">{form.kind === 'institution' && <>{field('name', 'Institution name')}{field('shortName', 'Short name / code', 'text', undefined, false)}{field('institutionType', 'Institution type', 'text', undefined, false)}{field('address', 'Address', 'text', undefined, false)}</>}{form.kind === 'subject' && <>{field('code', 'Subject code')}{field('name', 'Subject name')}{field('departmentId', 'Department', 'text', departments.map((item) => ({ id: item.id, label: item.name })), false)}{field('semesterId', 'Applicable semester', 'text', semesters.map((item) => ({ id: item.id, label: item.label })), false)}<label className="field field--full"><span>Description</span><textarea rows={3} value={String(form.values.description ?? '')} onChange={(event) => onChange('description', event.target.value)} /></label></>}{form.kind === 'teacher' && <>{field('name', 'Display name')}{field('code', 'Faculty code', 'text', undefined, false)}{field('email', 'Professional email', 'email', undefined, false)}{field('departmentId', 'Department', 'text', departments.map((item) => ({ id: item.id, label: item.name })), false)}</>}{form.kind === 'room' && <>{field('code', 'Room code')}{field('name', 'Room name')}{field('building', 'Building / location', 'text', undefined, false)}{field('capacity', 'Capacity', 'number', undefined, false)}{field('roomType', 'Room type', 'text', [{ id: 'classroom', label: 'Lecture room' }, { id: 'laboratory', label: 'Laboratory' }, { id: 'tutorial', label: 'Tutorial room' }, { id: 'other', label: 'Other' }])}</>}{form.kind === 'department' && <>{field('code', 'Department code', 'text', undefined, false)}{field('name', 'Department name')}</>}{form.kind === 'semester' && <>{field('number', 'Semester number', 'number')}{field('label', 'Semester label')}</>}{form.kind === 'term' && <>{field('academicYear', 'Academic year')}{field('term', 'Term name')}{field('startDate', 'Start date', 'date', undefined, false)}{field('endDate', 'End date', 'date', undefined, false)}</>}{form.kind === 'group' && <>{field('sectionName', 'Section name')}{field('departmentId', 'Department', 'text', departments.map((item) => ({ id: item.id, label: item.name })))}{field('semesterId', 'Semester', 'text', semesters.map((item) => ({ id: item.id, label: item.label })))}{field('academicTermId', 'Academic term', 'text', terms.map((item) => ({ id: item.id, label: `${item.academicYear} · ${item.term}` })))}</>}{checkbox('active', 'Active record')}</div><div className="dialog__actions"><Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save record'}</Button></div></form></div></div>
}
