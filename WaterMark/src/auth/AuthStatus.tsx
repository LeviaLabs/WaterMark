import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { useI18n } from '../i18n/useI18n.ts'
import { useAuth } from './useAuth.ts'

/**
 * Small sign-in status for a header. Announces changes politely to screen readers.
 * With no provider configured it only says the visitor is browsing as a guest.
 */
export function AuthStatus() {
  const { state, canSignIn, signIn, signOut } = useAuth()
  const { t } = useI18n()

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
      {canSignIn && state.status !== 'signed-in' && (
        <Button
          label={t('auth.signIn')}
          variant="primary"
          isLoading={state.status === 'loading'}
          onClick={() => void signIn()}
        />
      )}
    </HStack>
  )
}
