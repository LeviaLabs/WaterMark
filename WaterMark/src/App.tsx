import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import '@fontsource-variable/fraunces/index.css'
import '@fontsource-variable/figtree/index.css'
import './styling/tokens.css'
import './styling/base.css'
import './styling/glass.css'
import './styling/nav.css'
import './styling/hero.css'
import './styling/droplet.css'
import './styling/sections.css'
import './styling/motion.css'
import './styling/city.css'
import './styling/story.css'
import './styling/features.css'
import './styling/data.css'
import './styling/footer.css'
import './styling/pages.css'
import './styling/scrollbar.css'
import './styling/sea.css'
import './styling/transitions.css'
import './styling/lazy.css'
import { ThemeProvider } from './context/ThemeProvider'
import { ScrollGlow } from './components/layout/ScrollGlow'
import { SiteLayout } from './components/layout/SiteLayout'
import { LandingPage } from './components/pages/LandingPage'

// Secondary routes load on demand so the landing page ships less JavaScript.
const AuthPage = lazy(() => import('./components/pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const MapPage = lazy(() => import('./components/map/MapPage'))
const NotFoundPage = lazy(() => import('./components/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

/**
 * App root: providers, then the router. Every page is a <Route> here; add new
 * pages (for example Ryan Lin's map) by pointing a route at their component.
 */
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="map" element={<Suspense fallback={null}><MapPage /></Suspense>} />
          <Route element={<SiteLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="signup" element={<AuthPage mode="signup" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        <ScrollGlow />
      </BrowserRouter>
    </ThemeProvider>
  )
}
