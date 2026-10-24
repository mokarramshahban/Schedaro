import { describe, expect, it } from 'vitest'
import { defaultPrintLayout, clampElement, clampSignature, resolveField } from './printLayout'

const context = {
  institution: { id: 'i', name: 'College A', institutionType: 'College', address: 'Campus', active: true },
  department: { id: 'd', institutionId: 'i', name: 'Computer Science', active: true },
  semester: { id: 's', departmentId: 'd', number: 1, label: 'Semester 1', active: true },
  group: { id: 'g', departmentId: 'd', semesterId: 's', academicTermId: 't', sectionName: 'Section A', label: 'Section A', active: true },
  term: { id: 't', institutionId: 'i', academicYear: '2026', term: 'Spring', active: true },
}

describe('print layout model', () => {
  it('starts with a clean dynamic header and three signatures', () => {
    const layout = defaultPrintLayout()
    expect(layout.headerElements.some((item) => item.field === 'institution_name')).toBe(true)
    expect(layout.footerElements).toHaveLength(3)
  })

  it('resolves dynamic fields from current print context', () => {
    expect(resolveField('institution_name', context)).toBe('College A')
    expect(resolveField('semester_section', context)).toBe('Semester 1 — Section A')
    expect(resolveField('academic_term', context)).toBe('2026 · Spring')
  })

  it('keeps header and footer elements inside normalized regions', () => {
    expect(clampElement({ ...defaultPrintLayout().headerElements[0], x: 95, y: 95 })).toMatchObject({ x: 10, y: 82 })
    expect(clampSignature({ ...defaultPrintLayout().footerElements[0], x: 99, y: 99 })).toMatchObject({ x: 73, y: 35 })
  })
})
