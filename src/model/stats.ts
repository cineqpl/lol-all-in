import type { ChampionBase, StatBlock } from './types';

const STAT_KEYS: (keyof StatBlock)[] = ['hp', 'mana', 'armor', 'mr', 'ad', 'ap'];

/** Standard per-level growth: base + growth * (n-1) * (0.7025 + 0.0175 * (n-1)), n clamped to 1-18. */
export function statsAtLevel(champ: ChampionBase, level: number): StatBlock {
  const n = Math.min(18, Math.max(1, level));
  const mult = (n - 1) * (0.7025 + 0.0175 * (n - 1));
  const out = {} as StatBlock;
  for (const k of STAT_KEYS) out[k] = champ.base[k] + champ.growth[k] * mult;
  return out;
}
