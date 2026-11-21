import { useI18n } from '../i18n/useI18n.ts'
import { useAuth } from './useAuth.ts'
import '../i18n/i18n.css'

/**
 * Small sign-in status for a header. Announces changes politely to screen readers.
 * With no provider configured it only says the visitor is browsing as a guest.
 */
export function AuthStatus({ className }: { className?: string }) {
  const { state, canSignIn, signIn, signOut } = useAuth()
  const { t } = useI18n()

  const message =
    state.status === 'loading' ? t('auth.loading')
    : state.status === 'signed-in' ? t('auth.signedInAs', { name: state.account?.displayName ?? '—' })
    : state.status === 'expired' ? t('auth.expired')
    : state.status === 'error' ? t('auth.error')
    : t('auth.guest')

  return (
    <div className={['wm-auth', className].filter(Boolean).join(' ')}>
      <span role="status" aria-live="polite">{message}</span>
      {state.status === 'signed-in' && (
        <button type="button" onClick={() => void signOut()}>{t('auth.signOut')}</button>
      )}
      {canSignIn && state.status !== 'signed-in' && (
        <button type="button" onClick={() => void signIn()} disabled={state.status === 'loading'} aria-busy={state.status === 'loading'}>
          {t('auth.signIn')}
        </button>
      )}
    </div>
  )
}
