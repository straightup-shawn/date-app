import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { AppShell } from '@/components/shell/AppShell'
import { Sheet, type SnapPoint } from '@/components/ui/Sheet'
import { DatePassSheet } from '@/components/pass/DatePassSheet'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { Button } from '@/components/ui/Button'
import { fetchDatePass } from '@/lib/api'
import { useTheme } from '@/lib/useTheme'
import type { DatePass as DatePassType } from '@/lib/types'

// Lazy-load map code — only needed on this screen (Section 2A.15).
const FlowMap = lazy(() =>
  import('@/components/pass/FlowMap').then((m) => ({ default: m.FlowMap })),
)

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; pass: DatePassType }
  | { status: 'not_found' }
  | { status: 'offline' }

export function DatePass() {
  const { hash } = useParams<{ hash: string }>()
  const navigate = useNavigate()
  const { theme } = useTheme()

  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)
  const [snap, setSnap] = useState<SnapPoint>('half')
  // Per-stop chosen option: stopId -> index (-1 = primary, 0..n = alternative).
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({})

  useEffect(() => {
    let alive = true
    setState({ status: 'loading' })
    if (!hash) {
      setState({ status: 'not_found' })
      return
    }
    fetchDatePass(hash)
      .then((pass) => {
        if (!alive) return
        if (pass && pass.stops?.length) {
          setState({ status: 'ready', pass })
          setSelectedStopId(pass.stops[0].id)
        } else {
          setState({ status: 'not_found' })
        }
      })
      .catch(() => {
        if (!alive) return
        // Distinguish offline from missing (Section 2A.14).
        setState(navigator.onLine ? { status: 'not_found' } : { status: 'offline' })
      })
    return () => {
      alive = false
    }
  }, [hash])

  // Sheet occupies ~half by default; used to keep active pin visible.
  const sheetHeight = useMemo(() => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const ratio = snap === 'peek' ? 0.28 : snap === 'full' ? 0.92 : 0.55
    return Math.round(vh * ratio)
  }, [snap])

  if (state.status === 'loading') {
    return (
      <div className="relative min-h-[100dvh] bg-bg">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute inset-x-0 bottom-0 space-y-3 rounded-t-sheet bg-surface p-5">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    )
  }

  if (state.status === 'offline') {
    return (
      <AppShell hideDock>
        <ErrorState
          title="You're offline"
          description="Reconnect to load this Date Pass. Recently opened passes stay available offline."
          action={<Button onClick={() => window.location.reload()}>Try again</Button>}
        />
      </AppShell>
    )
  }

  if (state.status === 'not_found') {
    return (
      <AppShell hideDock>
        <ErrorState
          title="Pass not found"
          description="This link may have expired or is incorrect. Ask the creator for a fresh link."
          action={<Button onClick={() => navigate('/')}>Go to Explore</Button>}
        />
      </AppShell>
    )
  }

  const { pass } = state

  // Apply each stop's chosen option so the map + summary reflect selections.
  const effectiveStops = pass.stops.map((s) => {
    const idx = selectedOptions[s.id] ?? -1
    if (idx < 0 || !s.alternatives || !s.alternatives[idx]) return s
    const opt = s.alternatives[idx]
    return {
      ...s,
      venue_name: opt.venue_name,
      venue_address: opt.venue_address,
      coordinates: opt.coordinates,
      fit_reason: opt.fit_reason,
      est_cost_total: opt.est_cost_total,
      booking_url: opt.booking_url,
    }
  })
  const effectivePass = { ...pass, stops: effectiveStops }

  const selectOption = (stopId: string, index: number) =>
    setSelectedOptions((prev) => ({ ...prev, [stopId]: index }))

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-bg">
      {/* Live map layer */}
      <Suspense fallback={<Skeleton className="absolute inset-0 rounded-none" />}>
        <FlowMap
          stops={effectiveStops}
          selectedStopId={selectedStopId}
          onSelectStop={(id) => {
            setSelectedStopId(id)
            if (snap === 'peek') setSnap('half')
          }}
          sheetHeight={sheetHeight}
          darkMode={theme === 'dark'}
        />
      </Suspense>

      {/* Floating back control (Section 2A.4: consistent position). */}
      <div
        className="absolute left-3 z-40"
        style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
      >
        <div className="flow-material rounded-capsule">
          <IconButton label="Back" onClick={() => navigate(-1)}>
            <ChevronLeft size={22} aria-hidden />
          </IconButton>
        </div>
      </div>

      {/* Draggable content sheet */}
      <Sheet snap={snap} onSnapChange={setSnap}>
        <DatePassSheet
          pass={effectivePass}
          selectedStopId={selectedStopId}
          onSelectStop={(id) => {
            setSelectedStopId(id)
            if (snap === 'peek') setSnap('half')
          }}
          selectedOptions={selectedOptions}
          onSelectOption={selectOption}
        />
      </Sheet>
    </div>
  )
}
