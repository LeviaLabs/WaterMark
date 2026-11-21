import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { ColorSchemeProvider } from './context/ColorSchemeProvider'
import StarterLanding from './components/landing/StarterLanding'

// The map pulls in MapLibre (~800 KB), so it loads only when someone opens /map.
const MapPage = lazy(() => import('./components/map/MapPage'))

export default function App() {
  return (
    <ColorSchemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StarterLanding />} />
          <Route path="/map" element={<Suspense fallback={null}><MapPage /></Suspense>} />
        </Routes>
      </BrowserRouter>
    </ColorSchemeProvider>
  )
}
