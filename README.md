# Flow v7.1 — Multi-Stop Date Itinerary PWA

Flow is a Progressive Web App that builds a curated, feasibility-checked
multi-stop date sequence (e.g. **Dinner → Activity → Dessert**) and shares it as
a **Date Pass** — an unlisted link the recipient opens with no account.

This repository implements the **true-free core** (RM0 / $0 monthly) with an
**optional NVIDIA NIM** semantic/reasoning layer. **Turn NIM off and Flow still
works** — the planner is a deterministic constraint solver.

- **Frontend:** React + TypeScript + Vite, Tailwind, Framer Motion, MapLibre GL + OpenFreeMap, PWA (Workbox).
- **Backend:** Supabase (Postgres + PostGIS + pgvector + Auth + Edge Functions + Cron).
- **Hosting:** Render **Static Site** only (no Web Service, no paid DB/cron/LLM).
- **Optional intelligence:** NVIDIA hosted NIM (embeddings + structured soft reasoning).

> ⚠️ True-free means normal MVP operation needs no credit card and no monthly
> infra bill. It does **not** mean infinite capacity. Quotas degrade gracefully;
> they never auto-upgrade to a paid plan.

---

## Architecture at a glance

| Question | Answer |
|---|---|
| What runs in the browser? | The static React PWA (map, forms, Date Pass viewer). |
| What runs in Supabase? | Postgres/PostGIS/pgvector, Auth (anonymous), Edge Functions, Cron. |
| Which secrets live where? | Only `VITE_*` reach the browser. All provider keys + service-role key live in Supabase Edge Function secrets. |
| Which tables can the browser read? | Only the caller's own `itineraries` / `itinerary_stops` (RLS). Everything else is server-only. |
| Which writes require a function/RPC? | All of them. Generation goes through `generate-flow`; public reads use `get_date_pass`; clicks use `record_stop_click`. |
| How is generation rate-limited? | Atomically in Postgres (`consume_generation_quota`). |
| What happens at quota exhaustion? | Feature degrades (no research / no routing / cached weather / deterministic ranking). No paid upgrade. |
| How is it deployed without a paid server? | Render Static Site + SPA rewrite (`render.yaml`). |

The full request pipeline lives in `supabase/functions/generate-flow/` and the
deterministic engine in `supabase/functions/_shared/planner.ts`.

---

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A free Supabase project
- (Optional) provider keys: OpenWeather, Geoapify, Tavily, NVIDIA

---

## 1. Local frontend setup

```bash
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (from your Supabase project).
npm run dev
```

Open http://localhost:5173.

> **PWA icons:** placeholder `public/pwa-192.png` and `public/pwa-512.png`
> (192×192 / 512×512) ship with the repo. Replace them with your branded icons
> before launch.

---

## 2. Supabase setup

```bash
supabase link --project-ref <your-project-ref>

# Apply all migrations (schema, RLS, RPCs, config, cron, helpers).
supabase db push
```

This creates every table, enables RLS, installs the RPCs
(`get_date_pass`, `consume_generation_quota`, `persist_generated_pass`, …),
seeds `app_config`, and schedules the cron cleanup jobs.

Enable **Anonymous sign-ins** in the Supabase dashboard (Auth → Providers) if it
is not already on. Local `supabase/config.toml` enables it for local dev.

### Edge Function secrets (never in the frontend)

```bash
supabase secrets set \
  SUPABASE_URL="https://<ref>.supabase.co" \
  SUPABASE_ANON_KEY="<anon>" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role>" \
  ALLOWED_ORIGINS="https://your-app.onrender.com,http://localhost:5173" \
  APP_BASE_URL="https://your-app.onrender.com"

# Optional providers (Flow works without these):
supabase secrets set \
  OPENWEATHER_API_KEY="..." \
  GEOAPIFY_API_KEY="..." \
  TAVILY_API_KEY="..." \
  NVIDIA_API_KEY="..." \
  NVIDIA_API_BASE_URL="https://integrate.api.nvidia.com/v1" \
  NVIDIA_EMBED_MODEL="nvidia/nemotron-3-embed-1b" \
  NVIDIA_REASONING_MODEL="nvidia/nemotron-3.5-lightning-30b-a3b" \
  ADMIN_USER_IDS="<your-auth-uid-for-admin-functions>"
```

### Deploy functions

```bash
supabase functions deploy generate-flow
supabase functions deploy refresh-venue-embeddings
```

---

## 3. Seed a strong area (Bukit Bintang)

```bash
# Server-side only. Uses the service-role key.
SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role>" \
npm run seed
```

The seed is **idempotent** (upsert on `source,external_id`) — re-running does
not create duplicate rows. It covers food, drinks/cafe, activity, culture,
outdoor/explore and nightlife so the planner can build ≥5 meaningfully different
feasible sequences with no web research.

### (Optional) enable semantic recall

After seeding, and with `NVIDIA_API_KEY` set + `nim_semantic_enabled = true`,
call the admin function to embed venue profiles into pgvector:

```bash
# Requires an admin session token (ADMIN_USER_IDS must include your uid).
curl -X POST "https://<ref>.functions.supabase.co/refresh-venue-embeddings" \
  -H "Authorization: Bearer <your-user-access-token>"
```

Only changed venues are re-embedded. If NIM is disabled/unavailable, this is a
no-op and deterministic ranking is used.

---

## 4. Deploy the frontend to Render

Render Static Site only — **do not** add a Web Service, Postgres, Key Value, or
Cron, and avoid attaching a payment method during the true-free phase.

1. New → **Static Site**, connect this repo.
2. Render reads `render.yaml`:
   - Build: `npm ci && npm run build`
   - Publish dir: `dist`
   - SPA rewrite: `/* → /index.html` (so `/pass/:hash` resolves on refresh).
3. Add environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_APP_BASE_URL`, `VITE_OPENFREEMAP_STYLE_URL`.

---

## 5. Keep-alive

Add GitHub Actions secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The workflow
in `.github/workflows/supabase-keepalive.yml` pings the `health_ping` RPC a few
times per day so a demo project is less likely to be paused. No service-role key
is used.

---

## 6. Smoke-test checklist

Backend / security:

- [ ] `supabase db push` applies cleanly on a fresh project.
- [ ] `npm run seed` populates Bukit Bintang; re-running adds **no** duplicates.
- [ ] Creating a pass in the UI returns a `/pass/:hash` and it opens.
- [ ] Opening `/pass/:hash` in a fresh incognito window (no login) works.
- [ ] A random/invalid hash shows "Pass not found" (no data leak).
- [ ] The browser cannot `select` from `venues` / `app_config` directly (RLS).
- [ ] Generating many times quickly eventually returns a 429 (rate limit).

Providers / degradation:

- [ ] With no OpenWeather key, generation still succeeds (neutral weather).
- [ ] With `nim_enabled = false` in `app_config`, generation still succeeds.
- [ ] With `research_enabled = false`, generation still succeeds.

UX (Section 2A.18):

- [ ] Light, dark, and reduced-motion modes look intentional.
- [ ] Flow Dock minimizes on scroll-down and returns on scroll-up / tap.
- [ ] Map pin ↔ timeline selection stays in sync.
- [ ] Browser Back/Forward works; keyboard navigation works.
- [ ] Offline reopening of a recently viewed pass shows a clear state.

---

## Cost & compliance notes

- Prices and opening hours are **estimates** and are labeled as such in the UI.
- Map/POI attribution (OpenStreetMap, OpenFreeMap, Geoapify) is shown in the pass.
- Web research (Tavily) yields **soft signals only**, never hard facts, and only
  normalized signals + source URLs are stored (never article/review bodies).
- NVIDIA NIM is **optional prototype tooling**. Re-check NVIDIA's hosted API
  terms before production and set `nim_enabled = false` if $0 production use is
  not clearly covered.

See `Flow_App_Tech_Spec_v7_1_NIM_Enhanced_Master.md` for the full specification
and `Section 15` there for provider terms to re-check before launch.

## Known limitations / deviations

- Entity resolution for web-discovered venues currently matches against the
  existing seeded catalog by name; unresolved mentions are never recommended
  (spec-compliant). A full Geoapify name+area resolution path is stubbed for a
  future phase and gated by the `consume_geoapify_credits` guard.
- Final routing via Geoapify Routing (Phase 5) uses PostGIS distance estimates
  by default; real route legs can be layered on top for the top sequence when
  `routing_enabled` and quota are healthy.
