import { describe, expect, it } from 'vitest'
import { loginCopy } from './LoginPage'

describe('universal login copy', () => {
  it('does not advertise a privileged login path', () => {
    expect(loginCopy).toEqual({ brand: 'Schedaro', title: 'Sign in to your account', description: 'Enter your credentials to continue.', emailLabel: 'Email address', passwordLabel: 'Password', action: 'Sign in' })
    expect(Object.values(loginCopy).join(' ')).not.toMatch(/platform owner|super admin|administrative access/i)
  })
})
