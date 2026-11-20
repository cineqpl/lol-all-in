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
  test('negative resist amplifies but stays finite', () => {
    const v = mitigate(100, -50);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(100);
  });
});

describe('abilityDamage', () => {
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
