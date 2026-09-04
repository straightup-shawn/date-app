import { useEffect, useRef } from 'react'
import maplibregl, { Map as MLMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { PassStop } from '@/lib/types'

interface FlowMapProps {
  stops: PassStop[]
  selectedStopId: string | null
  onSelectStop: (id: string) => void
  /** Sheet height so the map can keep the active pin visible above it. */
  sheetHeight: number
  darkMode: boolean
}

const STYLE_URL =
  (import.meta.env.VITE_OPENFREEMAP_STYLE_URL as string) ||
  'https://tiles.openfreemap.org/styles/liberty'

/**
 * MapLibre + OpenFreeMap (Section 3.4). No API key, attribution visible.
 * Two-way sync: selecting a pin highlights the timeline stop and vice versa.
 */
export function FlowMap({
  stops,
  selectedStopId,
  onSelectStop,
  sheetHeight,
  darkMode,
}: FlowMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const markersRef = useRef<Map<string, Marker>>(new Map())
  const readyRef = useRef(false)

  // Init map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const markers = markersRef.current
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: stops[0] ? [stops[0].coordinates.lng, stops[0].coordinates.lat] : [101.7108, 3.1478],
      zoom: 14,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on('load', () => {
      readyRef.current = true
      addMarkersAndRoute(map, stops, onSelectStop, markers)
      fitToStops(map, stops, sheetHeight)
    })

    return () => {
      map.remove()
      mapRef.current = null
      readyRef.current = false
      markers.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Emphasize the selected pin + pan just enough to keep it visible.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement()
      el.classList.toggle('flow-pin--active', id === selectedStopId)
    })
    const stop = stops.find((s) => s.id === selectedStopId)
    if (stop) {
      map.easeTo({
        center: [stop.coordinates.lng, stop.coordinates.lat],
        // Pan the pin above the sheet by offsetting vertically.
        offset: [0, -(sheetHeight / 2 - 40)],
        duration: 420,
      })
    }
  }, [selectedStopId, stops, sheetHeight])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      role="img"
      aria-label={`Map of ${stops.length} stops. The full itinerary is also available in the list below.`}
      style={{ filter: darkMode ? 'brightness(0.85)' : undefined }}
    />
  )
}

function addMarkersAndRoute(
  map: MLMap,
  stops: PassStop[],
  onSelect: (id: string) => void,
  store: Map<string, Marker>,
) {
  // Route line (approximate straight segments; real geometry used if present).
  const coords = stops.map((s) => [s.coordinates.lng, s.coordinates.lat])
  if (coords.length >= 2) {
    map.addSource('flow-route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
    })
    map.addLayer({
      id: 'flow-route',
      type: 'line',
      source: 'flow-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#4a7cff',
        'line-width': 3,
        'line-dasharray': [1.5, 1.5],
        'line-opacity': 0.75,
      },
    })
  }

  stops.forEach((s, idx) => {
    const el = document.createElement('button')
    el.className = 'flow-pin'
    el.type = 'button'
    el.setAttribute('aria-label', `Stop ${idx + 1}: ${s.venue_name}`)
    el.textContent = String(idx + 1)
    el.addEventListener('click', () => onSelect(s.id))
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([s.coordinates.lng, s.coordinates.lat])
      .addTo(map)
    store.set(s.id, marker)
  })
}

function fitToStops(map: MLMap, stops: PassStop[], sheetHeight: number) {
  if (stops.length === 0) return
  if (stops.length === 1) {
    map.setCenter([stops[0].coordinates.lng, stops[0].coordinates.lat])
    map.setZoom(15)
    return
  }
  const bounds = new maplibregl.LngLatBounds()
  stops.forEach((s) => bounds.extend([s.coordinates.lng, s.coordinates.lat]))
  map.fitBounds(bounds, {
    padding: { top: 60, left: 40, right: 40, bottom: sheetHeight + 40 },
    maxZoom: 16,
    duration: 0,
  })
}
