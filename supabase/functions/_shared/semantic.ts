// ============================================================
// Flow v7.1 — NVIDIA NIM semantic + reasoning providers (Section 7)
// Optional enhancement layer. Every path fails OPEN (returns null).
// NIM never decides hard feasibility and never invents facts.
// NVIDIA_API_KEY is server-side only and never returned/logged.
// ============================================================
import { getEnv } from './env.ts'
import type { StructuredIntent } from './types.ts'

const EMBED_DIM = 2048
const EMBED_TIMEOUT_MS = 8000
const REASON_TIMEOUT_MS = 15000

function base(): string {
  return getEnv('NVIDIA_API_BASE_URL') ?? 'https://integrate.api.nvidia.com/v1'
}
function key(): string | undefined {
  return getEnv('NVIDIA_API_KEY')
}

export interface SemanticProvider {
  embedQuery(text: string): Promise<number[] | null>
  embedPassages(texts: string[]): Promise<number[][] | null>
}

export function createSemanticProvider(model: string): SemanticProvider {
  return {
    async embedQuery(text: string) {
      const r = await embed([text], 'query', model)
      return r ? r[0] : null
    },
    async embedPassages(texts: string[]) {
      if (texts.length === 0) return []
      return embed(texts, 'passage', model)
    },
  }
}

async function embed(
  input: string[],
  inputType: 'query' | 'passage',
  model: string,
): Promise<number[][] | null> {
  const apiKey = key()
  if (!apiKey) return null
  try {
    const res = await withTimeout(
      fetch(`${base()}/embeddings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input,
          input_type: inputType, // NVIDIA-specific: query vs passage
          encoding_format: 'float',
        }),
      }),
      EMBED_TIMEOUT_MS,
    )
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>
    }
    if (!json.data) return null
    const vectors = json.data.map((d) => d.embedding ?? [])
    // Validate dimensionality (fail open on mismatch).
    if (vectors.some((v) => v.length !== EMBED_DIM)) return null
    return vectors
  } catch {
    return null
  }
}

export interface ReasoningProvider {
  structureIntent(freeText: string): Promise<StructuredIntent | null>
}

export function createReasoningProvider(model: string): ReasoningProvider {
  return {
    async structureIntent(freeText: string) {
      const apiKey = key()
      if (!apiKey || !freeText.trim()) return null
      try {
        const res = await withTimeout(
          fetch(`${base()}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              temperature: 0.1,
              max_tokens: 300,
              messages: [
                {
                  role: 'system',
                  content:
                    'You convert a short free-form date request into STRICT JSON of SOFT preferences only. ' +
                    'You may ONLY infer preferences from the supplied text. ' +
                    'You may NOT invent hours, prices, coordinates, capacity, weather, availability or routes. ' +
                    'Respond with JSON only, no prose. Schema: ' +
                    '{"vibes":string[],"wants_indoor":boolean|null,"wants_quiet":boolean|null,' +
                    '"activity_heavy":boolean|null,"food_heavy":boolean|null,"low_cost":boolean|null}',
                },
                { role: 'user', content: freeText.slice(0, 500) },
              ],
            }),
          }),
          REASON_TIMEOUT_MS,
        )
        if (!res.ok) return null
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>
        }
        const content = json.choices?.[0]?.message?.content
        if (!content) return null
        return validateIntent(content)
      } catch {
        return null
      }
    },
  }
}

/** Strictly validate reasoning output before use (soft evidence only). */
function validateIntent(raw: string): StructuredIntent | null {
  try {
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    if (jsonStart < 0 || jsonEnd < 0) return null
    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>
    const out: StructuredIntent = {}
    if (Array.isArray(parsed.vibes)) {
      out.vibes = parsed.vibes.map((v) => String(v).toLowerCase().slice(0, 30)).slice(0, 8)
    }
    for (const k of ['wants_indoor', 'wants_quiet', 'activity_heavy', 'food_heavy', 'low_cost'] as const) {
      const v = parsed[k]
      out[k] = typeof v === 'boolean' ? v : null
    }
    return out
  } catch {
    return null
  }
}

async function withTimeout(p: Promise<Response>, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(), ms)
  try {
    return await p
  } finally {
    clearTimeout(id)
  }
}
