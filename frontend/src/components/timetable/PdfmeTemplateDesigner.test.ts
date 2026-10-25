import { describe, expect, it } from 'vitest'
import { generate } from '@pdfme/generator'
import { image, line, rectangle, text } from '@pdfme/schemas'
import { createPdfmeTemplate } from './PdfmeTemplateDesigner'
import type { TimetableSession } from '../../lib/timetable'

const context = {
  institution: { id: 'i', name: 'College A', institutionType: 'College', address: 'Campus', active: true },
  department: { id: 'd', institutionId: 'i', name: 'Computer Science', active: true },
  semester: { id: 's', departmentId: 'd', number: 1, label: 'Semester 1', active: true },
  group: { id: 'g', departmentId: 'd', semesterId: 's', academicTermId: 't', sectionName: 'A', label: 'A', active: true },
  term: { id: 't', institutionId: 'i', academicYear: '2026', term: 'Spring', active: true },
  resources: { subjects: [], teachers: [], rooms: [] },
  sessions: [],
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as TimetableSession['day'][],
}

describe('pdfme timetable template POC', () => {
  it('creates A4 landscape templates with dynamic fields and seven signatures', () => {
    const result = createPdfmeTemplate(context, 7)
    expect(result.template.basePdf).toMatchObject({ width: 297, height: 210 })
    expect(result.template.schemas[0].filter((item) => item.name.startsWith('signature_label_'))).toHaveLength(7)
    expect(result.inputs.institution_name).toBe('College A')
  })

  it('generates a real PDF from the POC template', async () => {
    const result = createPdfmeTemplate(context, 3)
    const pdf = await generate({ template: result.template, inputs: [result.inputs], plugins: { text, image, line, rectangle } })
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(1000)
  })
})
