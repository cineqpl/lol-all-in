import type { AbilityKey } from './types';

/** How a champion's abilities can be ranked up. */
export type LevelingRules = {
  /** Highest rank of each ability. */
  maxRank: Record<AbilityKey, number>;
  /**
   * Champion level needed for each rank of the ultimate (R). null means R is a normal ability and
   * follows the half-the-level rule like Q, W and E.
   */
  ultimateLevels: number[] | null;
};

export const KEYS: AbilityKey[] = ['Q', 'W', 'E', 'R'];

const DEFAULT_LEVELING: LevelingRules = {
  maxRank: { Q: 5, W: 5, E: 5, R: 3 },
  ultimateLevels: [6, 11, 16],
};

/** Champions that do not follow the standard rules (by Data Dragon champion id). */
const OVERRIDES: Record<string, LevelingRules> = {
  // No ultimate: all four abilities rank up to 5.
  Udyr: { maxRank: { Q: 5, W: 5, E: 5, R: 5 }, ultimateLevels: null },
  // Ultimate available at level 1; ranks 2 to 4 at levels 6, 11 and 16.
  Nidalee: { maxRank: { Q: 5, W: 5, E: 5, R: 4 }, ultimateLevels: [1, 6, 11, 16] },
  Elise: { maxRank: { Q: 5, W: 5, E: 5, R: 4 }, ultimateLevels: [1, 6, 11, 16] },
  Karma: { maxRank: { Q: 5, W: 5, E: 5, R: 4 }, ultimateLevels: [1, 6, 11, 16] },
  // Ultimate always available (a single rank); basics rank up to 6.
  Jayce: { maxRank: { Q: 6, W: 6, E: 6, R: 1 }, ultimateLevels: [1] },
};

export function levelingFor(championId: string): LevelingRules {
  return OVERRIDES[championId] ?? DEFAULT_LEVELING;
}

/** An ultimate that is available from level 1 is always learned, so it cannot be lowered to 0. */
export function minRank(rules: LevelingRules, key: AbilityKey): number {
  return key === 'R' && rules.ultimateLevels?.[0] === 1 ? 1 : 0;
}

/** Q at rank 1; the ultimate too when it is available at level 1. */
export function startingRanks(rules: LevelingRules): Record<AbilityKey, number> {
  return { Q: 1, W: 0, E: 0, R: minRank(rules, 'R') };
}

export function clampRanks(
  ranks: Record<AbilityKey, number>,
  rules: LevelingRules,
): Record<AbilityKey, number> {
  const out = { ...ranks };
  for (const k of KEYS) out[k] = Math.max(minRank(rules, k), Math.min(out[k], rules.maxRank[k]));
  return out;
}
