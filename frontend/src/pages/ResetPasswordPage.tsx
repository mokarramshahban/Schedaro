import { FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { resetPassword } from '../lib/authApi'
import { apiUrl } from '../lib/api'

export function ResetPasswordPage({ slug, initialToken }: { slug?: string; initialToken?: string }) {
  const [portalName, setPortalName] = useState<string | null>(null)
  const [token, setToken] = useState(initialToken || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!slug) return
    fetch(`${apiUrl}/api/v1/portals/${encodeURIComponent(slug)}`).then(async (response) => {
      const body = await response.json()
      if (!response.ok || !body.available) throw new Error('This institution portal is unavailable.')
      setPortalName(body.name)
    }).catch(() => setPortalName(null))
  }, [slug])

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(null)
    if (password !== confirmation) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    try { await resetPassword(token.trim(), password); setSuccess(true); window.history.replaceState({}, '', slug ? `/c/${slug}/reset-password` : '/login') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The reset key could not be redeemed.') }
    finally { setSubmitting(false) }
  }

  if (success) return <main className="activation-page"><section className="activation-card"><span className="login-brand-mark">S</span><p className="eyebrow">Password updated</p><h1>Your password is ready</h1><p className="muted-copy">The one-time recovery key was consumed and active sessions were revoked.</p><a className="button button--primary" href={slug ? `/c/${slug}` : '/login'}>Continue to sign in</a></section></main>
  return <main className="activation-page"><section className="activation-card"><span className="login-brand-mark">S</span><p className="eyebrow">{portalName || 'Schedaro'} account recovery</p><h1>Reset Your Password</h1><p className="muted-copy">Use the one-time reset key supplied by an authorized account administrator. The key is not sent by email or stored in this browser.</p>{error && <div className="form-errors" role="alert">{error}</div>}<form className="activation-form" onSubmit={(event) => void submit(event)}><label className="field"><span>Reset key</span><input required minLength={32} value={token} onChange={(event) => setToken(event.target.value)} autoComplete="one-time-code" /></label><label className="field"><span>New password</span><span className="login-password-wrap"><input required minLength={12} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /><button type="button" className="login-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label><label className="field"><span>Confirm new password</span><input required minLength={12} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" /></label><Button type="submit" disabled={submitting}>{submitting ? 'Updating password…' : 'Set new password'}</Button></form><p className="login-security-note"><ShieldCheck size={15} /> Your password is protected by Schedaro's central account security.</p><a href={slug ? `/c/${slug}` : '/login'}>Return to sign in</a></section></main>
}
