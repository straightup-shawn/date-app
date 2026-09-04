# Product & Technical Specification: "Flow" — Multi-Stop Date Itinerary PWA
### v7.1 — NIM-Enhanced Smart Research Master Spec (True-Free Core + Optional NVIDIA Intelligence)

> **Verified architecture target:** September 4, 2026  
> **Primary goal of this revision:** keep the v7 research + constraint-planning architecture while adding NVIDIA NIM as an **optional semantic/reasoning accelerator**. Flow should better understand vague human intent and rank semantically relevant places without making hosted NIM a mandatory production dependency. The true-free core must still function at **RM0 / $0 per month** when NIM is disabled, unavailable, rate-limited, or unsuitable for the deployment stage.

---

## Changelog: What Changed in v7.1

v7.1 keeps the complete v7 Smart Research Engine, security model, premium UI, Tavily/Geoapify research pipeline and zero-bill safeguards.

The new layer is **optional NVIDIA NIM intelligence**.

### v7.1 NIM upgrades

1. **Semantic user-intent understanding.** `nvidia/nemotron-3-embed-1b` converts free-form intent and normalized venue profiles into embeddings for semantic retrieval.
2. **Supabase pgvector memory.** Venue embeddings are stored once and reused; unchanged venues are not re-embedded on every request.
3. **Multilingual semantic matching.** The embedding model supports multilingual retrieval, including Malay.
4. **Optional structured reasoning.** `nvidia/nemotron-3.5-lightning-30b-a3b` may translate vague requests or weakly structured research into strict JSON soft-preference signals.
5. **The LLM never becomes the planner.** Time, pax, budget, weather, opening windows, route feasibility and hard constraints remain deterministic.
6. **NIM is never a production single point of failure.** NVIDIA currently describes hosted NIM API access as free for Developer Program members for prototyping; hosted NIM must therefore be feature-flagged and disposable.
7. **No NIM-generated facts.** Reasoning may infer preferences from supplied text but may not invent hours, prices, coordinates, capacity, weather, availability or route times.
8. **Embeddings fail open.** If embedding calls fail, Flow falls back to taxonomy/tags/constraint scoring.
9. **Reasoning fails open.** If chat-completion calls fail, Flow falls back to deterministic parsing/signal extraction.
10. **Server-side key only.** `NVIDIA_API_KEY` never reaches React.
11. **No hidden production-cost assumption.** Before production, re-check NVIDIA's then-current hosted API terms and disable hosted NIM if required.
12. **No giant browser-model dependency.** Local/WebGPU LLM downloads are not required for MVP.

### v7 foundations retained

- Supabase as Flow's memory,
- Geoapify structured discovery,
- Tavily selective web research,
- fact-vs-opinion separation,
- entity resolution,
- graph/constraint sequence solver,
- confidence engine,
- pax-aware budget planning,
- final-route validation,
- complete RLS and secret separation,
- atomic persistence/rate limiting,
- premium Apple-HIG-informed interface,
- true-free degradation paths.

---

## 0. Builder Execution Contract — Read This Before Writing Code

This document is the implementation source of truth for the MVP.

The builder may improve internal code quality, naming, tests, and component boundaries, but must **not silently change product behavior, infrastructure, security posture, or cost model**.

### 0.1 Non-negotiable build rules

1. **Build phase-by-phase in the order defined in Section 11.**
2. **Do not start the next phase until the current phase's acceptance test passes.**
3. **Do not substitute a paid or card-required service** because it is easier to integrate.
4. **Do not introduce a Render Web Service, paid database, Mapbox, paid LLM, paid cron, queue, Redis, or background worker** into the MVP.
5. **Do not expose server secrets to Vite.** Anything prefixed `VITE_` is public by design.
6. **Do not put `SUPABASE_SERVICE_ROLE_KEY`, `OPENWEATHER_API_KEY`, or `GEOAPIFY_API_KEY` in frontend code, localStorage, browser network payloads, or committed files.**
7. **Do not weaken RLS to make development easier.** Fix the request path instead.
8. **Do not grant broad public table writes.** Public/anonymous write actions use narrow RPCs or Edge Functions.
9. **Do not fabricate venue availability, live pricing, ratings, routes, or weather.** Fall back to estimates/cached data and label them honestly.
10. **Do not add features outside MVP scope** until the defined MVP works end-to-end.
11. **Do not redesign Section 2A into a generic SaaS dashboard.** The interaction system is part of the product requirement.
12. **Do not claim a phase is complete from screenshots alone.** Functional acceptance tests and real interaction tests must pass.
13. **Do not web-search on every generation.** Research is a scarce free-tier resource and is triggered by confidence/risk rules.
14. **Do not use search snippets as hard facts.** Web/community evidence affects desirability; structured/current sources control feasibility.
15. **Do not persist full scraped articles, reviews or raw Tavily page bodies.** Persist only normalized signals, source URLs/domains and short-lived evidence metadata needed for traceability.
16. **Do not recommend a web-discovered venue until it is entity-resolved** to a real place with coordinates and sufficient structured data.
17. **Do not exceed the internal research budget.** When live research is unavailable/exhausted, Flow must continue from local knowledge and structured providers.
18. **Do not make NVIDIA NIM mandatory for generation.** Every NIM code path requires a deterministic fallback.
19. **Do not let an LLM decide hard feasibility.** NIM may structure/interpret text; the planner owns time, money, pax, weather, opening-hours and routing.
20. **Do not expose `NVIDIA_API_KEY`.**
21. **Do not assume free hosted NIM is production entitlement.** Re-check NVIDIA terms before production.
22. **Do not re-embed unchanged venues.** Cache embeddings in Supabase and refresh only when the semantic profile/model changes.

### 0.2 When something in the spec is impossible or provider behavior has changed

The builder must:

1. document the exact blocker,
2. point to the affected requirement,
3. propose the smallest zero-cost replacement,
4. preserve the security and UX intent,
5. avoid implementing a paid substitute without product-owner approval.

### 0.3 Required handoff artifacts

The final repository must include at minimum:

```text
README.md
.env.example
render.yaml
package.json
src/
supabase/
  migrations/
  functions/
scripts/
  seed-venues.ts (or equivalent reproducible seeding tool)
.github/
  workflows/
    supabase-keepalive.yml
```

Also include:

- exact local setup instructions,
- exact Supabase setup/migration instructions,
- exact Render deployment instructions,
- exact environment-variable placement,
- a short smoke-test checklist,
- no real secrets committed to Git.

### 0.4 Definition of "builder-ready"

The builder should be able to answer these questions from this document without guessing:

- What runs in the browser?
- What runs in Supabase?
- Which services are allowed?
- Which secrets live where?
- Which tables can the browser read?
- Which writes require a function/RPC?
- How is generation rate-limited?
- What happens when a quota is exhausted?
- What does a Date Pass payload contain?
- What does the premium UI do while scrolling, dragging, loading, failing, and going offline?
- How is the app deployed without a paid server?
- What must pass before moving to the next build phase?

If any of those answers are missing during implementation, treat it as a spec bug to resolve explicitly rather than inventing behavior in code.

---

## 1. Executive Summary

### The Problem
Existing date-planning apps suffer from feature bloat, stale directory data, and "single-user friction" — both partners often need to install an app and build a profile before either sees value. They also tend to treat a date as one isolated destination rather than a planned sequence.

### The Solution
Flow is a Progressive Web App that acts as a **Dynamic Flow Engine**. It creates a curated multi-stop date sequence such as:

**Dinner → Activity → Dessert / Nightcap**

The sequence is optimized for:

- approximate travel distance/time,
- budget,
- occasion,
- time window,
- venue operating hours where known,
- and near-term weather.

The output is a **Date Pass** — a sleek shareable link one person can send via WhatsApp, iMessage, Telegram, etc. The recipient needs no account and no installation.

### MVP Scope
Flow v1 targets **same-day and near-term planning (up to ~48 hours)**, especially:

- “What should we do tonight?”
- “Plan a date for tomorrow evening.”
- “Give us something around Bukit Bintang after dinner.”

Long-range booking, live ticket inventory, AI chat planning and subscriptions are intentionally outside the true-free MVP.

---

## 2. Core User Experience — The Date Pass

### Inputs
The creator selects:

- **Area / Neighborhood** — e.g. Bukit Bintang, Bangsar, TTDI
- **Occasion / Intent** — First Date · Anniversary / Special Occasion · Casual Hangout · Friends / Group Outing
- **Pax** — number of people attending
- **Time Window** — Afternoon · Evening · Late Night
- **Budget** — total or per-person budget in MYR
- **Travel Preference** — Mostly Walkable · Short Grab/Rideshare Allowed
- **Experience Preference** — Food-focused · Activity-focused · Explore · Surprise Me
- optional preferences/exclusions — e.g. mostly indoors, quiet, free/cheap, alcohol-free, no long waits
- optional date/time within the next ~48 hours

### Output
The generated pass shows:

- projected total cost for the selected pax,
- optional per-person estimate,
- 2–4 sequential stops,
- suggested start time and duration for each stop,
- estimated travel distance/time between stops,
- map markers and route context,
- booking/contact links where available,
- weather-adjustment badge if the engine changed an outdoor stop,
- a share button.

### Privacy
Every pass is:

- unlisted by default,
- accessible only through a high-entropy share URL,
- marked `noindex`,
- editable only by its creator.

A future community feed can use explicit opt-in public passes, but it is not required for MVP.

### Planning Intelligence Principle

A normal directory asks:

> "What are good places nearby?"

Flow asks:

> "What sequence of places actually works for these people, at this time, in this weather, within this budget, with realistic travel between stops?"

Therefore:

- a highly recommended venue can still be rejected if it breaks the schedule,
- an individually ordinary venue can be useful if it creates a much better sequence,
- community popularity is a **soft signal**, never a substitute for feasibility,
- uncertainty lowers confidence rather than being silently converted into a fact.

---


## 2A. Premium Interface & Interaction System — Apple-Informed, Not an Apple Clone

Flow should feel **designed**, not generated. The visual target is a quiet, premium, tactile mobile product: strong hierarchy, generous spacing, restrained materials, predictable navigation, and motion that makes the interface easier to understand.

Use Apple's Human Interface Guidelines as a reference for interaction quality — especially hierarchy, floating navigation, materials, motion, touch sizing, and accessibility — but **do not imitate iOS chrome literally** and do not make the web app look like a fake native iPhone screen. Flow needs its own identity.

The core rule is:

> **Content is the product. UI chrome should float above it, get out of the way when appropriate, and return instantly when the user needs it.**

### 2A.1 Design Principles

1. **Content first.** Venue, time, cost, route, and the next action should always outrank decoration.
2. **One clear action per screen state.** Avoid rows of equally loud buttons.
3. **Depth through layering, not decoration.** Use blur/translucency only for floating controls and temporary surfaces; don't turn every card into frosted glass.
4. **Motion explains change.** Animations should show where something came from, where it went, or that an action succeeded. Never animate just because the library makes it easy.
5. **Native-feeling scrolling.** Do not fight the browser's scroll physics with custom scroll-jacking.
6. **Progressive disclosure.** Show the simple answer first; reveal detail on demand.
7. **Consistency beats novelty.** A component must behave the same everywhere it appears.
8. **No hidden critical controls.** UI may minimize, but primary navigation must remain recoverable without guessing.

---

### 2A.2 The Flow Dock — Floating Bottom Navigation

The primary mobile navigation is a **floating capsule dock** above the bottom safe area.

This is inspired by modern iOS floating tab bars, but it is a Flow component — not a copy of the iOS Home Indicator.

#### Expanded state

On initial load, route change, user tap, keyboard dismissal, upward scroll, or pointer/touch movement near the bottom of the viewport, show the full dock.

Recommended mobile geometry:

```text
height:                58–64 px
horizontal inset:      16 px minimum
bottom offset:         max(10px, env(safe-area-inset-bottom))
max width:             420 px
corner radius:         9999 px / full capsule
internal padding:      6–8 px
item touch target:     >= 44 x 44 px
```

The dock should contain **3–4 top-level destinations maximum**. Example MVP information architecture:

```text
Explore     Create     My Passes
```

If a fourth destination becomes genuinely necessary later:

```text
Explore     Create     My Passes     Profile
```

Do not add tabs merely to fill the bar.

Each tab uses:

- one consistent icon family,
- a short text label in the expanded state,
- a stronger active state,
- no emoji icons,
- no mixed icon styles.

Use **Lucide** or another single open-source icon set for the web. Do not mix multiple icon libraries in the same surface.

#### Minimized / resting state

The dock should **minimize rather than fully disappear**.

When the user scrolls downward through content and has not interacted with the dock, compress it into a subtle resting capsule. Do not leave a totally invisible navigation system.

Recommended minimized state:

```text
width:                 52–68 px
height:                28–34 px
opacity:               0.72–0.88
content:               active-tab glyph or subtle Flow mark
bottom offset:         same safe-area rule as expanded dock
```

The minimized capsule expands immediately when the user:

- taps it,
- taps the screen outside a form control,
- starts scrolling upward,
- reaches the top of the current view,
- changes route,
- returns to the app after it regains visibility/focus,
- moves a mouse/trackpad pointer into the lower interaction zone on desktop.

Do **not** minimize while:

- a navigation item has keyboard focus,
- a confirmation/error state is attached to the dock,
- the user is interacting with a bottom sheet,
- VoiceOver / screen-reader focus is in the dock,
- an essential primary action would become ambiguous.

A short inactivity timer may move the already-minimized dock into a quieter opacity state, but should **not remove the final interactive affordance**.

#### Scroll direction behavior

Use intent, not raw pixels:

```text
scroll down > ~24 px accumulated     → minimize
scroll up > ~12 px accumulated       → expand
near top (< ~48 px)                  → expand
route change                          → expand
```

Reset the accumulator when direction changes. This avoids a nervous dock that flickers between states during tiny finger movements.

#### Motion

Use a spring-like transition, but keep it controlled:

```text
expand/minimize duration equivalent: ~220–320 ms
press feedback:                      ~90–140 ms
opacity crossfade:                   ~160–220 ms
```

Prefer `transform` and `opacity` so animations remain compositor-friendly.

The dock must feel attached to the user's gesture, not like an element running an unrelated canned animation.

---

### 2A.3 Floating Material / “Liquid” Layer Rules

Use translucent material only for the **functional control layer**:

- Flow Dock,
- compact top navigation,
- floating map controls,
- temporary contextual action bar,
- modal/bottom-sheet grab area where appropriate.

Do **not** use glass on:

- every venue card,
- every form field,
- normal page backgrounds,
- large blocks of body copy,
- nested cards inside cards.

A good web approximation:

```css
background: color-mix(in srgb, var(--surface) 72%, transparent);
backdrop-filter: blur(22px) saturate(140%);
-webkit-backdrop-filter: blur(22px) saturate(140%);
border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
box-shadow: 0 8px 30px rgba(0,0,0,.10);
```

Treat those values as a starting point, not a reason to make every surface translucent.

If `backdrop-filter` is unavailable, the interface must fall back to an opaque surface with equivalent contrast.

---

### 2A.4 Navigation & Header Behavior

Use a **large contextual title at rest** and a compact title after the user begins scrolling.

Example:

```text
Top of screen:
Good evening
Plan something worth going out for.

After scrolling:
←  Bukit Bintang Tonight            •••
```

The collapse must be continuous and subtle. Avoid a dramatic header shrink.

Rules:

- Back controls remain in the same logical position across screens.
- Do not invent custom gestures for basic Back/Close behavior.
- Keep titles readable; never hide the current context just to maximize map area.
- Use the browser/PWA history correctly so native back gestures/buttons continue to work.

---

### 2A.5 Date Pass Screen — Map + Timeline Choreography

The Date Pass is Flow's hero experience. It should not look like a generic dashboard.

#### Mobile default

Use a layered composition:

```text
┌──────────────────────────────┐
│                              │
│         live map             │
│                              │
│                              │
│        route + pins          │
│                              │
├──────────────────────────────┤
│  draggable content sheet     │
│  Tonight in Bukit Bintang    │
│  RM 128 · 3 stops · 2.1 km   │
│                              │
│  7:00  Dinner                │
│  8:35  Walk / Activity       │
│  9:45  Dessert               │
│                              │
└──────────────────────────────┘
        floating Flow Dock
```

The timeline lives in a **bottom sheet** over the map rather than beside it on small screens.

Recommended sheet snap states:

- **Peek:** enough to show title + summary + first stop.
- **Half:** timeline becomes primary.
- **Full:** venue detail / notes / booking actions.

Keep sheet movement physically coherent with the drag gesture. Never block input while an animation finishes.

Selecting a timeline stop should:

1. emphasize the matching map pin,
2. pan the map just enough to keep the pin visible above the sheet,
3. expand the selected timeline item,
4. avoid resetting the user's entire map zoom unless necessary.

Selecting a map pin performs the reverse relationship and highlights the corresponding timeline stop.

This two-way synchronization is important: it makes the product feel intentionally constructed rather than like a map component and a card list that happen to share data.

---

### 2A.6 Venue Cards

Venue cards should be editorial and calm.

Preferred order:

```text
[image, optional]
7:00 PM · 75 min
Venue Name
Short one-line reason it fits this date
RM 60–80 estimated for your group
12 min walk →
```

Do not display every piece of database metadata just because it exists.

Rules:

- One dominant text line: venue name.
- One supporting line explaining **why this stop is here**.
- That line must come from the persisted `itinerary_stops.fit_reason` snapshot; do not regenerate it in the client.
- Price and travel are concise metadata.
- Booking/contact is a clear button only when actionable.
- Avoid star-rating clutter unless the source is reliable and attribution-compliant.
- Avoid carousel-within-carousel interactions on mobile.

Pressed state:

```text
scale: 0.985–0.99
```

It should feel tactile, not bouncy.

---

### 2A.7 Create Flow — Form Design

Do not make itinerary generation look like an enterprise settings form.

Use a short, progressive sequence with large choices:

```text
Where? → What kind of date? → When? → Budget? → Travel preference? → Generate
```

Prefer:

- segmented controls,
- selectable chips,
- steppers/sliders only where they genuinely improve input,
- smart defaults based on the previous selection,
- one main decision per visual group.

Do not require a full-screen multi-step wizard if the fields fit comfortably on one mobile screen. The goal is low friction, not artificial ceremony.

The Generate action should feel immediate. On press:

1. button acknowledges press immediately,
2. content transitions into a generation state without a blank screen,
3. show lightweight progress language tied to real stages,
4. replace the loading state with the generated pass in-place or via a coherent route transition.

Example progress copy:

```text
Checking the weather…
Finding a strong first stop…
Keeping the next stop nearby…
Putting your night together…
```

Do not show fake percentages.

---

### 2A.8 Motion System

Use Framer Motion sparingly and establish a shared motion language.

#### Motion tokens

```ts
export const motion = {
  press: 0.11,
  fast: 0.18,
  standard: 0.26,
  sheet: 0.34,
}
```

Suggested spring families:

```text
Micro interaction:
responsive, little/no overshoot

Dock / compact surface:
moderately springy, one quick settle

Bottom sheet:
gesture-driven, slightly heavier damping
```

Avoid universal `transition: all`.

Animate only properties that need animation.

#### Approved motion

- dock expand/minimize,
- bottom-sheet snapping,
- selected map/timeline synchronization,
- small pressed states,
- header large → compact transition,
- modal/sheet entry and exit,
- success/error acknowledgement,
- skeleton/content crossfade,
- shared-layout transition from venue summary to venue detail where it materially helps orientation.

#### Avoid

- cards flying in one by one on every page load,
- parallax simply for decoration,
- endless floating blobs,
- glowing buttons,
- animated gradient backgrounds,
- exaggerated elastic bounce,
- multiple unrelated elements moving at once,
- delaying navigation so an animation can finish.

#### Reduced Motion

Honor:

```css
@media (prefers-reduced-motion: reduce)
```

When enabled:

- remove spring/bounce,
- replace travel animations with brief fades,
- stop decorative looping motion,
- preserve all status feedback without relying on movement alone.

---

### 2A.9 Typography

Use the native system stack so the PWA naturally inherits a high-quality platform typeface without shipping proprietary fonts:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Roboto,
  Helvetica,
  Arial,
  sans-serif;
```

Recommended hierarchy:

```text
Display / hero:         30–36 px, 650–700
Screen title:           24–28 px, 650–700
Section title:          18–20 px, 600–650
Body:                   15–17 px, 400–500
Metadata:               13–14 px, 450–550
Micro label:            11–12 px, 550–650
```

Do not use five unrelated font weights on one card.

Avoid very light type on translucent surfaces.

Numbers that need scanning — prices, times, duration — may use tabular numerals.

---

### 2A.10 Spacing, Radius & Layout Tokens

Use a deliberate spacing scale rather than arbitrary Tailwind values everywhere:

```text
space-1   4 px
space-2   8 px
space-3   12 px
space-4   16 px
space-5   20 px
space-6   24 px
space-8   32 px
space-10  40 px
space-12  48 px
```

Preferred radii:

```text
small controls:     10–12 px
cards:              16–20 px
large sheets:       24–30 px
capsules:           9999 px
```

Do not assign a different corner radius to every component.

On narrow phones, default page gutters are **16–20 px**.

On larger mobile/tablet widths, increase breathing room rather than merely stretching cards edge to edge.

---

### 2A.11 Color System

Flow should support **light and dark mode from day one**, defaulting to the user's OS preference.

Use semantic tokens:

```text
--bg
--surface
--surface-elevated
--text-primary
--text-secondary
--text-tertiary
--border
--accent
--accent-contrast
--success
--warning
--danger
```

Keep the brand accent restrained. Most screens should be neutrals + one accent.

Avoid:

- purple-to-blue SaaS gradients by default,
- neon outlines,
- random accent colors for every category,
- low-contrast gray-on-glass typography.

Color cannot be the only indicator of state.

---

### 2A.12 Touch, Pointer & Accessibility Quality Bar

Interactive controls should target **at least 44 × 44 CSS px** on touch screens even if the visible icon is smaller.

Also:

- provide visible keyboard focus states,
- keep adequate spacing between neighboring touch controls,
- provide accessible names for icon-only buttons,
- preserve logical DOM order when visual layers overlap,
- trap focus correctly inside modal dialogs/sheets only when they are truly modal,
- restore focus when a modal closes,
- never encode success/error using color alone,
- use `aria-live` for asynchronous generation status where appropriate,
- make map information available in the timeline/list so the map is not the only way to understand the itinerary.

The app should remain usable at large browser text sizes.

---

### 2A.13 Safe Areas, Mobile Viewport & PWA Details

This is required for the app to feel correct on modern phones.

Use:

```css
padding-bottom: max(16px, env(safe-area-inset-bottom));
padding-top: env(safe-area-inset-top);
```

For full-height layouts prefer modern viewport units:

```css
min-height: 100dvh;
```

Do not blindly use `100vh` for the map or bottom-sheet container on mobile because browser chrome can change the usable viewport.

The Flow Dock must sit **above** the device/browser safe area and must never visually imitate or overlap the OS home indicator.

Use `visualViewport` where necessary to respond to the software keyboard so bottom controls do not get trapped underneath it.

Avoid disabling pinch zoom globally.

---

### 2A.14 Loading, Empty, Offline & Failure States

A polished app is defined as much by its non-happy paths as by its ideal screenshot.

#### Loading

Prefer skeletons/placeholders that preserve the final layout.

Do not replace the whole screen with a centered spinner unless there is truly nothing meaningful to render.

#### Generation failure

Keep the user's inputs and show a human explanation:

```text
Couldn't build a good 3-stop route in this area.

Try allowing a short Grab ride, or choose a nearby area.
```

Never throw raw API errors into the UI.

#### Empty saved passes

Explain the empty state and offer the next action instead of showing an empty card grid.

#### Offline

Because Flow is a PWA:

- cache the application shell,
- cache the most recently opened Date Pass where practical,
- show a clear offline state,
- never pretend live hours/weather were refreshed when offline.

---

### 2A.15 Performance = Design Quality

The app must not only *look* smooth; it must remain smooth on ordinary phones.

Targets for MVP:

- avoid large JavaScript bundles for decorative UI,
- lazy-load map code when the map is actually needed,
- lazy-load venue imagery,
- reserve image dimensions to avoid layout shift,
- use `transform` / `opacity` for frequent animations,
- avoid expensive blur layers stacked on top of each other,
- do not re-render the entire map on every bottom-sheet pixel of movement,
- debounce noncritical scroll listeners or use efficient motion values,
- use route-level code splitting.

A visually simpler 60fps interaction is preferable to a more decorative 25fps interaction.

---

### 2A.16 Anti-“Vibe-Coded” UI Rules

The following are explicit rejection criteria for the frontend.

**Reject the build if it has:**

- arbitrary gradients behind every section,
- multiple competing accent colors,
- excessive glassmorphism,
- every piece of content inside a rounded card,
- cards nested inside cards without hierarchy,
- emoji used as primary UI icons,
- inconsistent icon stroke widths,
- a different radius on every component,
- huge hero text consuming most of a phone screen without useful content,
- unexplained animated blobs,
- fake AI sparkle icons everywhere,
- hover-dependent actions with no touch equivalent,
- tiny icon buttons,
- motion on every component entrance,
- full-page spinners for normal data fetches,
- buttons moving position between loading/success states,
- bottom sheets that fight native scrolling,
- hidden Back navigation,
- map pins disconnected from the timeline state,
- raw API/provider wording shown to users,
- desktop layouts that are simply stretched mobile screens,
- mobile layouts that ignore safe areas,
- controls underneath the browser/home indicator,
- text contrast that depends on blur working perfectly.

**Accept the build when:**

- the hierarchy is obvious within one second,
- the primary action is obvious without being loud,
- spacing feels consistent,
- the interface can be used one-handed,
- scrolling never feels trapped,
- animations are short and interruptible,
- the dock gets out of the way but is always recoverable,
- map and timeline feel like one system,
- dark mode looks intentionally designed rather than color-inverted,
- loading/error/offline states look like part of the product,
- the app remains understandable with animations disabled.

---

### 2A.17 Suggested Frontend Component Architecture

Do not build each screen as one enormous JSX file.

Recommended reusable primitives:

```text
AppShell
├── CollapsingHeader
├── PageTransition
├── FlowDock
│   ├── DockItem
│   └── DockMinimizedState
├── FloatingAction
├── Surface
├── Button
├── IconButton
├── SegmentedControl
├── ChoiceChip
├── Sheet
│   ├── SheetHandle
│   └── SheetSnapRegion
├── Toast
├── Skeleton
├── EmptyState
└── ErrorState

DatePass
├── FlowMap
│   ├── VenuePin
│   ├── RouteLayer
│   └── MapControls
├── DatePassSheet
│   ├── PassSummary
│   ├── Timeline
│   │   └── TimelineStop
│   └── VenueDetail
└── ShareAction
```

Keep visual primitives separate from business/data logic.

The Flow Dock scroll state should live in one reusable controller/hook rather than each route implementing its own hide/show logic.

Suggested hook boundary:

```ts
useFlowDockBehavior({
  scrollContainer,
  disableMinimize,
  routeKey,
})
```

---

### 2A.18 Definition of Done for “Premium & Fluid”

Before calling the UI complete, test at minimum:

- iPhone-sized Safari/PWA viewport,
- Android Chrome viewport,
- desktop Chrome/Safari-sized viewport,
- light mode,
- dark mode,
- reduced-motion mode,
- keyboard-only navigation,
- slow network simulation,
- offline reopening of the last pass,
- software keyboard open on the Create screen,
- long venue names,
- missing venue image,
- 2-stop degraded itinerary,
- 4-stop itinerary,
- map sheet at every snap point,
- fast repeated scroll direction changes,
- dock minimization and restoration,
- browser Back/Forward,
- direct opening of a shared `/pass/:hash` URL.

A screenshot review is not enough. The acceptance review must include real scrolling, tapping, route changes, keyboard appearance, loading and failure states.

### 2A.19 Design References

Use these as principles to re-check during implementation, not as assets to copy:

- Apple HIG — Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Apple HIG — Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple HIG — Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Apple HIG — Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Apple HIG — Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Apple HIG — Toolbars: https://developer.apple.com/design/human-interface-guidelines/toolbars

The goal is **Apple-level restraint and interaction discipline**, not Apple visual cosplay.

---

## 3. True-Free Tech Stack

### 3.1 Frontend

**React + TypeScript + Vite**

Why:

- outputs static files,
- no server runtime is required,
- simpler than forcing Next.js into static-export constraints,
- works cleanly with Render Static Sites,
- React Router can handle `/pass/:hash` through a Render rewrite,
- SEO is not a critical requirement for private/unlisted Date Passes.

**PWA:** `vite-plugin-pwa` / Workbox  
**Styling:** Tailwind CSS  
**Animation:** Framer Motion, used sparingly

### 3.2 Hosting

**Render Static Site — Free**

Do **not** use:

- Render Web Service,
- Render Postgres,
- Render Key Value,
- Render Cron Job.

The frontend is only static HTML/CSS/JS and assets.

Render configuration:

```yaml
services:
  - type: web
    runtime: static
    name: flow-pwa
    buildCommand: npm ci && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

This rewrite allows client-side routes such as:

```text
/pass/xk92jd...
/create
/saved
```

to resolve through the SPA instead of returning a 404 on refresh.

### 3.3 Backend + Database + Auth

**Supabase Free**

Use:

- PostgreSQL
- PostGIS
- Supabase Auth
- Anonymous Sign-In
- Row Level Security
- Edge Functions
- Cron (`pg_cron`)

Current free-plan constraints that should be treated as hard product ceilings:

- 500 MB database size
- 5 GB uncached egress per billing period
- 5 GB cached egress
- 50,000 MAUs
- 500,000 Edge Function invocations
- 1 GB Storage if later needed
- inactive free projects may be paused after roughly one week of low activity

**Important true-free rule:** keep the Supabase organization on the Free plan. Free-plan overages are not a normal pay-as-you-go path; design the app to degrade or stop gracefully before quotas become a scaling problem.

### 3.4 Maps

**MapLibre GL JS + OpenFreeMap public tiles/styles**

Why this replaces Mapbox:

- no API key,
- no registration,
- no map-load billing account,
- no monthly map-view bill,
- MapLibre is open-source,
- OpenFreeMap states its public instance is free with no request/view limits.

Required attribution must remain visible in the map UI.

### 3.5 Venue / POI Data

**Primary runtime source: Supabase `venues` table**

**Catalog seed/refresh source: Geoapify Free**

Geoapify is a good fit for the true-free MVP because:

- 3,000 free credits/day,
- no credit card required to start,
- free plan can be used for commercial projects within its terms/limits,
- caching/storing results is permitted,
- attribution is required on Free.

The key architecture choice is that **Flow does not call Geoapify for every Date Pass generation**.

Instead:

1. seed a focused catalog for supported neighborhoods,
2. store those venue records in Supabase,
3. refresh the catalog periodically or manually,
4. generate most Date Passes entirely from cached Supabase data.

This turns a third-party POI API from a per-user dependency into a low-volume catalog-maintenance tool.

### 3.6 Routing / Travel Time

**MVP default: PostGIS distance filtering + approximate travel estimate**

Avoid calling an isochrone API during normal candidate discovery.

For candidate selection:

- use `ST_DWithin` to find venues within a radius,
- use `ST_Distance` to rank nearby candidates,
- estimate walking time using a conservative walking-speed constant,
- estimate short-drive time using a simple city heuristic.

For the final selected itinerary, **optionally** call Geoapify Routing for 1–3 route legs if quota is healthy.

If routing quota is unavailable, the pass still works using approximate distance/time and opens the user's preferred maps app for turn-by-turn navigation.

### 3.7 Weather

**OpenWeather Free — Current Weather + 5-day/3-hour Forecast**

Do not use the pay-as-you-call One Call product.

The free permanent API currently includes current conditions and a 5-day/3-hour forecast and is sufficient for Flow's ≤48-hour MVP scope.

Cache weather by rounded coordinate / neighborhood and forecast bucket for 15–30 minutes so many users in the same area do not produce duplicate calls.

### 3.8 Live Events

**Manual curated `events` table for v1**

Eventbrite public citywide event discovery is not a dependable public API path for this use case, and SeatGeek is not useful for a Malaysia-first MVP.

For v1:

- maintain 10–50 interesting events manually,
- set start/end times,
- area,
- cost estimate,
- booking URL,
- indoor/outdoor flag,
- expiry time.

An admin can update this table once or twice a week.

---

### 3.9 Live Web Research

**Primary MVP provider: Tavily Search API — Free Researcher plan**

Use live web research to answer questions such as:

- which places repeatedly appear in local recommendations,
- what people describe as romantic / chill / unusual / group-friendly,
- what neighborhood activities are recommended beyond obvious directory categories,
- whether a newly discovered place appears in recent public web recommendations.

Do **not** use Tavily as the authoritative source for:

- current opening hours,
- exact prices,
- coordinates,
- route distance,
- ticket availability,
- weather,
- legal/age restrictions.

Current free-plan architecture target, verified September 2026 and to be re-checked before launch:

```text
Tavily Researcher:
1,000 API credits/month
no credit card required
Basic search: 1 credit
Advanced search: 2 credits
requests stop when monthly credits are exhausted unless the account is upgraded
```

Flow's own default internal cap:

```text
research_monthly_credit_budget = 850
```

This leaves a safety buffer for testing/admin use.

Implement a `WebResearchProvider` interface so the search provider can be swapped later without rewriting the planner. v7 ships with Tavily only. Do not rotate providers/accounts to evade usage limits.

---

### 3.10 Optional NVIDIA NIM Intelligence Layer

NVIDIA NIM is an **enhancement layer**, not core infrastructure.

Current prototype targets:

```text
Hosted API base:
https://integrate.api.nvidia.com/v1

Embedding model:
nvidia/nemotron-3-embed-1b

Optional reasoning model:
nvidia/nemotron-3.5-lightning-30b-a3b
```

NVIDIA's current catalog marks both as hosted **Free Endpoint** options, and NVIDIA's docs describe free Developer Program hosted endpoint access as **for prototyping**.

Therefore:

```text
development / prototype:
NIM may be enabled

production:
re-check current NVIDIA hosted API terms
if $0 production use is not clearly appropriate:
NIM_ENABLED = false
```

Flow must still work.

#### 3.10.1 Embeddings — primary NIM use

Use:

```text
POST /v1/embeddings
model = nvidia/nemotron-3-embed-1b
dimension = 2048
```

Use the correct NVIDIA `input_type`:

```text
venue/index profile → passage
user/request intent → query
```

Use embeddings for semantic recall and similarity only.

Do not use embeddings for factual truth, hours, prices, route time, capacity or weather.

#### 3.10.2 Optional reasoning

Use `nvidia/nemotron-3.5-lightning-30b-a3b` only when deterministic interpretation is weak.

Good use:

```text
"somewhere chill where we can actually talk but not boring"
→ structured soft preference schema

sanitized Tavily evidence
→ normalized recommendation signals
```

Bad use:

```text
"Is it definitely open?"
"How much will 4 people definitely spend?"
"How long is the Grab ride?"
```

Hard facts remain deterministic/current-source driven.

#### 3.10.3 Provider abstraction

```ts
interface SemanticProvider {
  embedQuery(text: string): Promise<number[] | null>
  embedPassages(texts: string[]): Promise<number[][] | null>
}

interface ReasoningProvider {
  structureIntent(input: unknown): Promise<StructuredIntent | null>
  extractResearchSignals(input: unknown): Promise<ResearchSignals | null>
}
```

`null` means "continue without NIM."

---

## 3A. The Zero-Bill Rules

These are engineering constraints, not suggestions.

### Rule 1 — No Render Web Service
The app must never require an always-on Node server on Render.

### Rule 2 — Do not use Render's free Postgres
Render Free Postgres expires after 30 days. Supabase is the only production database for the MVP.

### Rule 3 — Do not attach a payment method to Render during the true-free phase
Render can bill supplementary bandwidth/build usage when a payment method exists. Without a payment method, the desired failure mode is service restriction/suspension rather than surprise billing.

### Rule 4 — No Mapbox
Mapbox has a generous free usage tier, but it is still a metered billing product and requires an account/token. Flow's true-free MVP uses MapLibre + OpenFreeMap instead.

### Rule 5 — No paid LLM
No OpenAI, Anthropic, Gemini paid API, etc. is necessary for MVP generation.

The “intelligence” is a deterministic scoring engine.

### Rule 6 — No per-pass Yelp dependency
Yelp is optional future enrichment only.

### Rule 7 — Cache everything legally cacheable
Particularly:

- Geoapify venue data,
- route estimates where useful,
- weather for short TTLs,
- precomputed neighborhood metadata.

### Rule 8 — Hard fail safely at quotas
If an optional third-party API quota is exhausted:

- do not retry aggressively,
- do not switch to a paid endpoint,
- do not upgrade automatically,
- fall back to cached data / approximate routing / fewer recommendations.

### Rule 9 — Metered free APIs have hard internal ceilings

Track Tavily research credits and Geoapify credits in PostgreSQL. Use conservative internal limits below provider allowances. When the internal monthly budget is exhausted:

- live research stops,
- generation continues from Supabase + Geoapify + weather,
- no PAYG endpoint is enabled,
- no automatic plan upgrade occurs.

### Rule 10 — Hosted NIM is optional prototype intelligence

Required failure mode:

```text
NIM unavailable / rate-limited / disabled / terms unsuitable
→ skip semantic/LLM enhancement
→ use deterministic intent + tags + research signals
→ continue generation
```

Never auto-purchase NVIDIA capacity.

### Rule 11 — One free keep-alive
Use one GitHub Actions workflow a few times per day to run a harmless database request against Supabase so a demo project is less likely to be paused for inactivity. Supabase notes that a few user database requests per day are typically enough to avoid being considered inactive.

Example workflow:

```yaml
name: Supabase Keep Alive

on:
  schedule:
    - cron: '17 1,9,17 * * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping public health RPC
        run: |
          curl --fail --silent --show-error \
            -X POST "$SUPABASE_URL/rest/v1/rpc/health_ping" \
            -H "apikey: $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            -d '{}'
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

The RPC should execute a real lightweight database query, e.g. `select now()`.

---

## 4. Smart Knowledge & Research Architecture

Flow should behave like a small research/planning system, not a thin API wrapper.

### 4.1 Five Knowledge Layers

**Layer A — Flow Knowledge (Supabase)**  
Fastest and cheapest. Contains normalized venues/events Flow already understands.

**Layer B — Structured Place Discovery (Geoapify)**  
Answers: **what real places exist here?** Use when the local candidate pool is thin or a web mention must be resolved.

**Layer C — Live Web Research (Tavily)**  
Answers: **what are public web sources recommending or saying about things to do here?** Search output is evidence, not truth.

**Layer D — Context APIs**  
OpenWeather, selected time/date, known opening hours and optional routing provide hard situational context.

**Layer E — NVIDIA Semantic Intelligence (optional)**  
Embeddings improve semantic recall between free-form human intent and venue profiles. Optional NIM reasoning can structure messy soft intent/research. This layer never overrides hard factual constraints.

**Layer F — Flow First-Party Signals**  
Privacy-minimized aggregate product events such as regenerate, swap, share and outbound click can later improve ranking.

### 4.2 Place Taxonomy

Do not constrain the planner to `Restaurant → Activity → Dessert`.

```text
food
  restaurant · hawker/casual · supper · bakery · dessert

drinks
  cafe · tea · rooftop/lounge · non-alcoholic drinks

activity
  arcade · bowling · karaoke · board games · escape room
  pottery/workshop · sports/leisure · cinema

culture
  museum · gallery · exhibition · bookstore · performance

outdoor
  park · garden · viewpoint · waterfront · scenic walk

explore
  market · neighborhood · landmark · street-art area · attraction

shopping/browse
  mall · design store · market · specialty retail cluster

nightlife
  bar · live music · late-night venue

event
  curated temporary event
```

### 4.3 Facts vs Recommendation Signals

**Hard/factual fields** determine feasibility:

```text
identity · coordinates · address · opening hours
event time · price estimate/confidence · indoor/outdoor
route distance/time · weather
```

**Soft/recommendation fields** determine desirability:

```text
romantic · casual · conversation-friendly · group-friendly
unusual · recommended · photogenic · local-favorite signal
first-date fit · anniversary fit
```

A blog saying "great late-night spot" must never override structured hours showing a 9 PM close.

### 4.4 Semantic Venue Profiles

Each venue may have a concise normalized profile built only from known/derived fields.

Example:

```text
Japanese izakaya in Bukit Bintang.
Indoor evening venue.
Casual but intimate.
Conversation-friendly.
Moderate estimated spend.
Good as a dinner anchor.
```

Include normalized:

- experience families,
- indoor/outdoor state,
- price band,
- pax suitability where known,
- curated vibe tags,
- short normalized research signals,
- area/daypart suitability.

Do not copy full review text.

Store:

```text
semantic_profile
semantic_embedding
embedding_model
embedding_updated_at
```

Re-embed only when the profile/model materially changes.

### 4.5 Semantic Candidate Recall

When enabled:

```text
user soft intent
→ NVIDIA query embedding
→ pgvector similarity against venue passage embeddings
→ top semantic candidates
→ merge with deterministic candidate pool
→ apply all hard filters
```

Semantic similarity can never rescue a closed, impossible, out-of-budget or otherwise hard-invalid venue.

### 4.6 Deterministic Fallback

Without NIM:

```text
experience family
+ vibe tags
+ occasion
+ area
+ first-party aggregate signals
+ hard constraints
```

still produces the plan.

### 4.7 Tavily Query Strategy

Before any search:

1. check `research_enabled`,
2. check internal monthly budget,
3. check per-generation budget,
4. check research query cache,
5. build a focused, non-PII query.

Examples:

```text
"<area> date ideas <experience preference>"
"<area> things to do couples evening"
"<area> hidden gems cafes activities"
"<area> group activities"
"<candidate venue> recommendation <city>"
```

Default:

```text
search_depth = basic
max_results = 5–8
cost = 1 credit
```

Use Advanced only when a clearly defined missing question remains and budget permits the second credit.

### 4.8 Research Evidence Storage

Do not build a scraped-content warehouse.

Persist only:

```text
source_url
source_domain
candidate_venue_id (nullable until resolved)
signal_type
signal_strength
query_fingerprint
observed_at
expires_at
```

Do **not** persist:

- full article bodies,
- full reviews,
- long search snippets,
- copied page text,
- unlicensed images.

Default evidence TTL: **7 days**.

### 4.9 Entity Resolution — Web Mention → Real Place

A web mention is not recommendable yet.

```text
web mention
→ normalize name
→ local venue match
→ if unresolved: Geoapify lookup by name + area
→ compare name/address/coordinates/category
→ canonical venue
→ candidate pool
```

If resolution is ambiguous: **do not recommend it**.

### 4.10 Self-Expanding Knowledge

When research discovers a useful place and structured resolution succeeds:

1. normalize it,
2. deduplicate,
3. upsert into `venues`,
4. attach short-lived research evidence,
5. make it available for future requests.

Supabase becomes Flow's **memory**, not the boundary of discovery.

### 4.11 Research Query Cache

Equivalent research questions reuse recent normalized evidence.

Fingerprint from:

```text
area
experience family
occasion/group context
daypart
important modifiers
```

Do not include raw user identifiers.

A cache hit consumes no new search credit.

### 4.12 Web Source Quality

Prefer recent, independent, locally relevant sources.

Down-rank obvious SEO spam, duplicated/syndicated pages, content farms and stale pages for time-sensitive claims.

Source quality is a ranking heuristic, not a guarantee of truth.

### 4.13 Open Community / Travel Knowledge

Openly licensed sources such as Wikivoyage may supplement neighborhood/attraction context under their applicable license requirements.

Use open travel prose for context/discovery, **not** live opening-hours truth.

---

## 5. Flow Engine — Smart Research & Constraint Solver

*Example: Saturday 6:30–11 PM, Bangsar, 4 pax, RM300 total, casual/fun, short Grab allowed, mostly indoors.*

### Step 1 — Normalize Request

Start with deterministic parsing of explicit inputs.

If the user supplies meaningful free-form text and `nim_reasoning_enabled = true`, NIM may structure **soft preferences only**. Explicit hard constraints always win.

If NIM fails, retain deterministic interpretation.

```json
{
  "neighborhood": "Bangsar",
  "scheduled_for": "2026-09-05T18:30:00+08:00",
  "end_by": "2026-09-05T23:00:00+08:00",
  "pax": 4,
  "occasion": "casual_group",
  "experience_preference": "activity_focused",
  "budget": {"mode": "total", "amount_myr": 300},
  "travel_preference": "short_ride_ok",
  "preferences": ["mostly_indoor"],
  "exclusions": []
}
```

Derive budget/person, available minutes, daypart and required diversity.

### Step 2 — Hard vs Soft Constraints

**Hard:** time window, pax, hard budget ceiling, allowed area expansion, explicit exclusions, known closure, impossible travel time, event timing and explicit indoor/outdoor requirements.

**Soft:** romantic, unusual, conversation-friendly, local-favorite, photogenic, impressive, quiet, activity-heavy, food-heavy, mostly walkable, low-cost/free.

Unknown capacity/price is **uncertainty**, not an automatic reject.

### Step 3 — Semantic Intent Recall (Optional)

If `nim_semantic_enabled = true`:

1. build normalized soft-intent text,
2. request one query embedding,
3. run pgvector similarity search,
4. keep top semantic candidates,
5. merge with taxonomy/area candidates.

Skip this call when the request has no meaningful soft intent or deterministic recall is already sufficient.

### Step 4 — Load Existing Knowledge

Query `venues` + active `events`; merge semantic candidates and apply cheap feasibility filters.

### Step 6 — Initial Knowledge Confidence

Example policy:

```text
knowledge_confidence >= 82
→ skip web research

65–81
→ one Basic Tavily search if budget/cache rules permit

< 65
→ structured discovery + up to two research credits
```

Make thresholds configurable.

### Step 5 — Structured Discovery if Thin

Call Geoapify only when needed, e.g. too few viable candidates, missing experience family, no anchor, no third stop, or unresolved research mentions.

Normalize + dedupe immediately.

### Step 7 — Selective Web Research

Use Basic search first, 5–8 results.

Extract only recommendation signals such as:

```text
romantic · good for groups · quiet · hidden gem
popular date spot · good evening atmosphere
unique activity · local recommendation
```

Do not save raw article/review bodies.

If deterministic signal extraction is weak and `nim_reasoning_enabled = true`, pass only minimum sanitized evidence to NIM and request strict JSON soft signals. Validate schema before use. NIM output remains **soft evidence**.

### Step 8 — Resolve New Mentions

Every useful unknown place goes through local/Geoapify entity resolution. Only canonical real places become candidates.

### Step 9 — Weather Context

Use cached/current OpenWeather forecast to derive rain risk, outdoor suitability, heat discomfort and weather confidence.

### Step 10 — Build Candidate Graph

Nodes are venues/events. Edges estimate straight-line distance, walk/ride time, category transition and schedule compatibility using PostGIS.

### Step 11 — Generate Feasible Sequences

Examples:

```text
Dinner → Arcade → Dessert
Gallery → Dinner → Rooftop
Pottery → Dinner
Market → Cafe → Bookstore → Dinner
Dinner → Live Event → Supper
Cafe → Museum → Scenic Walk
```

Do not force three stops if two is better.

### Step 12 — Schedule Solver

Simulate the **whole outing**:

```text
arrival
minimum useful duration
departure
travel to next
opening-window compatibility
event timing
```

Reject paths that cannot fit.

### Step 13 — Budget Solver

Estimate place/activity costs × pax where appropriate plus optional transport estimate.

Maintain `budget_confidence`.

Unknown prices use conservative category estimates only when configured and must remain visibly estimated.

### Step 14 — Score Complete Sequences

Require feasibility first, then score:

```text
vibe_match          17%
budget_quality      14%
schedule_quality    16%
travel_quality      14%
community_signal    10%
place_quality        9%
weather_fit          8%
variety              8%
novelty              4%
```

Weights live in configuration.

### Step 15 — Final Route Validation

Route-check top 1–3 sequences when free routing credits are healthy, then re-run schedule feasibility.

If unavailable, use conservative PostGIS estimates and lower routing confidence.

### Step 16 — Confidence Engine

Calculate:

```text
venue_fact_confidence
schedule_confidence
budget_confidence
community_confidence
weather_confidence
routing_confidence
overall_confidence
```

Policy:

```text
overall >= 82
→ present normally

65–81
→ present with estimate/verify labels
   or spend one remaining research step if useful

< 65
→ don't fake confidence
```

Low confidence should return the smallest useful relaxation:

```text
"Allow a 10-minute ride"
"Start 30 minutes earlier"
"Increase the total budget by about RM40"
"Try the neighboring area"
```

### Step 17 — Persist Stable Date Pass

Snapshot pax, constraints, total/per-person estimate, weather, confidence, stops, fit reasons and routes atomically.

### Step 18 — Learn from Aggregate First-Party Signals

Record:

```text
generated · regenerated · stop_swapped
saved · shared · outbound_clicked
```

MVP uses aggregate counts only; no individual behavioral profile.

---

## 6. Database Schema — Supabase PostgreSQL

This version uses Supabase Auth directly. There is no custom `users` table required for MVP ownership.

```sql
create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ============================================================
-- VENUES
-- Persisted catalog. Geoapify-sourced data may be cached/stored,
-- making it suitable as the primary runtime data source.
-- ============================================================
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  external_id text,
  source text not null check (source in ('geoapify', 'manual', 'partner')),
  name text not null,
  neighborhood text not null,
  categories text[] not null default '{}',
  address text,
  coordinates geography(point, 4326) not null,
  price_bucket smallint,
  est_cost_total integer,
  rating numeric,
  opening_hours jsonb,
  booking_url text,
  website_url text,
  indoor boolean,
  outdoor boolean,
  experience_families text[] not null default '{}',
  vibe_tags text[] not null default '{}',
  semantic_profile text,
  semantic_embedding vector(2048),
  embedding_model text,
  embedding_updated_at timestamptz,
  pax_min smallint,
  pax_max smallint,
  price_confidence smallint not null default 30,
  hours_confidence smallint not null default 30,
  data_quality smallint not null default 50,
  is_active boolean not null default true,
  source_attribution text,
  source_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

create index venues_coordinates_gix
  on public.venues using gist (coordinates);

create index venues_neighborhood_idx
  on public.venues (neighborhood);

-- At MVP scale, exact pgvector search is acceptable.
-- Add HNSW/IVFFlat only after measuring a real need.

-- ============================================================
-- CURATED EVENTS
-- ============================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue_id uuid references public.venues(id),
  neighborhood text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  est_cost_total integer,
  booking_url text,
  indoor boolean,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- WEATHER CACHE
-- ============================================================
create table public.weather_cache (
  cache_key text primary key,
  neighborhood text,
  forecast_for timestamptz,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ============================================================
-- DATE PASSES
-- creator_id is Supabase auth.users.id, including anonymous users.
-- ============================================================
create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  share_hash text unique not null,
  title text,
  neighborhood text not null,
  occasion text,
  time_window text,
  travel_preference text,
  experience_preference text,
  pax smallint not null default 2 check (pax between 1 and 20),
  budget_mode text not null default 'total' check (budget_mode in ('total','per_person')),
  budget_myr integer,
  total_budget_estimate integer,
  per_person_budget_estimate integer,
  constraints_snapshot jsonb,
  scheduled_for timestamptz,
  end_by timestamptz,
  weather_snapshot jsonb,
  overall_confidence smallint check (overall_confidence between 0 and 100),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index itineraries_creator_idx
  on public.itineraries (creator_id);

create index itineraries_share_hash_idx
  on public.itineraries (share_hash);

-- ============================================================
-- SNAPSHOT STOPS
-- Name/address/coordinates are snapshotted so old passes remain stable
-- even if the venue catalog changes.
-- ============================================================
create table public.itinerary_stops (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  venue_id uuid references public.venues(id),
  stop_order smallint not null,
  venue_name text not null,
  venue_address text,
  coordinates geography(point, 4326) not null,
  category text,
  fit_reason text not null,
  fact_confidence smallint,
  community_confidence smallint,
  scheduled_time time,
  duration_minutes integer,
  est_cost_total integer,
  transit_mode text,
  transit_time_mins integer,
  transit_distance_meters integer,
  route_geojson jsonb,
  booking_url text,
  created_at timestamptz not null default now(),
  unique (itinerary_id, stop_order)
);

-- ============================================================
-- CLICK EVENTS
-- ============================================================
create table public.stop_click_events (
  id bigint generated always as identity primary key,
  stop_id uuid not null references public.itinerary_stops(id) on delete cascade,
  destination text,
  clicked_at timestamptz not null default now()
);

-- ============================================================
-- RESEARCH EVIDENCE
-- Short-lived normalized evidence. Never store full articles/reviews.
-- ============================================================
create table public.research_evidence (
  id bigint generated always as identity primary key,
  venue_id uuid references public.venues(id) on delete cascade,
  source_url text not null,
  source_domain text,
  signal_type text not null,
  signal_strength smallint not null default 50,
  query_fingerprint text not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index research_evidence_venue_idx
  on public.research_evidence (venue_id);

create index research_evidence_expiry_idx
  on public.research_evidence (expires_at);

-- ============================================================
-- RESEARCH QUERY CACHE
-- Normalized derived signals only; no raw article/review bodies.
-- ============================================================
create table public.research_query_cache (
  query_fingerprint text primary key,
  normalized_signals jsonb not null,
  source_urls jsonb not null default '[]'::jsonb,
  credits_used smallint not null default 0,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ============================================================
-- RESEARCH CREDIT USAGE
-- Internal free-search budget guard.
-- ============================================================
create table public.research_credit_usage (
  month_start date primary key,
  credits_used integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- GEOAPIFY CREDIT USAGE
-- Conservative internal daily guard below the provider allowance.
-- ============================================================
create table public.geoapify_credit_usage (
  usage_date date primary key,
  credits_used integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCT SIGNAL EVENTS
-- Privacy-minimized aggregate learning hooks.
-- ============================================================
create table public.pass_signal_events (
  id bigint generated always as identity primary key,
  itinerary_id uuid references public.itineraries(id) on delete cascade,
  stop_id uuid references public.itinerary_stops(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'generated',
      'regenerated',
      'stop_swapped',
      'saved',
      'shared',
      'outbound_clicked'
    )
  ),
  created_at timestamptz not null default now()
);

-- ============================================================
-- GENERATION RATE BUCKETS
-- Internal server-side counters. Never expose this table directly
-- to the browser.
-- ============================================================
create table public.generation_rate_buckets (
  scope text not null check (scope in ('user_hour', 'global_minute')),
  bucket_start timestamptz not null,
  bucket_key text not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, bucket_start, bucket_key)
);

create index generation_rate_buckets_updated_idx
  on public.generation_rate_buckets (updated_at);
```

### 6.1 RLS + Database Privilege Model

The browser uses the **public anon key**. The anon key is not a secret; security comes from RLS, narrow grants, and server-side functions.

The browser must **not** receive broad read/write access to internal catalog/cache/configuration tables.

Enable RLS on all application tables:

```sql
alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.weather_cache enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_stops enable row level security;
alter table public.stop_click_events enable row level security;
alter table public.research_evidence enable row level security;
alter table public.research_query_cache enable row level security;
alter table public.research_credit_usage enable row level security;
alter table public.geoapify_credit_usage enable row level security;
alter table public.pass_signal_events enable row level security;
alter table public.generation_rate_buckets enable row level security;
```

When `app_config` is created in Section 12, enable RLS on it too.

### 6.1.1 Browser-readable owner data

Authenticated users — including Supabase anonymous users — may read only their own passes:

```sql
create policy "creator can select own itineraries"
on public.itineraries
for select
to authenticated
using (creator_id = auth.uid());

create policy "creator can select own stops"
on public.itinerary_stops
for select
to authenticated
using (
  exists (
    select 1
    from public.itineraries i
    where i.id = itinerary_stops.itinerary_id
      and i.creator_id = auth.uid()
  )
);
```

### 6.1.2 Writes go through server-controlled paths

For the MVP:

- `generate-flow` creates itineraries and stops.
- a future explicit "edit pass" feature should use a narrow Edge Function or RPC,
- public outbound click tracking uses `record_stop_click`,
- the browser does not directly INSERT/UPDATE/DELETE venue, event, weather, config, rate-limit, itinerary-stop, or click rows.

Revoke broad client privileges, then grant back only what is needed:

```sql
revoke all on table public.venues from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.weather_cache from anon, authenticated;
revoke all on table public.stop_click_events from anon, authenticated;
revoke all on table public.research_evidence from anon, authenticated;
revoke all on table public.research_query_cache from anon, authenticated;
revoke all on table public.research_credit_usage from anon, authenticated;
revoke all on table public.geoapify_credit_usage from anon, authenticated;
revoke all on table public.pass_signal_events from anon, authenticated;
revoke all on table public.generation_rate_buckets from anon, authenticated;

revoke insert, update, delete on table public.itineraries from anon, authenticated;
revoke insert, update, delete on table public.itinerary_stops from anon, authenticated;

grant select on table public.itineraries to authenticated;
grant select on table public.itinerary_stops to authenticated;
```

Do not solve a permission error by granting `anon` full table access.

### 6.2 Semantic Venue Match RPC

The browser never queries raw vectors directly.

```sql
create or replace function public.match_venues_semantic(
  p_query_embedding vector(2048),
  p_neighborhood text,
  p_match_count integer default 20
)
returns table (
  venue_id uuid,
  similarity double precision
)
language sql
security definer
set search_path = public
stable
as $$
  select
    v.id,
    1 - (v.semantic_embedding <=> p_query_embedding) as similarity
  from public.venues v
  where v.is_active = true
    and v.semantic_embedding is not null
    and (p_neighborhood is null or v.neighborhood = p_neighborhood)
  order by v.semantic_embedding <=> p_query_embedding
  limit greatest(1, least(p_match_count, 50));
$$;

revoke all on function public.match_venues_semantic(vector, text, integer) from public;
grant execute on function public.match_venues_semantic(vector, text, integer) to service_role;
```

This retrieves candidates only. Hard filters run afterwards.

### 6.3 Public Share RPC — Complete Date Pass Payload


Public recipients need to open `/pass/:hash` without creating an account.

Do **not** grant broad anonymous SELECT access to itinerary tables.

Create one narrow RPC that returns only the Date Pass matching a high-entropy share hash.

It must return everything the Date Pass UI needs, including:

- summary,
- weather snapshot,
- each stop's fit reason,
- latitude/longitude,
- route geometry where available,
- booking URL,
- timing and cost metadata.

```sql
create or replace function public.get_date_pass(p_share_hash text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', i.id,
    'title', i.title,
    'neighborhood', i.neighborhood,
    'occasion', i.occasion,
    'time_window', i.time_window,
    'travel_preference', i.travel_preference,
    'experience_preference', i.experience_preference,
    'pax', i.pax,
    'budget_mode', i.budget_mode,
    'budget_myr', i.budget_myr,
    'scheduled_for', i.scheduled_for,
    'end_by', i.end_by,
    'total_budget_estimate', i.total_budget_estimate,
    'per_person_budget_estimate', i.per_person_budget_estimate,
    'overall_confidence', i.overall_confidence,
    'weather_snapshot', i.weather_snapshot,
    'stops', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'stop_order', s.stop_order,
          'venue_name', s.venue_name,
          'venue_address', s.venue_address,
          'category', s.category,
          'fit_reason', s.fit_reason,
          'fact_confidence', s.fact_confidence,
          'community_confidence', s.community_confidence,
          'scheduled_time', s.scheduled_time,
          'duration_minutes', s.duration_minutes,
          'est_cost_total', s.est_cost_total,
          'transit_mode', s.transit_mode,
          'transit_time_mins', s.transit_time_mins,
          'transit_distance_meters', s.transit_distance_meters,
          'coordinates', jsonb_build_object(
            'lat', st_y(s.coordinates::geometry),
            'lng', st_x(s.coordinates::geometry)
          ),
          'route_geojson',
            case
              when s.route_geojson is null then null
              else s.route_geojson
            end,
          'booking_url', s.booking_url
        )
        order by s.stop_order
      )
      from public.itinerary_stops s
      where s.itinerary_id = i.id
    ), '[]'::jsonb)
  )
  from public.itineraries i
  where i.share_hash = p_share_hash
  limit 1;
$$;

revoke all on function public.get_date_pass(text) from public;
grant execute on function public.get_date_pass(text) to anon, authenticated;
```

The function must return `null` for an unknown hash rather than leaking whether another private row exists.

### 6.4 Anonymous Auth

On first visit to the creator flow:

```ts
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}
```

This creates a real Supabase Auth user without asking for email/password.

The browser then sends the normal Supabase access token to `generate-flow`.

Later, the same identity may be upgraded to a permanent account if that feature is added.

### 6.5 Atomic Generation Rate Limiter

The configuration in Section 12 must be enforced, not merely displayed.

Use PostgreSQL as the single source of truth so multiple Edge Function instances cannot independently exceed the intended limit.

```sql
create or replace function public.consume_generation_quota(
  p_user_id uuid,
  p_user_hour_limit integer,
  p_global_minute_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_count integer;
  v_global_count integer;
  v_hour timestamptz := date_trunc('hour', now());
  v_minute timestamptz := date_trunc('minute', now());
begin
  insert into public.generation_rate_buckets
    (scope, bucket_start, bucket_key, request_count, updated_at)
  values
    ('user_hour', v_hour, p_user_id::text, 1, now())
  on conflict (scope, bucket_start, bucket_key)
  do update
    set request_count = generation_rate_buckets.request_count + 1,
        updated_at = now()
  returning request_count into v_user_count;

  if v_user_count > p_user_hour_limit then
    raise exception 'FLOW_RATE_LIMIT_USER';
  end if;

  insert into public.generation_rate_buckets
    (scope, bucket_start, bucket_key, request_count, updated_at)
  values
    ('global_minute', v_minute, '*', 1, now())
  on conflict (scope, bucket_start, bucket_key)
  do update
    set request_count = generation_rate_buckets.request_count + 1,
        updated_at = now()
  returning request_count into v_global_count;

  if v_global_count > p_global_minute_limit then
    raise exception 'FLOW_RATE_LIMIT_GLOBAL';
  end if;
end;
$$;

revoke all on function public.consume_generation_quota(uuid, integer, integer) from public;
grant execute on function public.consume_generation_quota(uuid, integer, integer) to service_role;
```

Because both counters are updated inside one database transaction, raising either limit exception rolls the attempt back.

`generate-flow` must:

1. authenticate the user,
2. read the configured limits,
3. call `consume_generation_quota`,
4. only then perform weather/routing work.

Map database exceptions to user-safe HTTP responses:

```text
FLOW_RATE_LIMIT_USER   → 429 "You've generated several plans recently. Try again a little later."
FLOW_RATE_LIMIT_GLOBAL → 503 "Flow is busy right now. Try again shortly."
```

Never show the internal exception name in production UI.

### 6.6 Atomic Research Credit Guard

Never rely only on the provider dashboard.

```sql
create or replace function public.consume_research_credits(
  p_credits integer,
  p_monthly_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
  v_used integer;
begin
  if p_credits < 1 or p_credits > 2 then
    raise exception 'FLOW_RESEARCH_INVALID_CREDIT_COST';
  end if;

  insert into public.research_credit_usage (
    month_start, credits_used, updated_at
  )
  values (v_month, p_credits, now())
  on conflict (month_start)
  do update
    set credits_used = research_credit_usage.credits_used + p_credits,
        updated_at = now()
  returning credits_used into v_used;

  if v_used > p_monthly_limit then
    raise exception 'FLOW_RESEARCH_BUDGET_EXHAUSTED';
  end if;
end;
$$;

revoke all on function public.consume_research_credits(integer, integer) from public;
grant execute on function public.consume_research_credits(integer, integer) to service_role;
```

The exception rolls the increment back.

Call this immediately before the Tavily provider request. Keep a conservative safety buffer rather than trying to spend the provider allowance down to exactly zero.

### 6.7 Atomic Geoapify Daily Credit Guard

Geoapify's free plan is also metered, so Flow must keep its own conservative daily ceiling.

Default:

```text
geoapify_daily_credit_budget = 2500
```

This intentionally stays below the provider's current 3,000-credit/day free allowance.

```sql
create or replace function public.consume_geoapify_credits(
  p_credits integer,
  p_daily_limit integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := current_date;
  v_used integer;
begin
  if p_credits < 1 or p_credits > 100 then
    raise exception 'FLOW_GEOAPIFY_INVALID_CREDIT_COST';
  end if;

  insert into public.geoapify_credit_usage (
    usage_date, credits_used, updated_at
  )
  values (v_day, p_credits, now())
  on conflict (usage_date)
  do update
    set credits_used = geoapify_credit_usage.credits_used + p_credits,
        updated_at = now()
  returning credits_used into v_used;

  if v_used > p_daily_limit then
    raise exception 'FLOW_GEOAPIFY_BUDGET_EXHAUSTED';
  end if;
end;
$$;

revoke all on function public.consume_geoapify_credits(integer, integer) from public;
grant execute on function public.consume_geoapify_credits(integer, integer) to service_role;
```

The caller must conservatively estimate the request's credit cost from the documented Geoapify pricing model before the provider call.

When the guard rejects a call:

- structured discovery falls back to existing Flow knowledge,
- route validation falls back to PostGIS estimates,
- generation does not fail solely because Geoapify is unavailable.

### 6.8 Transactional Date Pass Persistence

Do not let the Edge Function create the itinerary row and then perform several unrelated REST inserts for stops. If the function crashes between writes, the database could contain a pass with missing stops.

Persist the generated itinerary and all snapshot stops through **one PostgreSQL function call**, so success/failure is atomic.

```sql
create or replace function public.persist_generated_pass(
  p_creator_id uuid,
  p_share_hash text,
  p_title text,
  p_neighborhood text,
  p_occasion text,
  p_time_window text,
  p_travel_preference text,
  p_experience_preference text,
  p_pax smallint,
  p_budget_mode text,
  p_budget_myr integer,
  p_total_budget_estimate integer,
  p_per_person_budget_estimate integer,
  p_constraints_snapshot jsonb,
  p_scheduled_for timestamptz,
  p_end_by timestamptz,
  p_weather_snapshot jsonb,
  p_overall_confidence smallint,
  p_stops jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_itinerary_id uuid;
  v_stop jsonb;
  v_stop_count integer;
begin
  if p_creator_id is null then
    raise exception 'missing creator';
  end if;

  if not exists (
    select 1 from auth.users where id = p_creator_id
  ) then
    raise exception 'unknown creator';
  end if;

  if p_pax < 1 or p_pax > 20 then
    raise exception 'invalid pax';
  end if;

  if p_budget_mode not in ('total', 'per_person') then
    raise exception 'invalid budget mode';
  end if;

  if jsonb_typeof(p_stops) <> 'array' then
    raise exception 'stops must be an array';
  end if;

  v_stop_count := jsonb_array_length(p_stops);

  if v_stop_count < 2 or v_stop_count > 4 then
    raise exception 'invalid stop count';
  end if;

  insert into public.itineraries (
    creator_id,
    share_hash,
    title,
    neighborhood,
    occasion,
    time_window,
    travel_preference,
    experience_preference,
    pax,
    budget_mode,
    budget_myr,
    total_budget_estimate,
    per_person_budget_estimate,
    constraints_snapshot,
    scheduled_for,
    end_by,
    weather_snapshot,
    overall_confidence
  )
  values (
    p_creator_id,
    p_share_hash,
    p_title,
    p_neighborhood,
    p_occasion,
    p_time_window,
    p_travel_preference,
    p_experience_preference,
    p_pax,
    p_budget_mode,
    p_budget_myr,
    p_total_budget_estimate,
    p_per_person_budget_estimate,
    p_constraints_snapshot,
    p_scheduled_for,
    p_end_by,
    p_weather_snapshot,
    p_overall_confidence
  )
  returning id into v_itinerary_id;

  for v_stop in
    select value from jsonb_array_elements(p_stops)
  loop
    insert into public.itinerary_stops (
      itinerary_id,
      venue_id,
      stop_order,
      venue_name,
      venue_address,
      coordinates,
      category,
      fit_reason,
      fact_confidence,
      community_confidence,
      scheduled_time,
      duration_minutes,
      est_cost_total,
      transit_mode,
      transit_time_mins,
      transit_distance_meters,
      route_geojson,
      booking_url
    )
    values (
      v_itinerary_id,
      nullif(v_stop->>'venue_id', '')::uuid,
      (v_stop->>'stop_order')::smallint,
      v_stop->>'venue_name',
      nullif(v_stop->>'venue_address', ''),
      st_setsrid(
        st_makepoint(
          (v_stop->'coordinates'->>'lng')::double precision,
          (v_stop->'coordinates'->>'lat')::double precision
        ),
        4326
      )::geography,
      nullif(v_stop->>'category', ''),
      v_stop->>'fit_reason',
      nullif(v_stop->>'fact_confidence', '')::smallint,
      nullif(v_stop->>'community_confidence', '')::smallint,
      nullif(v_stop->>'scheduled_time', '')::time,
      nullif(v_stop->>'duration_minutes', '')::integer,
      nullif(v_stop->>'est_cost_total', '')::integer,
      nullif(v_stop->>'transit_mode', ''),
      nullif(v_stop->>'transit_time_mins', '')::integer,
      nullif(v_stop->>'transit_distance_meters', '')::integer,
      v_stop->'route_geojson',
      nullif(v_stop->>'booking_url', '')
    );
  end loop;

  return v_itinerary_id;
end;
$$;

revoke all on function public.persist_generated_pass(
  uuid, text, text, text, text, text, text, text, smallint, text,
  integer, integer, integer, jsonb, timestamptz, timestamptz,
  jsonb, smallint, jsonb
) from public;

grant execute on function public.persist_generated_pass(
  uuid, text, text, text, text, text, text, text, smallint, text,
  integer, integer, integer, jsonb, timestamptz, timestamptz,
  jsonb, smallint, jsonb
) to service_role;
```

The Edge Function must construct the entire final snapshot first, then call `persist_generated_pass()` once.

If the generated `share_hash` collides with the unique constraint, generate a fresh cryptographically strong token and retry the **persistence call only**. Do not repeat weather/routing/API work.

The function transaction ensures that either:

```text
itinerary + every stop exists
```

or:

```text
nothing is persisted
```

There must be no half-created public pass.

### 6.9 Click Tracking RPC

Do not grant public INSERT access to `stop_click_events`.

Use a narrow function:

```sql
create or replace function public.record_stop_click(
  p_stop_id uuid,
  p_destination text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_destination is null
     or char_length(p_destination) < 1
     or char_length(p_destination) > 80 then
    raise exception 'invalid destination';
  end if;

  if not exists (
    select 1
    from public.itinerary_stops
    where id = p_stop_id
  ) then
    raise exception 'unknown stop';
  end if;

  insert into public.stop_click_events (stop_id, destination)
  values (p_stop_id, p_destination);
end;
$$;

revoke all on function public.record_stop_click(uuid, text) from public;
grant execute on function public.record_stop_click(uuid, text) to anon, authenticated;
```

This endpoint is analytics, not authorization. Never block navigation if click tracking fails.

### 6.10 Internal Table Access Rule

`venues`, `events`, `weather_cache`, `research_evidence`, `research_query_cache`, `research_credit_usage`, `geoapify_credit_usage`, `pass_signal_events`, `app_config`, and `generation_rate_buckets` are server-side implementation tables.

Normal browser code should not query them directly.

Edge Functions that need server-only access may create a Supabase client using the service-role key **inside the Edge Function runtime only**.

The service-role key bypasses RLS. Treat it as production infrastructure credentials.


---

## 7. Edge Functions

Keep functions small and boring.

### `generate-flow`

Responsibilities:

1. authenticate caller and validate allowed origin,
2. normalize pax, budget mode, timing and constraints,
3. enforce generation rate limit,
4. load app/research budget configuration,
5. load existing venue/event knowledge,
6. compute initial knowledge confidence,
7. call Geoapify discovery only if structured coverage is insufficient,
8. check research query cache,
9. selectively call Tavily only when research rules trigger,
10. resolve web-discovered place mentions to canonical structured venues,
11. read/update weather context,
12. build candidate graph,
13. generate and schedule feasible sequences,
14. solve budget for selected pax,
15. score full sequences,
16. optionally route-check top sequences,
17. calculate confidence dimensions,
18. optionally use NIM reasoning for weak soft-intent/research structuring,
19. generate deterministic `fit_reason` from validated facts/signals,
20. persist itinerary + snapshots atomically,
21. return `share_hash`, confidence metadata and any useful constraint-relaxation suggestion.

The generated `fit_reason` is deterministic copy assembled from known attributes — not LLM text. Examples:

```text
"Good first stop: casual, indoors, and comfortably within budget."
"Adds a low-pressure activity only a short walk from dinner."
"Late-night dessert nearby, so the date ends without another long transfer."
```

Do not fabricate facts that are not present in the venue/catalog/weather inputs.

Do **not**:

- call an LLM,
- scrape websites,
- fan out to several paid APIs,
- generate images,
- run background workers,
- use the service-role key in the browser,
- use `Access-Control-Allow-Origin: *` on authenticated write-capable functions in production,
- retry rate-limited third-party APIs in a tight loop.

### Edge Function client split

Use two Supabase clients inside functions when necessary:

```text
user client
→ initialized with the caller's Authorization header
→ used when the function needs auth.uid()-scoped behavior

service client
→ initialized with SUPABASE_SERVICE_ROLE_KEY
→ server runtime only
→ used for internal catalog/cache/config/rate-limit writes
```

Never return the service-role key or server API keys in response bodies, logs, or error messages.

### `semantic-intelligence` — Internal NIM Provider Module

Not a public endpoint.

Responsibilities:

- call `nvidia/nemotron-3-embed-1b`,
- `input_type=query` for user intent,
- `input_type=passage` for venue profiles,
- validate 2048-dimensional vectors,
- call `match_venues_semantic`,
- fail open on timeout/rate-limit/provider error,
- never expose NVIDIA credentials.

Suggested timeout:

```text
embedding: 8 seconds
reasoning: 15 seconds
```

### `nim-reasoning` — Optional Internal Module

Use `nvidia/nemotron-3.5-lightning-30b-a3b`.

Every call must:

1. pass minimum required text,
2. distinguish supplied facts from requested inference,
3. require strict structured JSON,
4. prohibit inventing missing facts,
5. validate output before use.

Do not store chain-of-thought/reasoning traces. If the API emits separate reasoning content, discard it from application storage.

### `research-places` — Internal Module / Function Boundary

This may live inside `generate-flow`; it does not need to be a public endpoint.

```ts
type ResearchRequest = {
  area: string
  queryFingerprint: string
  query: string
  maxCredits: 1 | 2
}

type ResearchSignal = {
  sourceUrl: string
  sourceDomain?: string
  mentionedName?: string
  signalType: string
  signalStrength: number
}

type ResearchResponse = {
  cacheHit: boolean
  creditsUsed: number
  signals: ResearchSignal[]
}
```

Rules:

- Tavily key stays server-side,
- Basic search first,
- 5–8 results by default,
- no raw-content persistence,
- deduplicate syndicated/duplicate sources,
- entity resolution is mandatory before recommendation,
- provider failure becomes `research unavailable`, not generation failure.

### `refresh-venue-area` — Optional Admin Function

An admin-only function may:

- fetch a limited number of Geoapify records,
- normalize them,
- upsert them into `venues`.

This function is not invoked by normal users.

---


### `refresh-venue-embeddings` — Admin/Batch Function

Run after venue seed/refresh or semantic-profile changes.

```text
find venues where:
semantic_profile exists
AND (
  embedding missing
  OR embedding_model changed
  OR embedding_updated_at < updated_at
)

batch profiles
→ NVIDIA passage embeddings
→ validate 2048 dimensions
→ update embedding + model + timestamp
```

Do not run this on every generation.

If NIM is disabled, leave embeddings stale/missing and use deterministic ranking.

---

## 7A. Environment Variables, Secrets & CORS

The builder must include a committed `.env.example` containing names only — never real secret values.

### 7A.1 Vite / browser environment

These values are intentionally public:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_BASE_URL=
VITE_OPENFREEMAP_STYLE_URL=
```

Rules:

- anything prefixed `VITE_` is bundled into browser JavaScript,
- never place a service-role key or third-party private API key behind a `VITE_` prefix,
- the Supabase anon key is safe to expose only because RLS/privileges are correctly configured.

### 7A.2 Supabase Edge Function secrets

Store with Supabase secrets, never in the frontend:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENWEATHER_API_KEY=
GEOAPIFY_API_KEY=
TAVILY_API_KEY=
NVIDIA_API_KEY=
NVIDIA_API_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_EMBED_MODEL=nvidia/nemotron-3-embed-1b
NVIDIA_REASONING_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
APP_BASE_URL=
ALLOWED_ORIGINS=
ADMIN_USER_IDS=
```

`ALLOWED_ORIGINS` should be an explicit comma-separated allow-list, e.g.:

```text
https://flow.example,https://www.flow.example,http://localhost:5173
```

Production authenticated functions must not default to wildcard CORS.

### 7A.3 GitHub Actions secrets

For the keep-alive workflow:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

No service-role key is required for keep-alive.

### 7A.4 Secret ownership table

| Value | Browser/Vite | Edge Function | GitHub Actions | Safe to commit |
|---|---:|---:|---:|---:|
| Supabase URL | Yes | Yes | Yes | In `.env.example` as blank name only |
| Supabase anon key | Yes | Yes | Yes | No real value |
| Supabase service-role key | **Never** | Yes | No | **Never** |
| OpenWeather API key | **Never** | Yes | No | **Never** |
| Geoapify API key | **Never** | Yes | No | **Never** |
| Tavily API key | **Never** | Yes | No | **Never** |
| NVIDIA API key | **Never** | Yes | No | **Never** |
| OpenFreeMap style URL | Yes | Optional | No | Yes if it contains no secret |
| Allowed origins | No need | Yes | No | Example values only |

### 7A.5 Logging rules

Production logs may contain:

- request ID,
- anonymous user UUID,
- phase/stage name,
- provider status code,
- latency,
- fallback path selected.

Production logs must not contain:

- bearer tokens,
- service-role key,
- API keys,
- full Authorization headers,
- arbitrary user-entered sensitive text,
- raw third-party response bodies unless explicitly sanitized.

---

## 8. Scheduled Jobs

### Daily Yelp cleanup
Removed from MVP because Yelp is no longer stored/used by the core system.

### Expired cache cleanup
Supabase Cron can delete expired weather cache rows:

```sql
select cron.schedule(
  'delete-expired-weather-cache',
  '23 4 * * *',
  $$
    delete from public.weather_cache
    where expires_at < now() - interval '1 day';
  $$
);
```

### Event cleanup

```sql
select cron.schedule(
  'disable-old-events',
  '37 4 * * *',
  $$
    update public.events
    set is_active = false
    where ends_at < now();
  $$
);
```

### Optional semantic embedding refresh

Do not automatically burn hosted-NIM calls just because cron exists.

For MVP:

- refresh embeddings manually/admin-side after venue changes,
- never re-embed unchanged venues,
- keep `nim_semantic_enabled` as the switch,
- no scheduled hosted-NIM batch is required.

### Research evidence/cache cleanup

```sql
select cron.schedule(
  'delete-expired-research-evidence',
  '13 5 * * *',
  $$
    delete from public.research_evidence
    where expires_at < now();

    delete from public.research_query_cache
    where expires_at < now();
  $$
);
```

### Rate-bucket cleanup

Keep only recent counters:

```sql
select cron.schedule(
  'delete-old-generation-rate-buckets',
  '41 * * * *',
  $$
    delete from public.generation_rate_buckets
    where bucket_start < now() - interval '2 days';
  $$
);
```

No paid Render Cron is required.

---

## 9. Legal & Attribution Checklist

Before public launch:

- show **OpenStreetMap** attribution in the map,
- show **OpenFreeMap** attribution as required by its style/data setup,
- show **Geoapify** attribution when using data obtained under the Free plan,
- keep third-party source attribution metadata in the venue table where useful,
- do not imply that estimated venue pricing is guaranteed,
- add a “verify opening hours / booking availability” note,
- label future paid/promoted placements as sponsored,
- maintain a privacy policy if collecting analytics or persistent accounts later,
- treat live web-search output as third-party/public-web evidence, not owned editorial content,
- do not republish full search snippets/articles/reviews,
- preserve source URLs internally for traceability,
- re-check Tavily's Platform Terms/AUP and important underlying-source terms before production launch,
- if displaying source-derived claims, use short paraphrases and source links/attribution rather than copied review text,
- treat NVIDIA hosted NIM as optional prototype tooling unless current terms clearly permit the intended production use,
- re-check NVIDIA NIM/API Trial terms immediately before production,
- never present NIM-inferred soft preferences as verified venue facts.

If Yelp is reintroduced later, review its current API plan, caching rules and display requirements at that time.

---

## 10. Monetization Roadmap Without Breaking the Free MVP

### Phase 1 — Affiliate / Booking Links
Technically easy because the pass already stores booking URLs and click events.

Before enabling a specific affiliate program, confirm its terms and whether it changes any free-provider commercial-use rules.

### Phase 2 — Promoted Venues
Can run from the existing `venues` table.

Add:

```text
is_sponsored
sponsor_weight
campaign_start
campaign_end
```

Sponsored venues must still pass hard relevance, distance and budget filters.

### Phase 3 — Premium Features
Potential paid features:

- saved history across devices,
- longer-range planning,
- collaborative editing,
- premium curated collections,
- calendar integration,
- real-time venue availability,
- actual LLM-generated personalization.

At that point, upgrading infrastructure is acceptable because revenue exists.

The MVP should **not** require Phase 3 infrastructure to work.

---

## 11. MVP Deliverables for Kiro / Developer Handoff

### Phase 0 — Infrastructure + Security Proof

Retain all v6 baseline requirements: clean Supabase Free project, version-controlled migrations, React/Vite static app, Render Static Site, anonymous auth, complete RLS/privileges, no client secrets, keep-alive and direct `/pass/:hash` cold-load support.

**Gate:** no provider/research feature work starts until the deployment/security baseline passes.

### Phase 0.5 — Seed One Strong Area

Use Bukit Bintang first, but seed for **experience diversity**, not just count.

Target food, drinks/cafe, activities, culture, outdoor/explore and appropriate nightlife.

Provide reproducible Geoapify seeding/upsert tooling.

**Gate:** at least **5 meaningfully different feasible outing sequences** can be built without web research.

### Phase 1 — Constraint Solver Without Web Research

Implement pax, budget mode, time window, hard/soft constraints, candidate graph, schedule simulation, budget solver, sequence scoring, confidence engine and atomic persistence.

**Gate:** fixed tests correctly reject impossible sequences and return sensible 2–4 stop plans.

### Phase 1.5 — Optional NVIDIA Semantic Intelligence

Enable pgvector and implement:

```text
venue semantic profile
→ passage embedding
→ Supabase vector storage

user soft intent
→ query embedding
→ semantic recall
→ merge with deterministic candidates
```

Then add optional NIM reasoning for strict soft-intent/research JSON.

**Gate:**

```text
NIM enabled → vague intent improves candidate recall
NIM disabled → request still completes
NIM timeout/error → request still completes
hard-invalid venue → semantic match cannot rescue it
unchanged venue → no redundant re-embedding
```

Do not proceed until the fallback path is proven.

### Phase 2 — Weather-Aware Planning

Add cached OpenWeather context.

**Gate:** rainy/heat test cases change outdoor suitability without corrupting unrelated recommendations.

### Phase 3 — Structured Live Discovery

When local knowledge is thin:

```text
Supabase
→ Geoapify Places
→ normalize
→ dedupe
→ candidate pool
```

**Gate:** an intentionally under-seeded category can be discovered live and used without duplicate venue rows.

### Phase 4 — Smart Web Research

Add Tavily behind `WebResearchProvider`.

Required:

- internal monthly credit guard,
- per-generation max 2 credits,
- query fingerprint/cache,
- Basic search first,
- 5–8 results,
- no raw-content persistence,
- source deduping/quality heuristics,
- recommendation-signal extraction,
- entity resolution before recommendation,
- graceful operation when research is disabled.

**Gate:**

```text
high-confidence request
→ 0 Tavily credits

low-confidence request
→ 1–2 credits
→ useful new evidence/resolved candidates

research budget exhausted
→ 0 provider requests
→ app still produces plans
```

### Phase 5 — Final Route Validation

Use Geoapify Routing only for top sequence(s).

**Gate:** real routing can reject/re-rank an impractical sequence; disabling routing still works.

### Phase 6 — Premium Date Pass UI

Build Section 2A fully, including confidence-aware estimate/verify labels, pax-aware cost display and graceful constraint-relaxation UX.

**Gate:** Section 2A.18 passes on real mobile-sized browsers.

### Phase 7 — First-Party Learning Hooks

Capture privacy-minimized aggregate signal events. No individual behavioral profile.

### Phase 8 — Expand Neighborhoods

Expand area-by-area. Research/discovery accelerates coverage, but an area is not marked supported until its quality gate passes.

---

## 12. Quota Protection / Kill Switches

The app should expose a small `app_config` table:

```sql
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;
```

Suggested values:

```text
routing_enabled = true
weather_live_enabled = true
research_enabled = true
research_provider = "tavily"
research_monthly_credit_budget = 850
research_max_credits_per_generation = 2
research_trigger_confidence = 82
research_deep_trigger_confidence = 65
nim_enabled = true
nim_semantic_enabled = true
nim_reasoning_enabled = true
nim_embed_model = "nvidia/nemotron-3-embed-1b"
nim_reasoning_model = "nvidia/nemotron-3.5-lightning-30b-a3b"
nim_semantic_min_similarity = 0.55
nim_reasoning_trigger_confidence = 70
nim_soft_requests_per_minute = 20
geoapify_daily_credit_budget = 2500
weather_soft_calls_per_minute = 40
max_generations_per_user_per_hour = 10
max_generations_global_per_minute = 30
supported_neighborhoods = [...]
```

The generation function reads this configuration server-side before making optional API calls. For rate limits, it must pass the configured values to `consume_generation_quota` before any external API work.

If a provider is near quota, disable that feature without redeploying the app.

Recommended degradation order:

1. disable optional NIM reasoning → deterministic parsing,
2. disable live NIM query embeddings → taxonomy/tag ranking,
3. stop Advanced web research,
4. stop all live web research → use cache/Flow knowledge,
5. disable live route API → use distance estimates,
6. use cached weather only,
7. reduce generation frequency,
8. temporarily restrict generation to supported neighborhoods,
9. never auto-upgrade a paid plan.

---

## 13. Full $0 Cost Check

| Service / Layer | MVP Usage | True-Free Position |
|---|---|---|
| **Render Static Site** | Host React/Vite PWA | $0 static hosting. No Web Service. Avoid payment method during true-free phase to prevent chargeable overage behavior. |
| **Supabase Free** | Postgres, Auth, RLS, Edge Functions, Cron | $0 within free quotas. 500 MB DB, 50k MAU, 5 GB egress, 500k function invocations. May pause after low activity. |
| **GitHub Actions** | Tiny keep-alive workflow a few times per day | Tiny usage; practical free-tier consumption. |
| **MapLibre GL JS** | Client map library | Open-source / no usage bill. |
| **OpenFreeMap** | Map style/tiles | Public instance states no registration, API key, view/request limits or charge. No SLA — keep provider abstraction simple. |
| **Geoapify Free** | Seed/refresh POIs; optional final routing | 3,000 credits/day, no card required, commercial free use allowed with required attribution/terms. Not called for every candidate search. |
| **OpenWeather Free** | Current weather + ≤48h forecast | Use permanent free endpoints only; avoid One Call pay-as-you-go product. |
| **Tavily Researcher** | Selective live web research | Current target: 1,000 API credits/month, no card required; Flow internally caps below allowance and stops research rather than enabling PAYG. |
| **NVIDIA hosted NIM** | Optional semantic embeddings + structured soft reasoning | NVIDIA currently provides free hosted API endpoints to Developer Program members for **prototyping**. Treat as optional; re-check terms before production and disable if $0 production use is not clearly covered. |
| **Supabase pgvector** | Store/retrieve 2048-d venue embeddings | Uses the existing Supabase/Postgres DB; monitor vector storage against the free database ceiling. |
| **Yelp** | None in core MVP | Optional future enrichment. |
| **Eventbrite / SeatGeek** | None in core MVP | Manual curated events instead. |
| **Paid LLM API** | None required | NIM reasoning is an optional prototype enhancement; the deterministic Flow engine remains the required fallback. |

---

## 14. What “Truly Free” Means Here

The app is designed so that **normal MVP operation does not require entering a credit card or paying a monthly infrastructure bill**.

It does **not** mean infinite capacity.

The free plan has deliberate ceilings. Live web research is a **bounded enhancement**, not a requirement for every itinerary. NVIDIA hosted NIM is also an **optional prototype enhancement**, not a production dependency.

If Tavily or NIM is unavailable, disabled, rate-limited or unsuitable under its current free terms, Flow continues using accumulated local knowledge, Geoapify discovery, weather, deterministic intent parsing and the graph/constraint planner.

When Flow grows beyond those ceilings, the correct outcome is:

- a quota warning,
- graceful feature degradation,
- or a controlled service limit,

**not an unexpected invoice.**

The architecture is intentionally designed so a paid upgrade is a future scaling decision rather than a hidden requirement to get the MVP working.

---

## 15. Official References to Re-Check Before Production Launch

Free plans and terms change. Before each public launch, re-check these official pages:

- Render free services: https://render.com/docs/free
- Render static rewrites: https://render.com/docs/redirects-rewrites
- Supabase pricing: https://supabase.com/pricing
- Supabase project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase anonymous sign-ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Cron: https://supabase.com/docs/guides/cron
- Geoapify pricing: https://www.geoapify.com/pricing/
- Geoapify terms: https://www.geoapify.com/terms-and-conditions/
- Geoapify pricing details: https://www.geoapify.com/pricing-details/
- OpenFreeMap: https://openfreemap.org/
- MapLibre: https://maplibre.org/
- OpenWeather pricing: https://openweathermap.org/full-price
- Yelp developer rate limits / plan information: https://docs.developer.yelp.com/
- Tavily pricing: https://www.tavily.com/pricing
- Tavily Platform Terms: https://www.tavily.com/terms
- Tavily Acceptable Use Policy: https://www.tavily.com/acceptable-use-policy
- Tavily docs: https://docs.tavily.com/
- NVIDIA NIM Run Anywhere / pricing guidance: https://docs.api.nvidia.com/nim/docs/run-anywhere
- NVIDIA API Catalog Quickstart: https://docs.api.nvidia.com/nim/docs/api-quickstart
- NVIDIA Nemotron-3-Embed-1B API reference: https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-embed-1b-infer
- NVIDIA Nemotron-3-Embed-1B model page: https://build.nvidia.com/nvidia/nemotron-3-embed-1b
- NVIDIA Nemotron-3.5-Lightning-30B-A3B: https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b/build
- Apple Human Interface Guidelines — Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Apple Human Interface Guidelines — Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple Human Interface Guidelines — Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Apple Human Interface Guidelines — Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility

---


## 16. Final Builder Verification Checklist

Before handoff to the product owner, verify all of the following.

### Architecture / cost

- [ ] Render is a Static Site only.
- [ ] No paid server/database/cron/LLM dependency exists.
- [ ] App still produces a useful pass when optional routing is disabled.
- [ ] Quota exhaustion never auto-upgrades a provider.
- [ ] High-confidence common requests use zero Tavily credits.
- [ ] Research budget exhaustion disables live web research without breaking generation.
- [ ] Geoapify daily-budget exhaustion disables live discovery/routing without breaking generation.
- [ ] Tavily key is absent from browser bundles.
- [ ] NVIDIA key is absent from browser bundles.
- [ ] NIM can be disabled and generation still works.
- [ ] NIM timeout/rate-limit does not fail generation.
- [ ] Reasoning output cannot override explicit hard constraints.
- [ ] Semantic retrieval cannot rescue a closed/out-of-budget/impossible venue.
- [ ] Unchanged venues are not re-embedded.

### Security

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is absent from browser bundles.
- [ ] OpenWeather and Geoapify keys are absent from browser bundles.
- [ ] Internal catalog/cache/config/rate tables are inaccessible to anon/authenticated browser queries.
- [ ] Creator can select only their own saved passes.
- [ ] Public recipients can fetch only the pass identified by the supplied high-entropy share hash.
- [ ] Generation writes happen through `generate-flow`, not direct browser INSERTs.
- [ ] Rate limiting is enforced in PostgreSQL.
- [ ] Click tracking uses the narrow RPC and failure never blocks outbound navigation.
- [ ] Authenticated write-capable Edge Functions use an explicit CORS allow-list.

### Data / generation

- [ ] Each generated stop has `fit_reason`.
- [ ] Each public stop contains its stop ID plus latitude/longitude.
- [ ] Itinerary + stops persist atomically; forced stop-insert failure leaves no itinerary row behind.
- [ ] Route geometry may be null and the UI still works.
- [ ] Itinerary snapshots do not change when the venue catalog is later refreshed.
- [ ] A 2-stop degraded result renders correctly.
- [ ] Unsupported neighborhoods fail with useful UI guidance.
- [ ] Weather/routing provider failures trigger documented fallbacks.
- [ ] Web recommendation signals never override contradictory hard structured facts.
- [ ] Unresolved web place mentions are never recommended.
- [ ] Research cache stores normalized signals/URLs only, not copied article/review bodies.
- [ ] Pax affects budget calculations and itinerary suitability.
- [ ] Schedule solver validates the whole outing, not just individual stops.
- [ ] Low-confidence requests return useful constraint-relaxation guidance instead of fabricated certainty.

### UX

- [ ] Flow Dock minimizes and restores according to Section 2A.
- [ ] Dock never becomes permanently undiscoverable.
- [ ] Bottom sheet and map remain synchronized.
- [ ] Browser Back/Forward works.
- [ ] Shared `/pass/:hash` links work from a cold load.
- [ ] Light mode, dark mode, reduced motion, keyboard navigation, slow network, and offline reopening are tested.
- [ ] No safe-area collisions occur on modern iPhone/Android layouts.
- [ ] No generic "vibe-coded" rejection criteria from Section 2A.16 are present.

### Reproducibility

- [ ] Fresh clone can run from README instructions.
- [ ] `.env.example` lists every required variable without real secrets.
- [ ] Clean Supabase project can be initialized from version-controlled migrations.
- [ ] Seed tool can populate Bukit Bintang without duplicating rows on re-run.
- [ ] Render deployment instructions are complete.
- [ ] Smoke tests are documented.

**Handoff rule:** unresolved failed checkboxes must be listed explicitly. Do not mark the project "done" while silently leaving a failed acceptance requirement.

---

## Bottom Line

**Flow v7.1 is a hybrid deterministic planner with optional semantic intelligence.**

```text
explicit constraints + free-form intent
        ↓
deterministic parser
        +
optional NVIDIA query embedding
        +
optional NIM structured reasoning
        ↓
Flow knowledge + pgvector semantic recall
        ↓
Geoapify discovery when needed
        ↓
Tavily research when confidence is weak
        ↓
entity resolution
        ↓
weather + pax + time + budget + travel
        ↓
candidate graph
        ↓
deterministic feasibility solver
        ↓
sequence scoring + confidence
        ↓
route validation
        ↓
Date Pass
```

NVIDIA's role is deliberately narrow:

```text
Nemotron Embed
= semantic similarity / recall

Nemotron Lightning
= optional structured soft-intent/research extraction

Flow Engine
= final feasibility and recommendation decision
```

Most important requirement:

> **Turn NVIDIA off and Flow still works.**

---

## Builder Kickoff Instruction

Paste the following together with this spec when starting the build:

> Build **Flow v7.1** exactly from this NIM-Enhanced Smart Research Master Specification. Treat the document as the source of truth. Work phase-by-phase and do not move to the next phase until the current acceptance gate passes. Preserve the true-free core architecture. NVIDIA NIM is an optional semantic/reasoning accelerator, never the deterministic planner and never a mandatory production dependency. Use `nvidia/nemotron-3-embed-1b` for semantic retrieval with the correct query/passage input types, store venue embeddings in Supabase pgvector, and use `nvidia/nemotron-3.5-lightning-30b-a3b` only for validated structured soft-intent/research extraction when useful. Never let NIM invent or override opening hours, prices, coordinates, weather, route feasibility, pax constraints or availability. Never expose `NVIDIA_API_KEY`. If NIM is disabled, unavailable, rate-limited or unsuitable under current production terms, Flow must continue through deterministic intent parsing, taxonomy/tags, structured discovery, research cache and the graph/constraint solver. Do not persist reasoning traces or copied article/review bodies. At the end of every phase report what was implemented, tests run, provider calls consumed, whether the fallback path was tested, whether the acceptance gate passed, and every unresolved deviation from this specification.
