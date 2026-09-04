// ============================================================
// Flow v7.1 — Edge Function environment access + CORS
// ============================================================
// Never return these values in response bodies or logs.

export function getEnv(name: string): string | undefined {
  return Deno.env.get(name)
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing required env: ${name}`)
  return v
}

/**
 * Build a CORS header set from the explicit ALLOWED_ORIGINS allow-list.
 * Production authenticated write functions must NOT default to wildcard.
 */
export function corsHeaders(requestOrigin: string | null): Record<string, string> {
  const allowList = (getEnv('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // If no allow-list is configured (early local dev), fall back to the
  // caller origin so local testing works, but never echo credentials-bearing
  // wildcard in production — configure ALLOWED_ORIGINS before launch.
  const allowed =
    requestOrigin && (allowList.length === 0 || allowList.includes(requestOrigin))
      ? requestOrigin
      : allowList[0] ?? ''

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function isAdmin(userId: string): boolean {
  const ids = (getEnv('ADMIN_USER_IDS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.includes(userId)
}
