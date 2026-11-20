import type { AbilityKey } from './types';

/** What a side does in the skirmish: hits per cast of each ability, auto-attacks, and whether Ignite is used. */
export type Combo = { hits: Record<AbilityKey, number[]>; autos: number; ignite?: boolean };

/** Used when no combo is given: every cast hits once (a missing entry means one hit), plus two auto-attacks. */
export const DEFAULT_COMBO: Combo = { hits: { Q: [], W: [], E: [], R: [] }, autos: 2 };

/** A usable count: whole number, never negative, never NaN. */
export function count(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}
