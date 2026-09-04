import { Share2, ShieldQuestion } from 'lucide-react'
import { PassSummary } from './PassSummary'
import { Timeline } from './Timeline'
import { StopActions } from './StopActions'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { DatePass } from '@/lib/types'

interface DatePassSheetProps {
  pass: DatePass
  selectedStopId: string | null
  onSelectStop: (id: string) => void
}

export function DatePassSheet({ pass, selectedStopId, onSelectStop }: DatePassSheetProps) {
  const toast = useToast()
  const selectedStop = pass.stops.find((s) => s.id === selectedStopId) ?? null

  async function onShare() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: pass.title ?? 'Flow Date Pass', url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.show('Link copied to clipboard', 'success')
      }
    } catch {
      // User cancelled share sheet — no error surfaced.
    }
  }

  return (
    <div className="space-y-4">
      <PassSummary pass={pass} />

      <Button fullWidth onClick={onShare}>
        <Share2 size={18} aria-hidden />
        Share this pass
      </Button>

      <Timeline stops={pass.stops} selectedStopId={selectedStopId} onSelectStop={onSelectStop} />

      {selectedStop && (
        <div className="pt-1">
          <StopActions stop={selectedStop} />
        </div>
      )}

      {/* Honest labeling: estimates are not guarantees (Section 9). */}
      <p className="flex items-start gap-2 pt-2 text-micro text-text-tertiary">
        <ShieldQuestion size={14} className="mt-0.5 shrink-0" aria-hidden />
        Prices and hours are estimates. Please verify opening hours and booking
        availability before you go.
      </p>

      {/* Attribution (Section 9). */}
      <p className="text-micro text-text-tertiary">
        Map data © OpenStreetMap contributors · Tiles by OpenFreeMap · Places via Geoapify
      </p>
    </div>
  )
}
