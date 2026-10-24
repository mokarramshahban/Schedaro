import { describe, expect, it } from 'vitest'
import { printSessionPosition } from './TimetablePrintView'

const position = (startTime: string, endTime: string) => printSessionPosition({ startTime, endTime })

describe('A4 print timetable positioning', () => {
  it('uses one shared time axis for equal starts across weekdays', () => {
    expect(position('09:00', '10:00').topPercent).toBe(0)
    expect(position('09:00', '11:00').topPercent).toBe(0)
    expect(position('11:00', '12:00').topPercent).toBe(25)
  })

  it('preserves variable session durations as proportional heights', () => {
    expect(position('09:00', '10:00').heightPercent).toBe(12.5)
    expect(position('09:00', '11:00').heightPercent).toBe(25)
    expect(position('13:30', '15:00').heightPercent).toBe(18.75)
  })

  it('keeps empty gaps empty instead of using array indexes', () => {
    expect(position('15:00', '16:00').topPercent).toBe(75)
    expect(position('15:00', '16:00').topPercent).not.toBe(25)
  })
})
