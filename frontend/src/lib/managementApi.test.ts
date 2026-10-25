import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSubject, updateRoom, updateWorkingWeek } from './managementApi'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => fetchMock.mockReset())

describe('management API client', () => {
  it('creates a subject with a real snake_case payload', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'subject-new', institution_id: 'inst-1', department_id: 'dept-1', code: 'CSE999', name: 'Distributed Systems', active: true }), { status: 201 }))
    await expect(createSubject('inst-1', { departmentId: 'dept-1', code: 'CSE999', name: 'Distributed Systems', active: true })).resolves.toMatchObject({ id: 'subject-new', code: 'CSE999' })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/academic/institutions/inst-1/subjects'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ department_id: 'dept-1', code: 'CSE999', name: 'Distributed Systems', active: true }) }))
  })

  it('updates room lifecycle through the API', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'room-1', institution_id: 'inst-1', code: 'ROOM-1', name: 'Main Room', room_type: 'classroom', active: false }), { status: 200 }))
    await expect(updateRoom('room-1', { active: false })).resolves.toMatchObject({ id: 'room-1', active: false })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/academic/rooms/room-1'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ active: false }) }))
  })

  it('persists the authoritative institution working week', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ institution_id: 'inst-1', working_week: 'monday-friday', working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], saturday_exception_count: 0, warning: null }), { status: 200 }))
    await expect(updateWorkingWeek('inst-1', 'monday-friday')).resolves.toMatchObject({ institutionId: 'inst-1', workingWeek: 'monday-friday', workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/academic/institutions/inst-1/working-week'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ working_week: 'monday-friday' }) }))
  })
})
