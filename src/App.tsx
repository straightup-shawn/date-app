import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { Explore } from '@/screens/Explore'

// Route-level code splitting (Section 2A.15).
const Create = lazy(() => import('@/screens/Create').then((m) => ({ default: m.Create })))
const SavedPasses = lazy(() =>
  import('@/screens/SavedPasses').then((m) => ({ default: m.SavedPasses })),
)
const DatePass = lazy(() => import('@/screens/DatePass').then((m) => ({ default: m.DatePass })))
const NotFound = lazy(() => import('@/screens/NotFound').then((m) => ({ default: m.NotFound })))

// NOTE: no AnimatePresence "mode=wait" around the routes. It caused the
// generating screen (infinite spinner) to block the incoming /pass route from
// ever becoming visible. Per-screen PageTransition still provides a subtle
// enter animation. Routes now swap immediately and reliably.
export default function App() {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/create" element={<Create />} />
          <Route path="/saved" element={<SavedPasses />} />
          <Route path="/pass/:hash" element={<DatePass />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  )
}
