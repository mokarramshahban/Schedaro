import { describe, expect, it } from 'vitest'
import { sessionCardContent, subjectDisplayLabel } from './resourceLabels'

describe('subject display labels', () => {
  it('renders a subject code once when the API name already contains it', () => {
    expect(subjectDisplayLabel({ code: 'CSE101', name: 'CSE101 · Algorithms and Data Structures' })).toBe('CSE101 · Algorithms and Data Structures')
    expect(subjectDisplayLabel({ code: 'CSE101', name: 'CSE101 · CSE101 · Algorithms and Data Structures' })).toBe('CSE101 · Algorithms and Data Structures')
  })

  it('adds the code once when the API name is only the subject name', () => {
    expect(subjectDisplayLabel({ code: 'CSE101', name: 'Algorithms and Data Structures' })).toBe('CSE101 · Algorithms and Data Structures')
  })

  it.each(['Lecture', 'Tutorial', 'Laboratory', 'Practical', 'Seminar'])('keeps the subject first for %s cards at every supported size', (type) => {
    expect(sessionCardContent('CSE101 · Algorithms and Data Structures', '09:00–09:40', type, 'Instructor · ROOM-1', 24)[0]).toContain('CSE101')
    expect(sessionCardContent('CSE101 · Algorithms and Data Structures', '09:00–09:40', type, 'Instructor · ROOM-1', 56)).toEqual(['CSE101 · Algorithms and Data Structures', '09:00–09:40'])
    expect(sessionCardContent('CSE101 · Algorithms and Data Structures', '09:00–09:40', type, 'Instructor · ROOM-1', 120)).toEqual(['CSE101 · Algorithms and Data Structures', '09:00–09:40', type, 'Instructor · ROOM-1'])
  })
})
