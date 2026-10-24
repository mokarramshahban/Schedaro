import { describe, expect, it } from 'vitest'
import { resolveActiveInstitutionId } from './InstitutionContext'
import type { Institution } from './api'

const institution = (id: string, active = true): Institution => ({ id, name: id, active })

describe('active institution resolution', () => {
  it('auto-selects the only active institution', () => {
    expect(resolveActiveInstitutionId([institution('one')], '', null)).toBe('one')
  })

  it('restores a valid persisted choice when several institutions exist', () => {
    expect(resolveActiveInstitutionId([institution('one'), institution('two')], '', 'two')).toBe('two')
  })

  it('requires an explicit choice when no persisted choice is valid', () => {
    expect(resolveActiveInstitutionId([institution('one'), institution('two')], '', 'missing')).toBe('')
  })

  it('clears an inactive current institution', () => {
    expect(resolveActiveInstitutionId([institution('one', false), institution('two')], 'one', null)).toBe('two')
  })
})
