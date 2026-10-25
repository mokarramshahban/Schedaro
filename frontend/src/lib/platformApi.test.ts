import { describe, expect, it } from 'vitest'
import { formatAssignmentScope, formatRole } from './platformApi'

describe('platform role labels', () => {
  it('uses readable role names', () => {
    expect(formatRole('college_administrator')).toBe('College Administrator')
    expect(formatRole('class_in_charge')).toBe('Class In-Charge')
  })

  it('prefers server-resolved academic scope labels', () => {
    expect(formatAssignmentScope({ id: 'a', user_id: 'u', institution_id: 'i', role: 'hod', scope_type: 'department', scope_id: 'd', scope_label: 'Computer Science and Engineering', status: 'active', granted_by: 'owner' })).toBe('Computer Science and Engineering')
    expect(formatAssignmentScope({ id: 'a', user_id: 'u', institution_id: 'i', role: 'faculty', scope_type: 'section', scope_id: 'section-id', status: 'active', granted_by: 'owner' })).toContain('section-id')
  })
})
