import { describe, expect, test } from 'vitest';
import { abilityDamage, comboDamage, mitigate } from '../src/model/damage';
import type { Ability, StatBlock } from '../src/model/types';

const zero: StatBlock = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0 };
const attacker = { total: { ...zero, ap: 100, ad: 80, hp: 2000 }, bonusAd: 20 };
const target: StatBlock = { ...zero, hp: 2000 };

const magicQ: Ability = {
  key: 'Q', name: 'Bolt', damageType: 'magic', baseByRank: [100, 150],
  scalings: [{ stat: 'ap', ratio: 0.5 }], status: 'modelled',
};
const specialW: Ability = {
  key: 'W', name: 'Odd', damageType: 'magic', baseByRank: [50],
  scalings: [], status: 'not-modelled', reason: 'recast',
};

describe('mitigate', () => {
  test('100 resist halves damage', () => expect(mitigate(100, 100)).toBe(50));
  test('0 resist takes full damage', () => expect(mitigate(100, 0)).toBe(100));
  test('200 resist is a 66% reduction', () => expect(mitigate(100, 200)).toBeCloseTo(100 / 3, 6));
  test('negative resist amplifies but stays finite', () => {
    const v = mitigate(100, -50);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(100);
  });
});

describe('abilityDamage', () => {
  test('physical damage uses armor, magic uses MR, true ignores both', () => {
    const tgt = { ...target, armor: 100, mr: 300 };
    const base = { baseByRank: [100], scalings: [], status: 'modelled' as const, key: 'Q' as const, name: 'x' };
    expect(abilityDamage({ ...base, damageType: 'physical' }, 1, attacker, tgt)).toBe(50);
    expect(abilityDamage({ ...base, damageType: 'magic' }, 1, attacker, tgt)).toBe(25);
    expect(abilityDamage({ ...base, damageType: 'true' }, 1, attacker, tgt)).toBe(100);
  });
  test('a not-modelled ability deals nothing', () => {
    expect(abilityDamage(specialW, 1, attacker, target)).toBe(0);
  });
  test('rank 0 deals nothing', () => {
    expect(abilityDamage(magicQ, 0, attacker, target)).toBe(0);
  });
  test('base 100 + 0.5 AP at 100 AP vs 0 MR is 150', () => {
    expect(abilityDamage(magicQ, 1, attacker, target)).toBe(150);
  });
  test('magic damage is reduced by target MR', () => {
    expect(abilityDamage(magicQ, 1, attacker, { ...target, mr: 100 })).toBe(75);
  });
});

describe('comboDamage hit counts', () => {
  const ranks = { Q: 1, W: 0, E: 0, R: 0 };
  const run = (hits: Record<'Q' | 'W' | 'E' | 'R', number> | undefined, autos = 0) =>
    comboDamage([magicQ], ranks, attacker, target, autos, hits).total;
  const hitsQ = (Q: number) => ({ Q, W: 0, E: 0, R: 0 });

  test('an ability that hits three times deals three times the damage', () => {
    expect(run(hitsQ(3))).toBe(450);
  });
  test('zero hits deals nothing', () => expect(run(hitsQ(0))).toBe(0));
  test('omitting hits means one hit per ability', () => expect(run(undefined)).toBe(150));
  test('negative, fractional and non-numeric hit counts are sanitised', () => {
    expect(run(hitsQ(-2))).toBe(0);
    expect(run(hitsQ(2.9))).toBe(300);
    expect(run(hitsQ(NaN))).toBe(0);
  });
  test('autos scale with the count and are cut by armor', () => {
    expect(run(hitsQ(0), 3)).toBe(240);
    expect(comboDamage([], { Q: 0, W: 0, E: 0, R: 0 }, attacker, { ...target, armor: 100 }, 4).total).toBe(160);
  });
  test('negative auto counts deal nothing', () => expect(run(hitsQ(0), -1)).toBe(0));
});

describe('comboDamage', () => {
  test('not-modelled abilities are listed, not summed', () => {
    const r = comboDamage([magicQ, specialW], { Q: 1, W: 1, E: 0, R: 0 }, attacker, target, 0);
    expect(r.total).toBe(150);
    expect(r.notModelled).toEqual([specialW]);
  });
  test('autos add physical damage at attacker AD', () => {
    const r = comboDamage([], { Q: 0, W: 0, E: 0, R: 0 }, attacker, target, 2);
    expect(r.total).toBe(160);
  });
});
