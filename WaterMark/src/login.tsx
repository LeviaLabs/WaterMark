// Standalone entry for the sign-in page (WM-CLAUDE-002), served at /login.html by `npm run dev`.
// It does not touch main.tsx or App.tsx. Once PR #5's router lands, mount <LoginPage> at /login
// inside the same providers and delete this file and login.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Theme } from '@astryxdesign/core/theme'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import { themes, defaultThemeSlug } from './astryx-themes'
import { LoginPage } from './components/LoginPage.tsx'
import { AuthProvider } from './context/AuthProvider.tsx'
import { LocalizationProvider } from './context/LocalizationProvider.tsx'
import { guestAdapter } from './services/auth/session.ts'
import { createMojoAuthAdapter, mojoAuthConfigFromEnv } from './services/auth/mojoAuth.ts'

const config = mojoAuthConfigFromEnv(import.meta.env)
const adapter = config ? createMojoAuthAdapter(config) : guestAdapter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme theme={themes[defaultThemeSlug]}>
      <LocalizationProvider>
        <AuthProvider adapter={adapter}>
          <LoginPage config={config} homeHref="/" />
        </AuthProvider>
      </LocalizationProvider>
    </Theme>
  </StrictMode>,
)
