import { describe, expect, it } from 'vitest'
import { generate } from '@pdfme/generator'
import { image, line, rectangle, text } from '@pdfme/schemas'
import { createPdfmeTemplate, hydratePdfmeInputs, materializePdfmeTemplate, persistableTemplate } from './PdfmeTemplateDesigner'
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

  it('persists editable inputs while replacing protected timetable data for the active context', () => {
    const saved = createPdfmeTemplate(context, 1)
    const editable = { ...saved.template, schemas: [[...(saved.template.schemas[0] as any[]), { name: 'custom_text_1', type: 'text', position: { x: 20, y: 20 }, width: 80, height: 8 }]] }
    const persisted = persistableTemplate(editable, { ...saved.inputs, custom_text_1: 'Approved timetable', letterhead: 'data:image/png;base64,iVBORw0KGgo=' })
    const nextSession: TimetableSession = { id: 'new-session', classGroupId: 'g', day: 'monday', startTime: '09:00', endTime: '10:00', subjectId: 'subject', teacherId: 'teacher', roomId: 'room', type: 'Lecture' }
    const nextContext = { ...context, sessions: [nextSession], resources: { subjects: [{ id: 'subject', name: 'Algorithms', active: true }], teachers: [{ id: 'teacher', name: 'Dr. Rao', active: true }], rooms: [{ id: 'room', name: 'A-101', active: true }] } }
    const template = materializePdfmeTemplate({ ...editable, ...persisted } as typeof saved.template, nextContext)
    const inputs = hydratePdfmeInputs(template, nextContext, { letterhead: 'data:image/png;base64,iVBORw0KGgo=' }, { custom_text_1: 'Approved timetable' })
    expect(inputs[`session_${nextSession.id}`]).toContain('Algorithms')
    expect(inputs.custom_text_1).toBe('Approved timetable')
    expect(inputs.letterhead).toContain('data:image/png')
  })

  it('generates a real PDF from the POC template', async () => {
    const result = createPdfmeTemplate(context, 3)
    const pdf = await generate({ template: result.template, inputs: [result.inputs], plugins: { text, image, line, rectangle } })
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(1000)
  })
})
