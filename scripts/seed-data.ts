// ============================================================
// Flow v7.1 — Bukit Bintang seed catalog (Phase 0.5)
// Seeded for EXPERIENCE DIVERSITY, not just count: food, drinks/cafe,
// activity, culture, outdoor/explore, nightlife — enough to build at
// least 5 meaningfully different feasible outing sequences with no web research.
//
// Coordinates are approximate real locations in Bukit Bintang, KL.
// est_cost_total is a ~2-pax baseline (scaled by the planner). Prices/hours
// are estimates and are labeled as such in the UI.
// opening_hours: minutes-since-midnight windows keyed by weekday (0=Sun..6=Sat).
// ============================================================

export interface SeedVenue {
  external_id: string
  name: string
  categories: string[]
  address: string
  lat: number
  lng: number
  price_bucket: number // 1..4
  est_cost_total: number // ~2 pax baseline (MYR)
  rating: number
  indoor: boolean
  outdoor: boolean
  experience_families: string[]
  vibe_tags: string[]
  semantic_profile: string
  pax_min: number
  pax_max: number
  booking_url?: string
  website_url?: string
  // Simple daily hours applied to every weekday unless overridden.
  open: number
  close: number
}

// Helper: HH.MM style hours -> minutes.
const hm = (h: number, m = 0) => h * 60 + m

export const BUKIT_BINTANG: SeedVenue[] = [
  // ---------------- FOOD (anchors) ----------------
  {
    external_id: 'bb-izakaya-01',
    name: 'Hikari Izakaya',
    categories: ['restaurant', 'japanese'],
    address: 'Changkat Bukit Bintang, Kuala Lumpur',
    lat: 3.1462,
    lng: 101.708,
    price_bucket: 3,
    est_cost_total: 130,
    rating: 4.4,
    indoor: true,
    outdoor: false,
    experience_families: ['food'],
    vibe_tags: ['romantic', 'conversation_friendly', 'cozy'],
    semantic_profile:
      'Japanese izakaya in Bukit Bintang. Indoor evening venue. Casual but intimate. Conversation-friendly. Moderate estimated spend. Good as a dinner anchor.',
    pax_min: 1,
    pax_max: 8,
    open: hm(17),
    close: hm(23, 30),
  },
  {
    external_id: 'bb-hawker-01',
    name: 'Jalan Alor Night Eats',
    categories: ['hawker', 'casual'],
    address: 'Jalan Alor, Bukit Bintang, Kuala Lumpur',
    lat: 3.1456,
    lng: 101.7089,
    price_bucket: 1,
    est_cost_total: 55,
    rating: 4.3,
    indoor: false,
    outdoor: true,
    experience_families: ['food'],
    vibe_tags: ['lively', 'local_favorite', 'group_friendly'],
    semantic_profile:
      'Bustling open-air hawker street in Bukit Bintang. Lively, affordable, group-friendly street food. Great casual dinner anchor for the evening or late night.',
    pax_min: 1,
    pax_max: 12,
    open: hm(17),
    close: hm(26), // ~2am
  },
  {
    external_id: 'bb-rooftop-din-01',
    name: 'Skyline Dining KL',
    categories: ['restaurant', 'rooftop'],
    address: 'Bukit Bintang, Kuala Lumpur',
    lat: 3.1471,
    lng: 101.7112,
    price_bucket: 4,
    est_cost_total: 260,
    rating: 4.5,
    indoor: true,
    outdoor: true,
    experience_families: ['food'],
    vibe_tags: ['romantic', 'photogenic', 'impressive'],
    semantic_profile:
      'Upscale rooftop restaurant with skyline views in Bukit Bintang. Romantic, photogenic, special-occasion dinner anchor. Higher estimated spend.',
    pax_min: 2,
    pax_max: 6,
    open: hm(18),
    close: hm(24),
  },

  // ---------------- DRINKS / CAFE (closers) ----------------
  {
    external_id: 'bb-cafe-01',
    name: 'Slow Pour Coffee',
    categories: ['cafe', 'coffee'],
    address: 'Tengkat Tong Shin, Bukit Bintang, Kuala Lumpur',
    lat: 3.1449,
    lng: 101.7071,
    price_bucket: 2,
    est_cost_total: 45,
    rating: 4.6,
    indoor: true,
    outdoor: false,
    experience_families: ['drinks'],
    vibe_tags: ['quiet', 'conversation_friendly', 'cozy'],
    semantic_profile:
      'Quiet specialty coffee cafe in Bukit Bintang. Calm, conversation-friendly, indoors. Good afternoon stop or gentle wind-down closer.',
    pax_min: 1,
    pax_max: 6,
    open: hm(9),
    close: hm(23),
  },
  {
    external_id: 'bb-dessert-01',
    name: 'Gula Dessert Bar',
    categories: ['dessert', 'bakery'],
    address: 'Bukit Bintang, Kuala Lumpur',
    lat: 3.1467,
    lng: 101.7095,
    price_bucket: 2,
    est_cost_total: 50,
    rating: 4.5,
    indoor: true,
    outdoor: false,
    experience_families: ['drinks', 'food'],
    vibe_tags: ['cozy', 'photogenic', 'romantic'],
    semantic_profile:
      'Cozy dessert bar in Bukit Bintang. Late-night friendly, photogenic, romantic. Ideal dessert or nightcap closer within a short walk of dinner.',
    pax_min: 1,
    pax_max: 6,
    open: hm(14),
    close: hm(24),
  },
  {
    external_id: 'bb-rooftop-bar-01',
    name: 'Heights Rooftop Lounge',
    categories: ['rooftop', 'lounge', 'bar'],
    address: 'Changkat Bukit Bintang, Kuala Lumpur',
    lat: 3.1459,
    lng: 101.7076,
    price_bucket: 3,
    est_cost_total: 140,
    rating: 4.3,
    indoor: false,
    outdoor: true,
    experience_families: ['nightlife', 'drinks'],
    vibe_tags: ['photogenic', 'lively', 'impressive'],
    semantic_profile:
      'Rooftop lounge with city views in Bukit Bintang. Lively evening and late-night drinks. Photogenic closer for a night out. Outdoor terrace.',
    pax_min: 2,
    pax_max: 10,
    open: hm(18),
    close: hm(26),
  },

  // ---------------- ACTIVITY ----------------
  {
    external_id: 'bb-arcade-01',
    name: 'Level Up Arcade',
    categories: ['arcade', 'games'],
    address: 'Bukit Bintang mall, Kuala Lumpur',
    lat: 3.1476,
    lng: 101.7118,
    price_bucket: 2,
    est_cost_total: 70,
    rating: 4.2,
    indoor: true,
    outdoor: false,
    experience_families: ['activity'],
    vibe_tags: ['lively', 'group_friendly', 'unusual'],
    semantic_profile:
      'Indoor arcade in a Bukit Bintang mall. Fun, playful, group-friendly activity. Good low-pressure middle stop between dinner and dessert.',
    pax_min: 1,
    pax_max: 8,
    open: hm(11),
    close: hm(23),
  },
  {
    external_id: 'bb-karaoke-01',
    name: 'Echo Karaoke Rooms',
    categories: ['karaoke'],
    address: 'Bukit Bintang, Kuala Lumpur',
    lat: 3.1473,
    lng: 101.7101,
    price_bucket: 2,
    est_cost_total: 90,
    rating: 4.1,
    indoor: true,
    outdoor: false,
    experience_families: ['activity'],
    vibe_tags: ['group_friendly', 'lively'],
    semantic_profile:
      'Private-room karaoke in Bukit Bintang. Indoor, group-friendly, lively activity. Works well for casual groups in the evening or late night.',
    pax_min: 2,
    pax_max: 12,
    open: hm(14),
    close: hm(26),
  },
  {
    external_id: 'bb-pottery-01',
    name: 'Clayhouse Studio',
    categories: ['workshop', 'pottery'],
    address: 'Bukit Bintang, Kuala Lumpur',
    lat: 3.1444,
    lng: 101.7068,
    price_bucket: 3,
    est_cost_total: 160,
    rating: 4.7,
    indoor: true,
    outdoor: false,
    experience_families: ['activity', 'culture'],
    vibe_tags: ['conversation_friendly', 'unusual', 'quiet'],
    semantic_profile:
      'Hands-on pottery workshop in Bukit Bintang. Indoor, quiet, conversation-friendly and a little different. Memorable first-date or anniversary activity.',
    pax_min: 1,
    pax_max: 6,
    open: hm(10),
    close: hm(21),
  },

  // ---------------- CULTURE ----------------
  {
    external_id: 'bb-gallery-01',
    name: 'Contemporary Art Space KL',
    categories: ['gallery', 'exhibition'],
    address: 'Bukit Bintang, Kuala Lumpur',
    lat: 3.1481,
    lng: 101.7099,
    price_bucket: 1,
    est_cost_total: 30,
    rating: 4.4,
    indoor: true,
    outdoor: false,
    experience_families: ['culture'],
    vibe_tags: ['quiet', 'photogenic', 'conversation_friendly'],
    semantic_profile:
      'Small contemporary art gallery in Bukit Bintang. Quiet, indoor, photogenic. Low-cost cultural stop, best in the afternoon or early evening.',
    pax_min: 1,
    pax_max: 6,
    open: hm(11),
    close: hm(19),
  },
  {
    external_id: 'bb-bookstore-01',
    name: 'Margins Bookstore & Reading Room',
    categories: ['bookstore'],
    address: 'Bukit Bintang, Kuala Lumpur',
    lat: 3.1452,
    lng: 101.7104,
    price_bucket: 1,
    est_cost_total: 35,
    rating: 4.5,
    indoor: true,
    outdoor: false,
    experience_families: ['culture', 'explore'],
    vibe_tags: ['quiet', 'cozy', 'conversation_friendly'],
    semantic_profile:
      'Independent bookstore with a reading corner in Bukit Bintang. Quiet, cozy, indoors. Gentle browse-and-talk stop.',
    pax_min: 1,
    pax_max: 4,
    open: hm(10),
    close: hm(22),
  },

  // ---------------- OUTDOOR / EXPLORE ----------------
  {
    external_id: 'bb-park-01',
    name: 'Bukit Nanas Viewpoint Walk',
    categories: ['park', 'viewpoint', 'scenic walk'],
    address: 'Near Bukit Bintang, Kuala Lumpur',
    lat: 3.1518,
    lng: 101.7057,
    price_bucket: 1,
    est_cost_total: 0,
    rating: 4.3,
    indoor: false,
    outdoor: true,
    experience_families: ['outdoor', 'explore'],
    vibe_tags: ['photogenic', 'quiet'],
    semantic_profile:
      'Scenic forest walk and viewpoint near Bukit Bintang. Outdoor, photogenic, free. Best in the afternoon or early evening and in good weather.',
    pax_min: 1,
    pax_max: 10,
    open: hm(8),
    close: hm(18),
  },
  {
    external_id: 'bb-market-01',
    name: 'Bintang Street Market',
    categories: ['market', 'street-art area', 'attraction'],
    address: 'Bukit Bintang, Kuala Lumpur',
    lat: 3.1465,
    lng: 101.7085,
    price_bucket: 1,
    est_cost_total: 40,
    rating: 4.2,
    indoor: false,
    outdoor: true,
    experience_families: ['explore', 'shopping'],
    vibe_tags: ['lively', 'photogenic', 'local_favorite'],
    semantic_profile:
      'Open-air street market and street-art area in Bukit Bintang. Lively, photogenic, walkable exploration. Good early-evening browse before dinner.',
    pax_min: 1,
    pax_max: 12,
    open: hm(16),
    close: hm(23),
  },
]

/** Build a weekday opening_hours object from simple daily open/close. */
export function dailyHours(open: number, close: number): Record<string, Array<{ open: number; close: number }>> {
  const out: Record<string, Array<{ open: number; close: number }>> = {}
  for (let d = 0; d < 7; d++) out[String(d)] = [{ open, close }]
  return out
}
