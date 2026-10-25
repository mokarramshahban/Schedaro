import type { AcademicTerm, ClassGroup, Department, Institution, Semester } from './api'

export type LayoutField = 'institution_name' | 'institution_type' | 'address' | 'department_name' | 'timetable_title' | 'semester_section' | 'academic_term'
export type LayoutElementKind = 'dynamic' | 'custom' | 'logo' | 'divider'
export type TextAlign = 'left' | 'center' | 'right'
export type PrintElement = { id: string; kind: LayoutElementKind; field?: LayoutField; text?: string; x: number; y: number; width: number; height: number; align: TextAlign; fontSize: number; bold: boolean; visible: boolean }
export type SignatureElement = { id: string; label: string; secondaryText?: string; x: number; y: number; width: number; height: number; align: TextAlign; showLine: boolean }
export type PrintLayout = { headerElements: PrintElement[]; footerElements: SignatureElement[]; logoDataUrl?: string | null; id?: string; institutionId?: string; version?: number; updatedAt?: string }
export type PdfmeTemplateRecord = { id: string; institutionId: string; name: string; template: Record<string, unknown>; version: number; active: boolean; isDefault: boolean; createdAt: string; updatedAt: string }

export function defaultPrintLayout(): PrintLayout {
  return {
    headerElements: [
      { id: 'institution', kind: 'dynamic', field: 'institution_name', x: 5, y: 4, width: 90, height: 18, align: 'center', fontSize: 20, bold: true, visible: true },
      { id: 'department', kind: 'dynamic', field: 'department_name', x: 5, y: 28, width: 90, height: 12, align: 'center', fontSize: 10, bold: true, visible: true },
      { id: 'title', kind: 'dynamic', field: 'timetable_title', x: 5, y: 43, width: 90, height: 12, align: 'center', fontSize: 11, bold: true, visible: true },
      { id: 'scope', kind: 'dynamic', field: 'semester_section', x: 5, y: 58, width: 45, height: 10, align: 'left', fontSize: 8, bold: false, visible: true },
      { id: 'term', kind: 'dynamic', field: 'academic_term', x: 50, y: 58, width: 45, height: 10, align: 'right', fontSize: 8, bold: false, visible: true },
      { id: 'divider', kind: 'divider', x: 5, y: 77, width: 90, height: 2, align: 'left', fontSize: 8, bold: false, visible: true },
    ],
    footerElements: [
      { id: 'signature-1', label: 'Prepared By', x: 5, y: 20, width: 27, height: 65, align: 'center', showLine: true },
      { id: 'signature-2', label: 'Head of Department', x: 36.5, y: 20, width: 27, height: 65, align: 'center', showLine: true },
      { id: 'signature-3', label: 'Dean', x: 68, y: 20, width: 27, height: 65, align: 'center', showLine: true },
    ],
    logoDataUrl: null,
  }
}

export function resolveField(field: LayoutField, context: { institution: Institution; department: Department; semester: Semester; group: ClassGroup; term?: AcademicTerm }): string {
  const { institution, department, semester, group, term } = context
  if (field === 'institution_name') return institution.name
  if (field === 'institution_type') return institution.institutionType || 'Academic institution'
  if (field === 'address') return institution.address || ''
  if (field === 'department_name') return department.name
  if (field === 'timetable_title') return 'Weekly Academic Timetable'
  if (field === 'semester_section') return `${semester.label} — ${group.sectionName}`
  return term ? `${term.academicYear} · ${term.term}` : 'Academic term not configured'
}

export function clampElement(element: PrintElement): PrintElement {
  const width = Math.min(Math.max(element.width, 1), 100)
  const height = Math.min(Math.max(element.height, 1), 100)
  return { ...element, width, height, x: Math.min(Math.max(element.x, 0), 100 - width), y: Math.min(Math.max(element.y, 0), 100 - height) }
}

export function clampSignature(element: SignatureElement): SignatureElement {
  const width = Math.min(Math.max(element.width, 1), 100)
  const height = Math.min(Math.max(element.height, 1), 100)
  return { ...element, width, height, x: Math.min(Math.max(element.x, 0), 100 - width), y: Math.min(Math.max(element.y, 0), 100 - height) }
}
