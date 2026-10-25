import { FormEvent, useState } from 'react'
import { BookOpenCheck, Eye, EyeOff, GraduationCap, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useAuth } from '../lib/AuthContext'

export const loginCopy = { brand: 'Schedaro', title: 'Sign in to your account', description: 'Enter your credentials to continue.', emailLabel: 'Email address', passwordLabel: 'Password', action: 'Sign in' } as const

export function LoginPage() {
  const { login, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try { await login(email, password) } catch { /* The shared auth context renders the safe error. */ } finally { setSubmitting(false) }
  }

  return <main className="login-page">
    <section className="login-brand-panel" aria-label="About Schedaro">
      <div className="login-brand-panel__inner">
        <div className="login-brand-lockup"><span className="login-brand-mark">S</span><span>{loginCopy.brand}</span></div>
        <div className="login-intro"><p className="login-kicker">Smart academic workspace</p><h1>Make every academic day easier to plan.</h1><p>Bring institutions, people and timetables into one calm, focused workspace.</p></div>
        <div className="login-visual" aria-hidden="true">
          <div className="login-visual__glow" />
          <div className="login-visual__card login-visual__card--back"><span /><span /><span /></div>
          <div className="login-visual__card login-visual__card--main"><div className="login-visual__card-head"><span>Academic week</span><i>•••</i></div><div className="login-calendar"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></div>
          <div className="login-visual__badge"><ShieldCheck size={15} /><span>Secure workspace</span></div>
          <div className="login-visual__icon login-visual__icon--book"><BookOpenCheck size={20} /></div><div className="login-visual__icon login-visual__icon--cap"><GraduationCap size={21} /></div>
        </div>
        <p className="login-brand-panel__footer">Built for thoughtful academic coordination.</p>
      </div>
    </section>
    <section className="login-form-panel">
      <div className="login-form-wrap">
        <div className="login-form-heading"><p className="login-kicker">Welcome back</p><h2>{loginCopy.title}</h2><p>{loginCopy.description}</p></div>
        {error && <div className="login-error" role="alert"><strong>We couldn't sign you in.</strong><span>{error}</span></div>}
        <form className="login-form" onSubmit={submit}>
          <label className="login-field"><span>{loginCopy.emailLabel}</span><input type="email" autoComplete="username" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label className="login-field"><span>{loginCopy.passwordLabel}</span><span className="login-password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /><button type="button" className="login-password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          <Button type="submit" className="login-submit" disabled={submitting}>{submitting ? 'Signing in…' : loginCopy.action}</Button>
        </form>
        <p className="login-security-note"><ShieldCheck size={15} /> Your session is protected by Schedaro's secure sign-in.</p>
      </div>
    </section>
  </main>
}
