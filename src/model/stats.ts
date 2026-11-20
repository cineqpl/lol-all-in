import type { ChampionBase, StatBlock } from './types';

const STAT_KEYS: (keyof StatBlock)[] = ['hp', 'mana', 'armor', 'mr', 'ad', 'ap', 'attackSpeed'];

/** Per-level growth multiplier: (n-1) * (0.7025 + 0.0175 * (n-1)), n clamped to 1-20. */
function growthMultiplier(level: number): number {
  const n = Math.min(20, Math.max(1, level));
  return (n - 1) * (0.7025 + 0.0175 * (n - 1));
}

/**
 * Champion stats at a level, before items. Levels 19-20 are only reachable with the top lane role quest.
 * Attack speed is special: growth is a fraction of base attack speed, so the result is base * (1 + growth * mult).
 */
export function statsAtLevel(champ: ChampionBase, level: number): StatBlock {
  const mult = growthMultiplier(level);
  const out = {} as StatBlock;
  for (const k of STAT_KEYS) {
    out[k] =
      k === 'attackSpeed'
        ? champ.base[k] * (1 + champ.growth[k] * mult)
        : champ.base[k] + champ.growth[k] * mult;
  }
  return out;
}

export type StatPart = { base: number; bonus: number; total: number };
export type StatBreakdown = Record<keyof StatBlock, StatPart>;

/**
 * Splits each stat into base and bonus. Base is the champion's own base plus per-level growth;
 * everything else (items) is bonus. Attack speed differs: only the champion's base attack speed is
 * base, and both the per-level growth and item attack speed (fractions of base) are bonus.
 */
export function statBreakdown(champ: ChampionBase, level: number, itemStats: StatBlock): StatBreakdown {
  const mult = growthMultiplier(level);
  const out = {} as StatBreakdown;
  for (const k of STAT_KEYS) {
    if (k === 'attackSpeed') {
      const base = champ.base.attackSpeed;
      const bonus = base * (champ.growth.attackSpeed * mult + itemStats.attackSpeed);
      out[k] = { base, bonus, total: base + bonus };
    } else {
      const base = champ.base[k] + champ.growth[k] * mult;
      out[k] = { base, bonus: itemStats[k], total: base + itemStats[k] };
    }
  }
  return out;
}
