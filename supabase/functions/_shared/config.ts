// ============================================================
// Flow v7.1 — app_config loader (Section 12)
// Reads kill switches / budgets server-side before optional API calls.
// ============================================================
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export interface AppConfig {
  routing_enabled: boolean
  weather_live_enabled: boolean
  research_enabled: boolean
  research_provider: string
  research_monthly_credit_budget: number
  research_max_credits_per_generation: number
  research_trigger_confidence: number
  research_deep_trigger_confidence: number
  nim_enabled: boolean
  nim_semantic_enabled: boolean
  nim_reasoning_enabled: boolean
  nim_embed_model: string
  nim_reasoning_model: string
  nim_semantic_min_similarity: number
  nim_reasoning_trigger_confidence: number
  nim_soft_requests_per_minute: number
  geoapify_daily_credit_budget: number
  weather_soft_calls_per_minute: number
  max_generations_per_user_per_hour: number
  max_generations_global_per_minute: number
  supported_neighborhoods: string[]
  // Worldwide discovery (Migration 8)
  discovery_enabled: boolean
  restrict_to_supported_neighborhoods: boolean
  discovery_radius_meters: number
  discovery_per_family_limit: number
  discovery_min_local_venues: number
}

const DEFAULTS: AppConfig = {
  routing_enabled: true,
  weather_live_enabled: true,
  research_enabled: true,
  research_provider: 'tavily',
  research_monthly_credit_budget: 850,
  research_max_credits_per_generation: 2,
  research_trigger_confidence: 82,
  research_deep_trigger_confidence: 65,
  nim_enabled: true,
  nim_semantic_enabled: true,
  nim_reasoning_enabled: true,
  nim_embed_model: 'nvidia/nemotron-3-embed-1b',
  nim_reasoning_model: 'nvidia/nemotron-3.5-lightning-30b-a3b',
  nim_semantic_min_similarity: 0.55,
  nim_reasoning_trigger_confidence: 70,
  nim_soft_requests_per_minute: 20,
  geoapify_daily_credit_budget: 2500,
  weather_soft_calls_per_minute: 40,
  max_generations_per_user_per_hour: 10,
  max_generations_global_per_minute: 30,
  supported_neighborhoods: ['Bukit Bintang'],
  discovery_enabled: true,
  restrict_to_supported_neighborhoods: false,
  discovery_radius_meters: 2500,
  discovery_per_family_limit: 12,
  discovery_min_local_venues: 8,
}

/** Loads config with the service client. Falls back to defaults on error. */
export async function loadConfig(service: SupabaseClient): Promise<AppConfig> {
  try {
    const { data, error } = await service.from('app_config').select('key, value')
    if (error || !data) return { ...DEFAULTS }
    const merged: Record<string, unknown> = { ...DEFAULTS }
    for (const row of data as Array<{ key: string; value: unknown }>) {
      merged[row.key] = row.value
    }
    return merged as unknown as AppConfig
  } catch {
    return { ...DEFAULTS }
  }
}
