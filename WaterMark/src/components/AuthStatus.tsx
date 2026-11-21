import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { useLocalization } from '../hooks/useLocalization.ts'
import { useAuth } from '../hooks/useAuth.ts'

/**
 * Small sign-in status for a header. Announces changes politely to screen readers.
 * With no provider configured it only says the visitor is browsing as a guest.
 * `loginHref` points at the login page (default `/login`).
 */
export function AuthStatus({ loginHref = '/login' }: { loginHref?: string }) {
  const { state, canSignIn, signOut } = useAuth()
  const { t } = useLocalization()

  const message =
    state.status === 'loading' ? t('auth.loading')
    : state.status === 'signed-in' ? t('auth.signedInAs', { name: state.account?.displayName ?? '—' })
    : state.status === 'expired' ? t('auth.expired')
    : state.status === 'error' ? t('auth.error')
    : t('auth.guest')

  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      <Text role="status" aria-live="polite" type="supporting" color="secondary">
        {message}
      </Text>
      {state.status === 'signed-in' && (
        <Button label={t('auth.signOut')} variant="secondary" onClick={() => void signOut()} />
      )}
      {canSignIn && state.status !== 'signed-in' && state.status !== 'loading' && (
        <Link href={loginHref}>{t('auth.signIn')}</Link>
      )}
    </HStack>
  )
}
