import { useEffect, useState } from 'react'
import { LoginPage } from './LoginPage'
import { apiUrl } from '../lib/api'

export function PortalLoginPage({ slug }: { slug: string }) {
  const [portalName, setPortalName] = useState<string | null>(null)
  const [message, setMessage] = useState('Loading institution portal…')
  useEffect(() => { fetch(`${apiUrl}/api/v1/portals/${encodeURIComponent(slug)}`).then(async (response) => { const body = await response.json(); if (!response.ok || !body.available) throw new Error('This institution portal is unavailable.') ; setPortalName(body.name) }).catch((reason) => setMessage(reason instanceof Error ? reason.message : 'This institution portal is unavailable.')) }, [slug])
  if (!portalName) return <main className="portal-unavailable"><div><span className="login-brand-mark">S</span><h1>Schedaro</h1><p>{message}</p><a href="/login">Return to Schedaro sign in</a></div></main>
  return <LoginPage portalName={portalName} />
}
