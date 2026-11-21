import { useState, type FormEvent } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { useAuth } from '../hooks/useAuth.ts'
import { useLocalization } from '../hooks/useLocalization.ts'
import type { MessageKey } from '../scripting/localization/messages/en.ts'
import {
  MojoAuthError,
  resendEmailCode,
  sendEmailCode,
  verifyEmailCode,
  type MojoAuthConfig,
  type MojoAuthErrorCode,
} from '../services/auth/mojoAuth.ts'
import { LanguageSelect } from './LanguageSelect.tsx'

type Step = 'email' | 'code'

const ERROR_KEYS: Record<MojoAuthErrorCode, MessageKey> = {
  'invalid-email': 'login.error.invalidEmail',
  'invalid-code': 'login.error.invalidCode',
  'rate-limited': 'login.error.rateLimited',
  network: 'login.error.network',
  'verify-failed': 'login.error.verifyFailed',
  misconfigured: 'login.notConfigured',
}

const errorCode = (e: unknown): MojoAuthErrorCode => (e instanceof MojoAuthError ? e.code : 'network')

/**
 * Passwordless sign-in page: email, then a one-time code from MojoAuth, then server-side
 * verification through the `auth-verify` Edge Function. An account stays optional: the guest
 * link is always visible. With `config` null the page says sign-in is not set up.
 */
export function LoginPage({ config, homeHref = '/' }: { config: MojoAuthConfig | null; homeHref?: string }) {
  const { state, signIn, signOut } = useAuth()
  const { t, locale } = useLocalization()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stateId, setStateId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MojoAuthErrorCode | null>(null)

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(errorCode(e))
    } finally {
      setBusy(false)
    }
  }

  const onSendCode = (event: FormEvent) => {
    event.preventDefault()
    if (!config) return
    void run(async () => {
      setStateId(await sendEmailCode(config, email, locale))
      setCode('')
      setStep('code')
    })
  }

  const onVerify = (event: FormEvent) => {
    event.preventDefault()
    if (!config) return
    void run(async () => {
      const token = await verifyEmailCode(config, stateId, code)
      const next = await signIn(token)
      if (next.status !== 'signed-in') throw new MojoAuthError('verify-failed')
    })
  }

  const onResend = () => {
    if (!config) return
    void run(async () => {
      setStateId(await resendEmailCode(config, stateId, locale))
      setCode('')
    })
  }

  const onChangeEmail = () => {
    setStep('email')
    setCode('')
    setStateId('')
    setError(null)
  }

  const signedIn = state.status === 'signed-in'

  return (
    <Center minHeight="100dvh" padding={4}>
      <Card maxWidth={440} width="100%" padding={6}>
        <VStack gap={5}>
          <HStack gap={2} justify="between" vAlign="center" wrap="wrap">
            <Heading level={1}>{t('login.title')}</Heading>
            <LanguageSelect hideLabel />
          </HStack>

          {error && <Banner status="error" title={t(ERROR_KEYS[error])} />}

          {!config && <Banner status="info" title={t('login.notConfigured')} />}

          {signedIn && (
            <VStack gap={4}>
              <Text as="p" role="status" aria-live="polite">
                {t('login.signedIn', { name: state.account?.displayName ?? '—' })}
              </Text>
              <HStack gap={3} vAlign="center" wrap="wrap">
                <Link href={homeHref} isStandalone>{t('login.backToMap')}</Link>
                <Button label={t('auth.signOut')} variant="secondary" onClick={() => void signOut()} />
              </HStack>
            </VStack>
          )}

          {config && !signedIn && step === 'email' && (
            <form onSubmit={onSendCode} noValidate>
              <VStack gap={4}>
                <Text as="p">{t('login.intro')}</Text>
                <TextInput
                  type="email"
                  label={t('login.email')}
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  hasSpellCheck={false}
                  isRequired
                  hasAutoFocus
                  size="lg"
                  htmlName="email"
                />
                <Button type="submit" label={t('login.sendCode')} variant="primary" size="lg" isLoading={busy} />
              </VStack>
            </form>
          )}

          {config && !signedIn && step === 'code' && (
            <form onSubmit={onVerify} noValidate>
              <VStack gap={4}>
                <Text as="p" role="status" aria-live="polite">
                  {t('login.codeSent', { email: email.trim() })}
                </Text>
                <TextInput
                  label={t('login.code')}
                  value={code}
                  onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 10))}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  enterKeyHint="done"
                  isRequired
                  hasAutoFocus
                  size="lg"
                  htmlName="one-time-code"
                />
                <Button type="submit" label={t('login.verify')} variant="primary" size="lg" isLoading={busy} />
                <HStack gap={3} wrap="wrap">
                  <Button label={t('login.resend')} variant="secondary" onClick={onResend} isDisabled={busy} />
                  <Button label={t('login.changeEmail')} variant="secondary" onClick={onChangeEmail} isDisabled={busy} />
                </HStack>
              </VStack>
            </form>
          )}

          {!signedIn && (
            <VStack gap={2}>
              <Link href={homeHref} isStandalone>{t('login.continueGuest')}</Link>
              <Text as="p" type="supporting" color="secondary">{t('auth.optional')}</Text>
              {config && <Text as="p" type="supporting" color="secondary">{t('login.privacy')}</Text>}
            </VStack>
          )}
        </VStack>
      </Card>
    </Center>
  )
}
