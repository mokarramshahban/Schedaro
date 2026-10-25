import { describe, expect, it } from 'vitest'
import { demoSessions } from '../data/timetableDemo'
import { durationToHeight, findSessionConflicts, layoutDaySessions, minutesToPosition, timeLabelY, workingDaysForWeek, rangesOverlap, removeSession, sessionsForClassGroup, timeLabelPosition, timeToMinutes, upsertSession, validateSession, type TimetableSession } from './timetable'

const baseSession: TimetableSession = {
  id: 'test-session',
  classGroupId: 'cs-y1-a',
  day: 'monday',
  startTime: '09:00',
  endTime: '10:00',
  subjectId: 'algorithms',
  teacherId: 'dr-lee',
  roomId: 'room-201',
  type: 'Lecture',
}

describe('institution working-week layout', () => {
  it('returns five or six normal columns from the persisted working week', () => {
    expect(workingDaysForWeek('monday-friday')).toHaveLength(5)
    expect(workingDaysForWeek('monday-saturday')).toHaveLength(6)
  })
})

describe('shared timetable coordinate model', () => {
  it('aligns equal start times across every day', () => {
    const start = timeToMinutes('09:00')!
    expect(minutesToPosition(start)).toBe(minutesToPosition(start))
    expect(minutesToPosition(timeToMinutes('11:00')!)).toBe(2 * minutesToPosition(timeToMinutes('10:00')!) - minutesToPosition(timeToMinutes('09:00')!))
  })

  it('uses duration rather than session count for card height', () => {
    expect(durationToHeight(timeToMinutes('09:00')!, timeToMinutes('11:00')!)).toBe(2 * durationToHeight(timeToMinutes('09:00')!, timeToMinutes('10:00')!))
  })

  it('keeps a late first class at its actual timeline position', () => {
    expect(minutesToPosition(timeToMinutes('11:00')!)).toBe(2 * 84)
    expect(minutesToPosition(timeToMinutes('09:00')!)).toBe(0)
  })

  it('insets boundary labels without changing their shared coordinates', () => {
    expect(timeLabelPosition(timeToMinutes('09:00')!)).toEqual({ topPercent: 0, transform: 'translateY(4px)' })
    expect(timeLabelPosition(timeToMinutes('17:00')!)).toEqual({ topPercent: 100, transform: 'translateY(calc(-100% - 4px))' })
    expect(timeLabelPosition(timeToMinutes('11:30')!)).toEqual({ topPercent: 31.25, transform: 'translateY(-50%)' })
  })

  it('keeps PDF endpoint labels inside the gutter without changing timeline coordinates', () => {
    const top = 50
    const bottom = 150
    expect(timeLabelY(540, 540, 1020, top, bottom)).toBe(50.8)
    expect(timeLabelY(1020, 540, 1020, top, bottom)).toBe(145.2)
    expect(timeLabelY(600, 540, 1020, top, bottom)).toBeCloseTo(60.5, 3)
    expect(minutesToPosition(540)).toBe(0)
    expect(minutesToPosition(1020)).toBe(672)
  })

  it('treats boundary-touching intervals as consecutive, not overlapping', () => {
    expect(rangesOverlap(540, 600, 600, 660)).toBe(false)
    expect(rangesOverlap(540, 600, 599, 660)).toBe(true)
  })
})

describe('session operations and validation', () => {
  it('filters sessions by selected class group', () => {
    const selected = sessionsForClassGroup(demoSessions, 'cs-y1-b')
    expect(selected).toHaveLength(2)
    expect(selected.every((session) => session.classGroupId === 'cs-y1-b')).toBe(true)
  })

  it('adds, edits, and removes one session without changing another group', () => {
    const added = upsertSession([], baseSession)
    expect(added).toHaveLength(1)
    const edited = upsertSession(added, { ...baseSession, startTime: '11:00', endTime: '12:00' })
    expect(edited[0].startTime).toBe('11:00')
    expect(removeSession([...edited, { ...baseSession, id: 'other', classGroupId: 'cs-y1-b' }], baseSession.id)).toHaveLength(1)
  })

  it('allows consecutive sessions but rejects class, teacher, and room collisions', () => {
    const consecutive = { ...baseSession, id: 'consecutive', startTime: '10:00', endTime: '11:00' }
    expect(validateSession(consecutive, [baseSession])).toEqual([])
    const collision = { ...baseSession, id: 'collision' }
    const conflicts = findSessionConflicts(collision, [baseSession])
    expect(conflicts.map((conflict) => conflict.kind)).toEqual(['class', 'teacher', 'room'])
    expect(validateSession(collision, [baseSession])).toHaveLength(3)
  })

  it('rejects invalid schedule bounds and reversed intervals', () => {
    expect(validateSession({ ...baseSession, startTime: '08:30' }, [])).toContain('Sessions must stay within the 09:00–17:00 workspace window.')
    expect(validateSession({ ...baseSession, startTime: '12:00', endTime: '11:00' }, [])).toContain('End time must be later than start time.')
  })
})

describe('overlap layout', () => {
  it('assigns different lanes to overlapping sessions', () => {
    const first = { ...baseSession, id: 'first' }
    const second = { ...baseSession, id: 'second', startTime: '09:30', endTime: '10:30' }
    const layout = layoutDaySessions([first, second], 'monday')
    expect(layout.get('first')?.lane).not.toBe(layout.get('second')?.lane)
    expect(layout.get('first')?.laneCount).toBe(2)
  })
})
