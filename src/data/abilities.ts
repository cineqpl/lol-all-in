import type { Ability, AbilityKey, Scaling } from '../model/types';

type Raw = Record<string, any>;

const KEYS: AbilityKey[] = ['Q', 'W', 'E', 'R'];
const SCALING_UNITS: Record<string, Scaling['stat']> = {
  '% AP': 'ap',
  '% AD': 'ad',
  '% bonus AD': 'bonusAd',
};
const DAMAGE_ATTR = /^(Magic|Physical|True) Damage$/;
const DAMAGE_TYPES = { Magic: 'magic', Physical: 'physical', True: 'true' } as const;

function notModelled(key: AbilityKey, name: string, reason: string): Ability {
  return { key, name, damageType: 'magic', baseByRank: [], scalings: [], status: 'not-modelled', reason };
}

function normaliseOne(key: AbilityKey, ability: Raw): Ability {
  const name: string = ability.name ?? key;
  const levelings: Raw[] = (ability.effects ?? []).flatMap((e: Raw) => e.leveling ?? []);
  const damaging = levelings.filter((l) => /damage/i.test(l.attribute ?? ''));
  if (damaging.length === 0) return notModelled(key, name, 'no damage');
  if (damaging.length > 1 || !DAMAGE_ATTR.test(damaging[0].attribute)) {
    return notModelled(key, name, 'multiple or non-standard damage components');
  }

  const entry = damaging[0];
  const damageType = DAMAGE_TYPES[entry.attribute.split(' ')[0] as keyof typeof DAMAGE_TYPES];
  const [baseMod, ...ratioMods]: Raw[] = entry.modifiers;
  if (!baseMod || baseMod.units.some((u: string) => u !== '')) {
    return notModelled(key, name, 'no flat base damage');
  }

  const scalings: Scaling[] = [];
  for (const mod of ratioMods) {
    const unit: string = mod.units[0];
    const stat = SCALING_UNITS[unit];
    if (!stat) return notModelled(key, name, `unsupported scaling: ${unit}`);
    const values: number[] = mod.values;
    if (values.some((v) => v !== values[0])) {
      return notModelled(key, name, `${unit} ratio changes by rank`);
    }
    scalings.push({ stat, ratio: values[0] / 100 });
  }
  return { key, name, damageType, baseByRank: baseMod.values, scalings, status: 'modelled' };
}

/** Converts one Meraki champion into Q/W/E/R abilities. Anything not computable is flagged not-modelled. */
export function normaliseAbilities(raw: unknown): Ability[] {
  const abilities = (raw as Raw).abilities as Raw;
  return KEYS.map((key) => {
    const variant = abilities[key]?.[0];
    return variant ? normaliseOne(key, variant) : notModelled(key, key, 'no ability data');
  });
}

/** Placeholders for champions the ability source does not know about. */
export function missingAbilities(): Ability[] {
  return KEYS.map((key) => notModelled(key, key, 'no ability data for this champion'));
}
