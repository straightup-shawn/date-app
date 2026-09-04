import { ExternalLink, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { recordStopClick } from '@/lib/api'
import type { PassStop } from '@/lib/types'

/**
 * Actionable links for a stop. Booking shown only when actionable (Section 2A.6).
 * Directions open the user's maps app. Click tracking never blocks navigation.
 */
export function StopActions({ stop }: { stop: PassStop }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${stop.coordinates.lat},${stop.coordinates.lng}`

  return (
    <div className="flex gap-2">
      {stop.booking_url && (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => {
            recordStopClick(stop.id, 'booking')
            window.open(stop.booking_url!, '_blank', 'noopener,noreferrer')
          }}
        >
          <ExternalLink size={16} aria-hidden />
          Book / Contact
        </Button>
      )}
      <Button
        variant="secondary"
        fullWidth
        onClick={() => {
          recordStopClick(stop.id, 'directions')
          window.open(mapsUrl, '_blank', 'noopener,noreferrer')
        }}
      >
        <Navigation size={16} aria-hidden />
        Directions
      </Button>
    </div>
  )
}
