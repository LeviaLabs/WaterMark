import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { CityScene } from '../city/CityScene'
import { RouterLink } from '../common/RouterLink'
import {
  createMojoAuthAdapter,
  mojoAuthConfigFromEnv,
  MojoAuthError,
  sendEmailCode,
  verifyEmailCode,
  type MojoAuthErrorCode,
} from '../../services/auth/mojoAuth'
import type { AuthState } from '../../services/auth/session'

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

// MojoAuth email one-time code (see docs/mojoauth-login.md). Null when the env values are missing.
const config = mojoAuthConfigFromEnv(import.meta.env)
const adapter = config ? createMojoAuthAdapter(config) : null

type Step = 'email' | 'code' | 'signed-in'

/**
 * Log in / sign up. Both modes use the same MojoAuth email code: MojoAuth creates the
 * account on first sign-in. The token is trusted only after our auth-verify Edge Function
 * confirms it. Accounts stay optional.
 */
export function AuthPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode]
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stateId, setStateId] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    adapter?.restore().then((state) => {
      if (active && state.status === 'signed-in') showSignedIn(state)
    })
    return () => {
      active = false
    }
  }, [])

  function showSignedIn(state: AuthState) {
    setName(state.account?.displayName ?? '')
    setStep('signed-in')
  }

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
    if (!config) return setError(ERRORS.misconfigured)
    void run(async () => {
      setStateId(await sendEmailCode(config, email, 'en'))
      setCode('')
      setStep('code')
    })
  }

  const verify = (event: FormEvent) => {
    event.preventDefault()
    if (!config || !adapter) return
    void run(async () => {
      const state = await adapter.signIn(await verifyEmailCode(config, stateId, code))
      if (state.status !== 'signed-in') throw new MojoAuthError('verify-failed')
      showSignedIn(state)
    })
  }

  const signOut = () => {
    void adapter?.signOut()
    setEmail('')
    setStep('email')
  }

  return (
    <section className="auth" aria-labelledby="auth-title">
      <CityScene level={0.18} boat className="auth-city" />
      <span className="auth-shade" aria-hidden="true" />
      <div className="auth-card glass-panel">
        <h1 id="auth-title" className="auth-title">
          {step === 'signed-in' ? 'You are signed in' : copy.title}
        </h1>
        <p className="auth-lede">
          {step === 'signed-in' ? `Signed in as ${name}.` : step === 'code' ? `We sent a code to ${email}. It can take a minute to arrive.` : copy.lede}
        </p>

        {error && (
          <p className="auth-notice" role="alert">
            {error}
          </p>
        )}

        {step === 'email' && (
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
        )}

        {step === 'code' && (
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

        {step === 'signed-in' ? (
          <>
            <Button label="Go to the map" variant="primary" size="lg" href="/map" as={RouterLink} width="100%" />
            <Button label="Sign out" variant="ghost" width="100%" onClick={signOut} />
          </>
        ) : (
          <>
            <Button label="Continue without an account" variant="ghost" href="/map" as={RouterLink} width="100%" />
            <p className="auth-switch">
              {copy.switchText} <Link to={copy.switchTo}>{copy.switchLink}</Link>
            </p>
          </>
        )}
      </div>
    </section>
  )
}
