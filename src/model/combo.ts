import type { AbilityKey } from './types';

/** What a side does in the skirmish: how many times each ability hits, and how many auto-attacks land. */
export type Combo = { hits: Record<AbilityKey, number>; autos: number };

/** Used when no combo is given: every ability hits once, plus two auto-attacks. */
export const DEFAULT_COMBO: Combo = { hits: { Q: 1, W: 1, E: 1, R: 1 }, autos: 2 };

/** A usable count: whole number, never negative, never NaN. */
export function count(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
