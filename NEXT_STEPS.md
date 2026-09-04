# Flow — Your Step-by-Step Checklist

Everything left to do, in order. "[I do this]" = Kiro can run it; you just provide input.

---

## ✅ Already done
- Database schema + RLS + RPCs (ran the combined SQL).
- Anonymous auth enabled.
- 13 Bukit Bintang venues seeded.
- `generate-flow` Edge Function deployed.
- App verified generating real Date Passes.
- Dev server running at http://localhost:5173

---

## 🔐 STEP 1 — Security cleanup (do this soon)

Your service_role key and access token were shared in chat. Rotate them.

1. **Rotate service_role key:** Dashboard → Settings → API → under "Project API keys"
   find `service_role` → there's a "Reset" / "Generate new" option. Generate a new one.
   - After rotating, tell Kiro the new key so it can re-set the Edge Function secret.
2. **Delete the access token:** https://supabase.com/dashboard/account/tokens →
   delete the `flow-deploy` token you created. (Only needed during setup.)
3. Your `.env` only holds the public anon key — that's safe to keep.

---

## 🌦️ STEP 2 — (Optional) Add provider keys for smarter plans

All have free tiers, no card required. Flow works without them. Get any you want,
paste them to Kiro, and Kiro will run `supabase secrets set` for you. [I do this]

- **OpenWeather** (weather-aware planning):
  https://openweathermap.org/api → sign up → API keys tab → copy key.
  (Free "Current + 5-day/3-hour forecast" — NOT the paid One Call.)
- **Geoapify** (live venue discovery):
  https://myprojects.geoapify.com → create project → copy API key.
- **Tavily** (web research signals):
  https://app.tavily.com → sign up → copy API key (Researcher free plan).
- **NVIDIA NIM** (semantic recall + soft reasoning):
  https://build.nvidia.com → sign in → get an API key (`nvapi-...`).

---

## 🌱 STEP 3 — (Optional) Richer plans: expand the seed catalog

More venues = fuller 3-stop sequences. Kiro can add more Bukit Bintang venues to
`scripts/seed-data.ts` and re-run the seed. Just say the word. [I do this]

---

## 🧠 STEP 4 — (Optional) Enable semantic search (needs NVIDIA key from Step 2)

Once the NVIDIA key is set, Kiro will:
1. Deploy `refresh-venue-embeddings`.
2. Add your user ID to `ADMIN_USER_IDS`.
3. Run it once to embed venue profiles into pgvector.
[I do this — you just provide the NVIDIA key]

---

## 🚀 STEP 5 — Deploy the app to the internet (Render, free)

Goal: a public URL anyone can open; share links work for people with no account.

### 5a. Put the code on GitHub
1. Create a new **empty** repo at https://github.com/new (no README).
2. In a terminal in this folder, run (Kiro can do this if you give a repo URL): [I do this]
   ```
   git init
   git add .
   git commit -m "Flow v7.1"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

### 5b. Create the Render Static Site
1. Sign up at https://render.com (free, no card for static sites).
2. **New → Static Site** → connect your GitHub repo.
3. Render auto-reads `render.yaml` (build + publish dir + SPA rewrite are preset).
4. Add these Environment Variables (Settings → Environment):
   - `VITE_SUPABASE_URL` = https://odepmpvuixtexmgncplw.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = sb_publishable_q4OICKlkzPFWC5TCswj02A_zD8sa4Dm
   - `VITE_APP_BASE_URL` = (your Render URL, e.g. https://flow-pwa.onrender.com)
   - `VITE_OPENFREEMAP_STYLE_URL` = https://tiles.openfreemap.org/styles/liberty
5. Deploy. Copy your Render URL.

### 5c. Tell Kiro your Render URL
Kiro updates the Edge Function CORS allow-list so the live site can call the API: [I do this]
```
ALLOWED_ORIGINS = https://<your-render-url>,http://localhost:5173
```

---

## ⏰ STEP 6 — (Optional) Keep-alive so the free DB doesn't pause

In your GitHub repo → Settings → Secrets and variables → Actions → New secret:
- `SUPABASE_URL` = https://odepmpvuixtexmgncplw.supabase.co
- `SUPABASE_ANON_KEY` = sb_publishable_q4OICKlkzPFWC5TCswj02A_zD8sa4Dm

The workflow (`.github/workflows/supabase-keepalive.yml`) then pings 3×/day automatically.

---

## 🎨 STEP 7 — (Optional) Branding polish

- Replace `public/pwa-192.png` and `public/pwa-512.png` with your icons.
- Update the app name/colors in `vite.config.ts` (manifest) and
  `src/styles/index.css` (`--accent`).
[Kiro can do these if you describe what you want]

---

## TL;DR — what to send Kiro next
- The **new service_role key** after you rotate it (Step 1).
- Any **provider keys** you want on (Step 2).
- Your **GitHub repo URL** and/or **Render URL** when you get to Step 5.
- Or just say "expand the seed" / "enable semantic search" and Kiro runs it.
