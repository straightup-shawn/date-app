// ============================================================
// Flow v7.1 — Shared motion language (Section 2A.8)
// Animate only what needs animating; prefer transform/opacity.
// ============================================================
import type { Transition } from 'framer-motion'

export const motionTokens = {
  press: 0.11,
  fast: 0.18,
  standard: 0.26,
  sheet: 0.34,
} as const

export const springMicro: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 34,
  mass: 0.7,
}

export const springDock: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 30,
  mass: 0.8,
}

export const springSheet: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 34,
  mass: 1,
}

export const pressFeedback = { scale: 0.988 }

/** True when the user prefers reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
