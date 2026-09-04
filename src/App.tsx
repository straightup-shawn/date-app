import { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { ToastProvider } from '@/components/ui/Toast'
import { Explore } from '@/screens/Explore'

// Route-level code splitting (Section 2A.15).
const Create = lazy(() => import('@/screens/Create').then((m) => ({ default: m.Create })))
const SavedPasses = lazy(() =>
  import('@/screens/SavedPasses').then((m) => ({ default: m.SavedPasses })),
)
const DatePass = lazy(() => import('@/screens/DatePass').then((m) => ({ default: m.DatePass })))
const NotFound = lazy(() => import('@/screens/NotFound').then((m) => ({ default: m.NotFound })))

export default function App() {
  const location = useLocation()
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Explore />} />
            <Route path="/create" element={<Create />} />
            <Route path="/saved" element={<SavedPasses />} />
            <Route path="/pass/:hash" element={<DatePass />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </ToastProvider>
  )
}
