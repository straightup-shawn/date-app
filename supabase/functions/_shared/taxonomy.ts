// ============================================================
// Flow v7.1 — Place taxonomy + experience families (Section 4.2)
// ============================================================
import type { ExperiencePreference, TimeWindow } from './types.ts'

export type ExperienceFamily =
  | 'food'
  | 'drinks'
  | 'activity'
  | 'culture'
  | 'outdoor'
  | 'explore'
  | 'shopping'
  | 'nightlife'
  | 'event'

/** Role a stop plays in an outing sequence. */
export type StopRole = 'anchor' | 'activity' | 'closer'

/**
 * Which families can serve which structural role.
 * anchor = the main sit-down/dinner-like stop.
 * activity = the doing-something-together middle stop.
 * closer = the wind-down (dessert / drinks / supper / scenic).
 */
export const ROLE_FAMILIES: Record<StopRole, ExperienceFamily[]> = {
  anchor: ['food'],
  activity: ['activity', 'culture', 'outdoor', 'explore', 'shopping', 'event'],
  closer: ['drinks', 'food', 'nightlife', 'outdoor'],
}

/** Typical minimum useful duration (minutes) per family. */
export const FAMILY_DURATION: Record<ExperienceFamily, number> = {
  food: 75,
  drinks: 55,
  activity: 70,
  culture: 60,
  outdoor: 45,
  explore: 45,
  shopping: 50,
  nightlife: 75,
  event: 90,
}

/**
 * Preferred sequence templates (Step 11). We do not force 3 stops.
 * Each template is an ordered list of roles.
 */
export const SEQUENCE_TEMPLATES: StopRole[][] = [
  ['anchor', 'activity', 'closer'],
  ['activity', 'anchor', 'closer'],
  ['anchor', 'closer'],
  ['activity', 'anchor'],
  ['anchor', 'activity', 'closer'], // duplicate role set, different fills allowed
  ['culture' as StopRole, 'anchor', 'closer'].filter(Boolean) as StopRole[],
]

/** Bias family selection by experience preference. */
export function familyWeightForExperience(
  exp: ExperiencePreference,
): Partial<Record<ExperienceFamily, number>> {
  switch (exp) {
    case 'food_focused':
      return { food: 1.3, drinks: 1.1 }
    case 'activity_focused':
      return { activity: 1.35, culture: 1.15, outdoor: 1.1 }
    case 'explore':
      return { explore: 1.3, outdoor: 1.2, culture: 1.1, shopping: 1.05 }
    case 'surprise_me':
    default:
      return {}
  }
}

/** Rough daypart suitability for a family (soft). */
export function dampartSuitability(
  family: ExperienceFamily,
  daypart: TimeWindow,
): number {
  if (daypart === 'late_night') {
    if (family === 'nightlife' || family === 'drinks' || family === 'food') return 1
    if (family === 'outdoor' || family === 'culture' || family === 'shopping') return 0.4
    return 0.7
  }
  if (daypart === 'afternoon') {
    if (family === 'nightlife') return 0.3
    if (family === 'culture' || family === 'explore' || family === 'outdoor') return 1
    return 0.9
  }
  // evening
  return 0.95
}

export function primaryFamily(families: string[]): ExperienceFamily | null {
  const known: ExperienceFamily[] = [
    'food',
    'drinks',
    'activity',
    'culture',
    'outdoor',
    'explore',
    'shopping',
    'nightlife',
    'event',
  ]
  for (const f of families) {
    if (known.includes(f as ExperienceFamily)) return f as ExperienceFamily
  }
  return null
}
