// ============================================================
// Flow v7.1 — High-entropy share hash (Section 2 Privacy)
// ============================================================
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** URL-safe, ~26-char, cryptographically strong share token. */
export function generateShareHash(len = 26): string {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

/** Stable, non-PII research query fingerprint (Section 4.11). */
export async function queryFingerprint(parts: Record<string, string>): Promise<string> {
  const canonical = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join('&')
  const data = new TextEncoder().encode(canonical)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
