import { BrowserRouter, Route, Routes } from 'react-router'
import { LinkProvider } from '@astryxdesign/core/Link'
import { AppLink } from './components/AppLink.tsx'
import { HashScroller } from './components/HashScroller.tsx'
import { LandingPage } from './components/LandingPage.tsx'
import { PlaceholderPage } from './components/PlaceholderPage.tsx'

export default function App() {
  return (
    <BrowserRouter>
      <LinkProvider component={AppLink}>
        <HashScroller />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              <PlaceholderPage
                title="Sign in"
                owner="Decong Huang"
                body="Login is optional and not connected yet. MojoAuth is under evaluation. The public map does not wait on an account, and this screen is here so the route exists for the auth work."
              />
            }
          />
          <Route
            path="/signup"
            element={
              <PlaceholderPage
                title="Create an account"
                owner="Decong Huang"
                body="Sign-up is a placeholder. Creating an account will not be required to inspect public flood data, and this page does not collect a password."
              />
            }
          />
          <Route
            path="/app"
            element={
              <PlaceholderPage
                title="The map will live here"
                owner="Ryan Lin"
                body="The 2D map, data panel, circle selection, and forecast charts replace this screen. Nothing here is a live flood reading, a forecast, or a suggestion about where to drive."
                showMapFrame
              />
            }
          />
        </Routes>
      </LinkProvider>
    </BrowserRouter>
  )
}
