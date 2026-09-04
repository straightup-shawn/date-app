// ============================================================
// Flow v7.1 — Weather context (Section 3.7, Step 9)
// OpenWeather free endpoints only. Cached by rounded coord + bucket.
// Fails open: on any error return an "unavailable" neutral context.
// ============================================================
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { getEnv } from './env.ts'
import type { WeatherContext } from './types.ts'

const CACHE_TTL_MIN = 20

export async function getWeatherContext(
  service: SupabaseClient,
  coord: { lat: number; lng: number },
  neighborhood: string,
  forecastFor: string,
  liveEnabled: boolean,
): Promise<WeatherContext> {
  const roundedLat = coord.lat.toFixed(2)
  const roundedLng = coord.lng.toFixed(2)
  const bucket = new Date(forecastFor)
  bucket.setMinutes(0, 0, 0)
  const cacheKey = `${roundedLat},${roundedLng}@${bucket.toISOString()}`

  // 1) Try cache.
  try {
    const { data } = await service
      .from('weather_cache')
      .select('payload, expires_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()
    if (data && new Date(data.expires_at as string) > new Date()) {
      return interpret(data.payload as OWForecastItem, 'cached')
    }
  } catch {
    // ignore cache errors
  }

  const apiKey = getEnv('OPENWEATHER_API_KEY')
  if (!liveEnabled || !apiKey) {
    return neutral('unavailable')
  }

  // 2) Live call — 5 day / 3 hour forecast (permanent free endpoint).
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${coord.lat}&lon=${coord.lng}&units=metric&appid=${apiKey}`
    const res = await fetchWithTimeout(url, 8000)
    if (!res.ok) return neutral('unavailable')
    const json = (await res.json()) as OWForecastResponse
    const item = pickClosest(json, bucket)
    if (!item) return neutral('unavailable')

    // Cache the closest bucket.
    const expires = new Date(Date.now() + CACHE_TTL_MIN * 60000).toISOString()
    await service.from('weather_cache').upsert({
      cache_key: cacheKey,
      neighborhood,
      forecast_for: bucket.toISOString(),
      payload: item,
      expires_at: expires,
    })

    return interpret(item, 'live')
  } catch {
    return neutral('unavailable')
  }
}

interface OWForecastItem {
  dt: number
  main?: { temp?: number; feels_like?: number }
  weather?: Array<{ main?: string; description?: string }>
  pop?: number // probability of precipitation 0..1
}
interface OWForecastResponse {
  list?: OWForecastItem[]
}

function pickClosest(json: OWForecastResponse, target: Date): OWForecastItem | null {
  if (!json.list || json.list.length === 0) return null
  const t = target.getTime()
  let best = json.list[0]
  let bestDiff = Infinity
  for (const item of json.list) {
    const diff = Math.abs(item.dt * 1000 - t)
    if (diff < bestDiff) {
      bestDiff = diff
      best = item
    }
  }
  return best
}

function interpret(item: OWForecastItem, source: 'live' | 'cached'): WeatherContext {
  const pop = typeof item.pop === 'number' ? item.pop : 0
  const feels = item.main?.feels_like ?? item.main?.temp ?? 28
  const cond = (item.weather?.[0]?.main ?? '').toLowerCase()
  const rain_risk = Math.max(pop, cond.includes('rain') || cond.includes('thunder') ? 0.7 : 0)
  const outdoor_suitable = rain_risk < 0.45 && feels < 35
  const heat_discomfort = feels >= 34
  const summary = item.weather?.[0]?.description
    ? capitalize(item.weather[0].description as string)
    : 'Conditions available'
  return {
    rain_risk,
    outdoor_suitable,
    heat_discomfort,
    confidence: source === 'live' ? 82 : 70,
    summary,
    source,
  }
}

function neutral(source: WeatherContext['source']): WeatherContext {
  // When weather is unknown, do not fabricate. Assume outdoor is fine but
  // lower confidence so scoring/labels reflect the uncertainty.
  return {
    rain_risk: 0,
    outdoor_suitable: true,
    heat_discomfort: false,
    confidence: 40,
    summary: 'Weather not refreshed',
    source,
  }
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(id)
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
