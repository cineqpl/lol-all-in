import type { Ability, AbilityKey, StatBlock } from './types';

export type Attacker = { total: StatBlock; bonusAd: number };

/** Damage multiplier from a resist value. Negative resist amplifies damage. */
export function mitigate(raw: number, resist: number): number {
  const mult = resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist);
  return raw * mult;
}

/** Unmitigated ability damage: base at rank plus scalings. Rank 0 (unlearned) is 0. */
export function abilityRaw(ability: Ability, rank: number, attacker: Attacker, _target: StatBlock): number {
  if (rank < 1) return 0;
  const base = ability.baseByRank[Math.min(rank, ability.baseByRank.length) - 1] ?? 0;
  let total = base;
  for (const s of ability.scalings) {
    const stat =
      s.stat === 'ad' ? attacker.total.ad
      : s.stat === 'bonusAd' ? attacker.bonusAd
      : s.stat === 'ap' ? attacker.total.ap
      : attacker.total.hp; // maxHp: attacker's own max HP
    total += stat * s.ratio;
  }
  return total;
}

export function abilityDamage(ability: Ability, rank: number, attacker: Attacker, target: StatBlock): number {
  if (ability.status === 'not-modelled' || ability.damageType === 'unknown') return 0;
  const raw = abilityRaw(ability, rank, attacker, target);
  if (ability.damageType === 'true') return raw;
  return mitigate(raw, ability.damageType === 'physical' ? target.armor : target.mr);
}

export function comboDamage(
  abilities: Ability[],
  ranks: Record<AbilityKey, number>,
  attacker: Attacker,
  target: StatBlock,
  autoCount: number,
): { total: number; notModelled: Ability[] } {
  let total = 0;
  const notModelled: Ability[] = [];
  for (const a of abilities) {
    if (a.status === 'not-modelled') {
      notModelled.push(a);
      continue;
    }
    total += abilityDamage(a, ranks[a.key], attacker, target);
  }
  total += autoCount * mitigate(attacker.total.ad, target.armor);
  return { total, notModelled };
}
