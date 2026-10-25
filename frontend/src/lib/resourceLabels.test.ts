import { describe, expect, it } from 'vitest'
import { subjectDisplayLabel } from './resourceLabels'

describe('subject display labels', () => {
  it('renders a subject code once when the API name already contains it', () => {
    expect(subjectDisplayLabel({ code: 'CSE101', name: 'CSE101 · Algorithms and Data Structures' })).toBe('CSE101 · Algorithms and Data Structures')
  })

  it('adds the code once when the API name is only the subject name', () => {
    expect(subjectDisplayLabel({ code: 'CSE101', name: 'Algorithms and Data Structures' })).toBe('CSE101 · Algorithms and Data Structures')
  })
})
