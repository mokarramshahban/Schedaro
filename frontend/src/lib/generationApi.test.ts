import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateRequirement } from './generationApi'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
afterEach(() => fetchMock.mockReset())

describe('requirement editing API', () => {
  it('updates the stable requirement id and preserves the full edited identity', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: 'requirement-tutorial', class_group_id: 'group-1', subject_id: 'subject-cse101', teacher_id: 'teacher-one', session_type: 'Tutorial', weekly_count: 2, duration_minutes: 60, room_type: 'classroom', active: true }), { status: 200 }))
    await expect(updateRequirement('requirement-tutorial', { subjectId: 'subject-cse101', teacherId: 'teacher-one', sessionType: 'Tutorial', weeklyCount: 2, durationMinutes: 60, roomType: 'classroom', active: true })).resolves.toMatchObject({ id: 'requirement-tutorial', sessionType: 'Tutorial', weeklyCount: 2 })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/v1/scheduling/requirements/requirement-tutorial'), expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ subject_id: 'subject-cse101', teacher_id: 'teacher-one', session_type: 'Tutorial', weekly_count: 2, duration_minutes: 60, room_type: 'classroom', active: true }) }))
  })
})
