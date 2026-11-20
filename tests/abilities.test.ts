import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { missingAbilities, normaliseAbilities } from '../src/data/abilities';

const meraki = JSON.parse(readFileSync('tests/fixtures/meraki-champions.json', 'utf8'));

/** Build a minimal Meraki champion with one Q ability. */
function champWithQ(damageType: string | null, leveling: unknown[]) {
  return {
    abilities: {
      P: [], W: [], E: [], R: [],
      Q: [{ name: 'Test Q', damageType, effects: [{ description: '', leveling }] }],
    },
  };
}
const entry = (attribute: string, ...mods: [number[], string][]) => ({
  attribute,
  modifiers: mods.map(([values, u]) => ({ values, units: values.map(() => u) })),
});
const qOf = (raw: unknown) => normaliseAbilities(raw).find((a) => a.key === 'Q')!;

describe('normaliseAbilities', () => {
  test("Annie's Q from real data is modelled with base per rank and 0.8 AP ratio", () => {
    const q = qOf(meraki.Annie);
    expect(q).toMatchObject({
      key: 'Q', name: 'Disintegrate', damageType: 'magic', status: 'modelled',
      baseByRank: [80, 120, 160, 200, 240],
      scalings: [{ stat: 'ap', ratio: 0.8 }],
    });
  });

  test('flat base plus AD and bonus AD ratios convert percent to ratio', () => {
    const q = qOf(champWithQ('PHYSICAL_DAMAGE', [
      entry('Physical Damage', [[10, 20, 30], ''], [[100, 100, 100], '% AD'], [[50, 50, 50], '% bonus AD']),
    ]));
    expect(q.status).toBe('modelled');
    expect(q.damageType).toBe('physical');
    expect(q.scalings).toEqual([{ stat: 'ad', ratio: 1 }, { stat: 'bonusAd', ratio: 0.5 }]);
  });

  test('unsupported scaling is not-modelled and names the unit', () => {
    const q = qOf(champWithQ('MAGIC_DAMAGE', [
      entry('Magic Damage', [[10, 20], ''], [[8, 8], "% of target's missing health"]),
    ]));
    expect(q.status).toBe('not-modelled');
    expect(q.reason).toContain("missing health");
  });

  test('utility ability with no damage is not-modelled with reason "no damage"', () => {
    const q = qOf(champWithQ(null, [entry('Slow', [[20, 30], '%'])]));
    expect(q).toMatchObject({ status: 'not-modelled', reason: 'no damage' });
  });

  test('multiple damage components are not-modelled', () => {
    const q = qOf(champWithQ('MAGIC_DAMAGE', [
      entry('Magic Damage', [[10, 20], '']), entry('Bonus Magic Damage', [[5, 6], '']),
    ]));
    expect(q.status).toBe('not-modelled');
  });

  test('ratio that changes by rank is not-modelled', () => {
    const q = qOf(champWithQ('MAGIC_DAMAGE', [
      entry('Magic Damage', [[10, 20], ''], [[50, 60], '% AP']),
    ]));
    expect(q.status).toBe('not-modelled');
  });

  test('every ability from real data has a key, and every not-modelled one a reason', () => {
    for (const champ of Object.values(meraki)) {
      const abilities = normaliseAbilities(champ);
      expect(abilities.map((a) => a.key)).toEqual(['Q', 'W', 'E', 'R']);
      for (const a of abilities) if (a.status === 'not-modelled') expect(a.reason).toBeTruthy();
    }
  });
});

describe('missingAbilities', () => {
  test('returns four not-modelled placeholders with a reason', () => {
    const a = missingAbilities();
    expect(a.map((x) => x.key)).toEqual(['Q', 'W', 'E', 'R']);
    expect(a.every((x) => x.status === 'not-modelled' && x.reason)).toBe(true);
  });
});
