import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getDepartments, getSessions } from './api'

const fetchMock = vi.fn()

vi.stubGlobal('fetch', fetchMock)
afterEach(() => fetchMock.mockReset())

describe('typed API client', () => {
  it('maps academic identifiers from API responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'dept-1', institution_id: 'inst-1', name: 'Computer Science' }]), { status: 200 }))
    await expect(getDepartments('inst-1')).resolves.toEqual([{ id: 'dept-1', institutionId: 'inst-1', name: 'Computer Science' }])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/academic/institutions/inst-1/departments'), expect.objectContaining({ headers: expect.any(Object) }))
  })

  it('maps persisted sessions to the timetable model', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'session-1', academic_term_id: 'term-1', class_group_id: 'group-1', day: 'monday', start_time: '09:00', end_time: '10:30', subject_id: 'subject-1', teacher_id: 'teacher-1', room_id: 'room-1', session_type: 'Laboratory', notes: null }]), { status: 200 }))
    await expect(getSessions('group-1')).resolves.toEqual([{ id: 'session-1', classGroupId: 'group-1', day: 'monday', startTime: '09:00', endTime: '10:30', subjectId: 'subject-1', teacherId: 'teacher-1', roomId: 'room-1', type: 'Laboratory', notes: '' }])
  })

  it('exposes structured API errors without claiming success', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ detail: { message: 'Room conflict', conflicts: [{ message: 'Room LAB-1 is occupied.' }] } }), { status: 409 }))
    await expect(getSessions('group-1')).rejects.toMatchObject({ status: 409, detail: { message: 'Room conflict' } } satisfies Partial<ApiError>)
  })
})
