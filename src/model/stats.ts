import type { ChampionBase, StatBlock } from './types';

const STAT_KEYS: (keyof StatBlock)[] = ['hp', 'mana', 'armor', 'mr', 'ad', 'ap'];

/**
 * Standard per-level growth: base + growth * (n-1) * (0.7025 + 0.0175 * (n-1)), n clamped to 1-20.
 * Levels 19-20 are only reachable with the top lane role quest.
 */
export function statsAtLevel(champ: ChampionBase, level: number): StatBlock {
  const n = Math.min(20, Math.max(1, level));
  const mult = (n - 1) * (0.7025 + 0.0175 * (n - 1));
  const out = {} as StatBlock;
  for (const k of STAT_KEYS) out[k] = champ.base[k] + champ.growth[k] * mult;
  return out;
}
