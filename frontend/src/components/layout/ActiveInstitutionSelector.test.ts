import { describe, expect, it } from 'vitest'
import type { Institution } from '../../lib/api'
import { filterInstitutionOptions, institutionOptionLabel, institutionSelectorTriggerLabel } from './ActiveInstitutionSelector'

const institutions: Institution[] = [
  { id: 'kcet', name: 'Khalsa College of Engineering and Technology', shortName: 'KCET', active: true },
  { id: 'lakeside', name: 'Lakeside Institute', active: true },
]

describe('header institution selector behavior', () => {
  it('renders the real selected institution name and code', () => {
    expect(institutionSelectorTriggerLabel(institutions[0], false, null)).toBe('Khalsa College of Engineering and Technology · KCET')
    expect(institutionOptionLabel(institutions[1])).toBe('Lakeside Institute')
  })

  it('filters available institutions for the open menu without changing context', () => {
    expect(filterInstitutionOptions(institutions, 'lake').map((item) => item.id)).toEqual(['lakeside'])
    expect(filterInstitutionOptions(institutions, '').map((item) => item.id)).toEqual(['kcet', 'lakeside'])
  })

  it('explains loading, error, and empty states instead of rendering a blank trigger', () => {
    expect(institutionSelectorTriggerLabel(undefined, true, null)).toBe('Loading institutions…')
    expect(institutionSelectorTriggerLabel(undefined, false, 'Network failed')).toBe('Institution unavailable')
    expect(institutionSelectorTriggerLabel(undefined, false, null)).toBe('Choose an institution')
  })
})
