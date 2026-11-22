import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@astryxdesign/core/Button'
import { TextInput } from '@astryxdesign/core/TextInput'
import { CityScene } from '../city/CityScene'
import { RouterLink } from '../common/RouterLink'

type Mode = 'login' | 'signup'

const COPY: Record<Mode, { title: string; lede: string; submit: string; switchText: string; switchLink: string; switchTo: string }> = {
  login: {
    title: 'Welcome back',
    lede: 'Sign in to keep your saved places and alert preferences.',
    submit: 'Email me a sign-in link',
    switchText: 'New to WaterMark?',
    switchLink: 'Create an account',
    switchTo: '/signup',
  },
  signup: {
    title: 'Create your account',
    lede: 'Save the places you care about and choose how you hear about alerts.',
    submit: 'Email me a sign-up link',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
  },
}

/**
 * Log in / sign up shell. Passwordless sign-in (MojoAuth) is Decong's
 * integration and is not wired here yet, so submitting says so honestly
 * instead of pretending to send an email. Accounts stay optional.
 */
export function AuthPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode]
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <section className="auth" aria-labelledby="auth-title">
      <CityScene level={0.18} boat className="auth-city" />
      <span className="auth-shade" aria-hidden="true" />
      <div className="auth-card glass-panel">
        <h1 id="auth-title" className="auth-title">
          {copy.title}
        </h1>
        <p className="auth-lede">{copy.lede}</p>

        {submitted ? (
          <p className="auth-notice" role="status">
            Passwordless sign-in is still being connected, so no email was sent. You can explore every map and data
            layer without an account in the meantime.
          </p>
        ) : (
          <form className="auth-form" onSubmit={onSubmit}>
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
            <Button type="submit" label={copy.submit} variant="primary" size="lg" width="100%" isDisabled={!email.includes('@')} />
          </form>
        )}

        <Button label="Continue without an account" variant="ghost" href="/map" as={RouterLink} width="100%" />

        <p className="auth-switch">
          {copy.switchText} <Link to={copy.switchTo}>{copy.switchLink}</Link>
        </p>
      </div>
    </section>
  )
}
