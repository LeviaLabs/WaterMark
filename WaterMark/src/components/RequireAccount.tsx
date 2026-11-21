import type { ReactNode } from 'react'
import { Text } from '@astryxdesign/core/Text'
import { useLocalization } from '../hooks/useLocalization.ts'
import type { Feature } from '../services/auth/session.ts'
import { useAuth } from '../hooks/useAuth.ts'

interface Props {
  /** An account-only feature such as 'savedPlaces'. Public features always render. */
  feature: Feature
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Wrap only account features (saved places, notification choices) in this. Never wrap the
 * map, alerts or forecasts: those are public and canUse() always allows them.
 * This is a display gate. Real protection is Supabase RLS on the server (Codex).
 */
export function RequireAccount({ feature, children, fallback }: Props) {
  const { canUse } = useAuth()
  const { t } = useLocalization()
  if (canUse(feature)) return <>{children}</>
  return <>{fallback ?? <Text as="p">{t('auth.requiredForFeature')}</Text>}</>
}
