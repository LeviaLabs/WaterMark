import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { CityScene } from '../city/CityScene'
import { RouterLink } from '../common/RouterLink'
import { useAuth } from '../../hooks/useAuth'
import { agentboxdConfig, mojoAuthConfig as config } from '../../services/auth/appAuth'
import {
  AgentboxdError,
  clearAgentboxdCallback,
  readAgentboxdCallback,
  startAgentboxdSignIn,
  type AgentboxdErrorCode,
} from '../../services/auth/agentboxd'
import { MojoAuthError, sendEmailCode, verifyEmailCode, type MojoAuthErrorCode } from '../../services/auth/mojoAuth'
import { isAgentAccount } from '../../services/auth/session'

type Mode = 'login' | 'signup'

const COPY: Record<Mode, { title: string; lede: string; switchText: string; switchLink: string; switchTo: string }> = {
  login: {
    title: 'Welcome back',
    lede: 'Sign in to keep your saved places and alert preferences.',
    switchText: 'New to WaterMark?',
    switchLink: 'Create an account',
    switchTo: '/signup',
  },
  signup: {
    title: 'Create your account',
    lede: 'Save the places you care about and choose how you hear about alerts.',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
  },
}

const ERRORS: Record<MojoAuthErrorCode, string> = {
  'invalid-email': 'Enter a valid email address.',
  'invalid-code': 'That code did not work. Check it and try again, or send a new code.',
  'rate-limited': 'Too many tries. Wait a minute, then try again.',
  network: 'Could not reach the sign-in service. Check your connection and try again.',
  'verify-failed': 'We could not confirm your sign-in. Try again in a moment.',
  misconfigured: 'Sign-in is not set up on this site yet. You can explore every map and data layer without an account.',
}

const AGENT_ERRORS: Record<AgentboxdErrorCode, string> = {
  cancelled: 'Agentboxd sign-in was cancelled. Nothing was shared.',
  'state-mismatch': 'That Agentboxd sign-in did not start on this tab, so we did not use it. Start again here.',
  'expired-attempt': 'That Agentboxd sign-in expired or was already used. Start again.',
  'provider-error': 'Agentboxd could not complete the sign-in. Try again.',
  'rate-limited': 'Too many sign-in attempts. Wait a minute, then try again.',
  network: 'Could not reach Agentboxd or our sign-in service. Try again in a moment.',
  'verify-failed': 'We could not confirm that Agentboxd identity. Try again.',
  misconfigured: 'Agent sign-in is not set up on this site yet. You can explore every map and data layer without an account.',
}

const agentMessage = (code: string | null) => AGENT_ERRORS[(code ?? '') as AgentboxdErrorCode] ?? AGENT_ERRORS['verify-failed']

function sessionStore() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

type Step = 'email' | 'code'

/**
 * Log in / sign up. People use a MojoAuth email code (MojoAuth creates the account on first
 * sign-in); AI agents use Sign in with Agentboxd. Every token is trusted only after our Edge
 * Functions (auth-verify, agentboxd-auth) confirm it; the shared <AuthProvider> (App.tsx)
 * holds the session. Accounts stay optional: guests keep every map and data layer.
 */
export function AuthPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode]
  const auth = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stateId, setStateId] = useState('')
  // Agentboxd callback: public/agentboxd-callback.html saved the query and sent us here.
  // Read it (no side effects) for the first render; the effect below deletes it and finishes.
  const [callback] = useState(() => readAgentboxdCallback(sessionStore()))
  const [busy, setBusy] = useState(callback?.ok === true)
  const [error, setError] = useState(callback && !callback.ok ? agentMessage(callback.code) : '')
  const callbackHandled = useRef(false)

  const signedIn = auth.state.status === 'signed-in'
  const agent = isAgentAccount(auth.state.account)
  // The provider is re-checking a stored session (not this page's own sign-in).
  const checking = auth.state.status === 'loading' && !busy
  const name = auth.state.account?.displayName ?? ''

  const { signIn } = auth
  useEffect(() => {
    if (!callback || callbackHandled.current) return
    callbackHandled.current = true
    clearAgentboxdCallback(sessionStore()) // single use, even if this tab reloads
    if (!callback.ok) return
    signIn(callback.credential)
      .then((state) => {
        if (state.status !== 'signed-in') setError(agentMessage(state.error))
      })
      .finally(() => setBusy(false))
  }, [callback, signIn])

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await task()
    } catch (err) {
      setError(ERRORS[err instanceof MojoAuthError ? err.code : 'network'])
    } finally {
      setBusy(false)
    }
  }

  const sendCode = (event?: FormEvent) => {
    event?.preventDefault()
    const cfg = config
    if (!cfg) return setError(ERRORS.misconfigured)
    void run(async () => {
      setStateId(await sendEmailCode(cfg, email, 'en'))
      setCode('')
      setStep('code')
    })
  }

  const verify = (event: FormEvent) => {
    event.preventDefault()
    const cfg = config
    if (!cfg) return
    void run(async () => {
      const state = await auth.signIn(await verifyEmailCode(cfg, stateId, code))
      if (state.status !== 'signed-in') throw new MojoAuthError('verify-failed')
    })
  }

  const startAgent = () => {
    const cfg = agentboxdConfig
    if (!cfg) return setError(AGENT_ERRORS.misconfigured)
    setBusy(true)
    setError('')
    // On success the browser leaves for agentboxd.com, so busy stays on until then.
    startAgentboxdSignIn(cfg).catch((err) => {
      setError(agentMessage(err instanceof AgentboxdError ? err.code : 'network'))
      setBusy(false)
    })
  }

  const signOut = () => {
    void auth.signOut()
    setEmail('')
    setStep('email')
  }

  return (
    <section className="auth" aria-labelledby="auth-title">
      <CityScene level={0.18} boat className="auth-city" />
      <span className="auth-shade" aria-hidden="true" />
      <div className="auth-card glass-panel">
        <h1 id="auth-title" className="auth-title">
          {signedIn ? 'You are signed in' : copy.title}
        </h1>
        <p className="auth-lede" role="status" aria-live="polite">
          {signedIn
            ? agent
              ? `Signed in as ${name || 'an agent'}, an AI agent identity from Agentboxd.`
              : `Signed in as ${name}.`
            : checking
              ? 'Checking your session…'
              : busy && step === 'email'
                ? 'Signing in…'
                : step === 'code'
                  ? `We sent a code to ${email}. It can take a minute to arrive.`
                  : copy.lede}
        </p>

        {error && !signedIn && (
          <p className="auth-notice" role="alert">
            {error}
          </p>
        )}

        {!signedIn && !checking && step === 'email' && (
          <div className="auth-section" role="group" aria-labelledby="auth-human">
            <h2 id="auth-human" className="auth-section-title">Human sign-in</h2>
            <form className="auth-form" onSubmit={sendCode} noValidate>
              <TextInput
                type="email"
                label="Email"
                value={email}
                onChange={(value) => setEmail(value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                isRequired
                width="100%"
              />
              <Button type="submit" label="Email me a code" variant="primary" size="lg" width="100%" isDisabled={busy || !email.includes('@')} />
            </form>
          </div>
        )}

        {!signedIn && step === 'code' && (
          <form className="auth-form" onSubmit={verify} noValidate>
            <TextInput
              label="One-time code"
              value={code}
              onChange={(value) => setCode(value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              isRequired
              width="100%"
            />
            <Button type="submit" label="Sign in" variant="primary" size="lg" width="100%" isDisabled={busy || code.trim().length < 4} />
            <Button label="Send a new code" variant="ghost" width="100%" isDisabled={busy} onClick={() => sendCode()} />
            <Button label="Use a different email" variant="ghost" width="100%" isDisabled={busy} onClick={() => setStep('email')} />
          </form>
        )}

        {!signedIn && !checking && step === 'email' && (
          <div className="auth-section" role="group" aria-labelledby="auth-agent">
            <h2 id="auth-agent" className="auth-section-title">Agent sign-in</h2>
            <Button label="Sign in with Agentboxd" variant="secondary" size="lg" width="100%" isDisabled={busy} onClick={startAgent} />
            <p className="auth-hint">
              The agent’s owner approves on agentboxd.com. WaterMark gets a private agent ID, no email address and no extra access.
            </p>
          </div>
        )}

        {signedIn ? (
          <>
            <Button label="Go to the map" variant="primary" size="lg" href="/map" as={RouterLink} width="100%" />
            <Button label="Sign out" variant="ghost" width="100%" onClick={signOut} />
          </>
        ) : (
          <div className="auth-section" role="group" aria-labelledby="auth-guest">
            <h2 id="auth-guest" className="auth-section-title">Guest</h2>
            <Button label="Continue without an account" variant="ghost" href="/map" as={RouterLink} width="100%" />
            <p className="auth-switch">
              {copy.switchText} <Link to={copy.switchTo}>{copy.switchLink}</Link>
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
