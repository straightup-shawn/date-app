// One-off: embed venue semantic profiles into pgvector via NVIDIA NIM.
// Uses the service role (server-side). Only embeds venues that need it.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const nvKey = process.env.NVIDIA_API_KEY
const model = 'nvidia/nemotron-3-embed-1b'
const base = 'https://integrate.api.nvidia.com/v1'

if (!url || !key || !nvKey) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NVIDIA_API_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { data: rows, error } = await supabase.rpc('venues_needing_embedding', {
  p_model: model,
  p_limit: 256,
})
if (error) { console.error('query failed:', error.message); process.exit(1) }
console.log(`${rows.length} venues need embedding`)
if (rows.length === 0) process.exit(0)

// Batch in groups of 32 to keep requests reasonable.
let embedded = 0
for (let i = 0; i < rows.length; i += 32) {
  const batch = rows.slice(i, i + 32)
  const res = await fetch(`${base}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${nvKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: batch.map((v) => v.semantic_profile),
      input_type: 'passage',
      encoding_format: 'float',
    }),
  })
  if (!res.ok) { console.error(`batch ${i} failed: HTTP ${res.status}`); continue }
  const json = await res.json()
  const vectors = json.data.map((d) => d.embedding)
  for (let j = 0; j < batch.length; j++) {
    if (!vectors[j] || vectors[j].length !== 2048) continue
    const { error: upErr } = await supabase.rpc('set_venue_embedding', {
      p_venue_id: batch[j].id,
      p_embedding: vectors[j],
      p_model: model,
    })
    if (!upErr) embedded++
  }
  console.log(`  batch ${i / 32 + 1}: ${batch.length} profiles`)
}
console.log(`Done. Embedded ${embedded} venues.`)
