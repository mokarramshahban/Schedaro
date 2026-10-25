import { describe, expect, it } from 'vitest'
import type { Institution } from '../../lib/api'
import { filterInstitutionOptions, institutionOptionLabel, institutionSelectorTriggerLabel } from './ActiveInstitutionSelector'

const institutions: Institution[] = [
  { id: 'institution-a', name: 'Example Engineering College', shortName: 'EEC', active: true },
  { id: 'institution-b', name: 'Example Institute', active: true },
]

describe('header institution selector behavior', () => {
  it('renders the real selected institution name and code', () => {
    expect(institutionSelectorTriggerLabel(institutions[0], false, null)).toBe('Example Engineering College · EEC')
    expect(institutionOptionLabel(institutions[1])).toBe('Example Institute')
  })

  it('filters available institutions for the open menu without changing context', () => {
    expect(filterInstitutionOptions(institutions, 'example inst').map((item) => item.id)).toEqual(['institution-b'])
    expect(filterInstitutionOptions(institutions, '').map((item) => item.id)).toEqual(['institution-a', 'institution-b'])
  })

  it('explains loading, error, and empty states instead of rendering a blank trigger', () => {
    expect(institutionSelectorTriggerLabel(undefined, true, null)).toBe('Loading institutions…')
    expect(institutionSelectorTriggerLabel(undefined, false, 'Network failed')).toBe('Institution unavailable')
    expect(institutionSelectorTriggerLabel(undefined, false, null)).toBe('Choose an institution')
  })
})
