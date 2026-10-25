import { FormEvent, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card, CardBody } from '../components/ui/Card'
import { useAuth } from '../lib/AuthContext'

export function LoginPage() {
  const { login, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setSubmitting(true); try { await login(email, password) } catch { /* error is rendered by AuthContext */ } finally { setSubmitting(false) } }
  return <div className="page-content institution-setup-page"><Card className="institution-setup-card"><CardBody><p className="eyebrow">Schedaro platform</p><h1>Sign in to Schedaro</h1><p className="page-description">Use your authorized Platform Owner account to access institutions and platform administration.</p>{error && <div className="form-errors" role="alert">{error}</div>}<form className="stack-form" onSubmit={submit}><label className="field"><span>Email</span><input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="field"><span>Password</span><input type="password" autoComplete="current-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} /></label><Button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</Button></form></CardBody></Card></div>
}
