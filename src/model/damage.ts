import { count } from './combo';
import type { StatBreakdown } from './stats';
import type { Ability, AbilityKey, ComponentStat, DamageComponent, DamageType } from './types';

/** Damage multiplier from a resist value. Negative resist amplifies damage. */
export function mitigate(raw: number, resist: number): number {
  const mult = resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist);
  return raw * mult;
}

/** The value for a rank (1-based); a single entry applies to every rank, a rank past the end uses the last. */
function atRank(values: number[], rank: number): number {
  return values[Math.min(rank, values.length) - 1] ?? 0;
}

/** Value of a scaling stat. Target health scalings assume the target is at full health. */
function statValue(stat: ComponentStat, caster: StatBreakdown, target: StatBreakdown): number {
  switch (stat) {
    case 'ad': return caster.ad.total;
    case 'bonusAd': return caster.ad.bonus;
    case 'ap': return caster.ap.total;
    case 'maxHp': return caster.hp.total;
    case 'bonusHp': return caster.hp.bonus;
    case 'armor': return caster.armor.total;
    case 'bonusArmor': return caster.armor.bonus;
    case 'mr': return caster.mr.total;
    case 'bonusMr': return caster.mr.bonus;
    case 'maxMana': return caster.mana.total;
    case 'targetMaxHp':
    case 'targetCurrentHp': return target.hp.total;
    case 'targetMissingHp': return 0;
  }
}

export type ComponentDamage = {
  label: string;
  type: DamageType;
  base: number;
  /** What each scaling adds, in the order the ability lists them. */
  scalings: { stat: ComponentStat; value: number }[];
  /** base plus scalings, before armor or magic resist. */
  raw: number;
};

/** Unmitigated damage of one damage line at a rank. Rank 0 (unlearned) is 0. */
export function evaluateComponent(
  c: DamageComponent,
  rank: number,
  caster: StatBreakdown,
  target: StatBreakdown,
): ComponentDamage {
  const learned = rank >= 1;
  const base = learned ? atRank(c.base, rank) : 0;
  const scalings = c.scalings.map((s) => ({
    stat: s.stat,
    value: learned ? atRank(s.ratio, rank) * statValue(s.stat, caster, target) : 0,
  }));
  const raw = scalings.reduce((sum, s) => sum + s.value, base);
  return { label: c.label, type: c.type, base, scalings, raw };
}

export function mitigated(raw: number, type: DamageType, target: StatBreakdown): number {
  if (type === 'true') return raw;
  return mitigate(raw, type === 'physical' ? target.armor.total : target.mr.total);
}

export function comboDamage(
  abilities: Ability[],
  ranks: Record<AbilityKey, number>,
  caster: StatBreakdown,
  target: StatBreakdown,
  autoCount: number,
  /** Hits per cast, in the order of each ability's casts; a missing entry means one hit. */
  hits?: Record<AbilityKey, number[]>,
): { total: number; notModelled: Ability[] } {
  let total = 0;
  const notModelled: Ability[] = [];
  for (const a of abilities) {
    if (a.unread.length > 0) notModelled.push(a);
    a.casts.forEach((cast, i) => {
      const damage = cast.components.reduce(
        (sum, c) => {
          const d = evaluateComponent(c, ranks[a.key], caster, target);
          return sum + mitigated(d.raw, d.type, target);
        },
        0,
      );
      total += count(hits?.[a.key]?.[i] ?? 1) * damage;
    });
  }
  total += count(autoCount) * mitigate(caster.ad.total, target.armor.total);
  return { total, notModelled };
}
