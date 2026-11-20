import { describe, expect, test } from 'vitest';
import { statBreakdown, statsAtLevel } from '../src/model/stats';
import type { ChampionBase } from '../src/model/types';

const champ: ChampionBase = {
  id: 'Test',
  name: 'Test',
  base: { hp: 600, mana: 300, armor: 30, mr: 32, ad: 60, ap: 0, attackSpeed: 0.625 },
  growth: { hp: 100, mana: 40, armor: 4, mr: 1.25, ad: 3, ap: 0, attackSpeed: 0.02 },
};

describe('statsAtLevel', () => {
  test('level 1 returns base values exactly', () => {
    expect(statsAtLevel(champ, 1)).toEqual(champ.base);
  });

  test('level 18 returns base + growth * 17', () => {
    const s = statsAtLevel(champ, 18);
    expect(s.hp).toBeCloseTo(600 + 100 * 17, 6);
    expect(s.armor).toBeCloseTo(30 + 4 * 17, 6);
    expect(s.ad).toBeCloseTo(60 + 3 * 17, 6);
  });

  test('level 2 returns base + growth * 0.72', () => {
    const s = statsAtLevel(champ, 2);
    expect(s.hp).toBeCloseTo(600 + 100 * 0.72, 6);
    expect(s.mr).toBeCloseTo(32 + 1.25 * 0.72, 6);
  });

  test('levels 19 and 20 keep scaling (top lane role quest)', () => {
    expect(statsAtLevel(champ, 20).hp).toBeCloseTo(600 + 100 * 19.665, 6);
    expect(statsAtLevel(champ, 19).ad).toBeCloseTo(60 + 3 * 18 * (0.7025 + 0.0175 * 18), 6);
  });

  test('attack speed grows as a percentage of base', () => {
    const mult = 9 * (0.7025 + 0.0175 * 9);
    expect(statsAtLevel(champ, 10).attackSpeed).toBeCloseTo(0.625 * (1 + 0.02 * mult), 6);
  });

  test('levels outside 1-20 clamp', () => {
    expect(statsAtLevel(champ, 0)).toEqual(statsAtLevel(champ, 1));
    expect(statsAtLevel(champ, 21)).toEqual(statsAtLevel(champ, 20));
  });
});

const noItems = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0, attackSpeed: 0 };

describe('statBreakdown', () => {
  test('without items everything is base, except attack speed growth which is bonus', () => {
    const b = statBreakdown(champ, 10, noItems);
    const mult = 9 * (0.7025 + 0.0175 * 9);
    expect(b.hp).toEqual({ base: expect.closeTo(600 + 100 * mult, 6), bonus: 0, total: expect.closeTo(600 + 100 * mult, 6) });
    expect(b.ap).toEqual({ base: 0, bonus: 0, total: 0 });
    expect(b.attackSpeed.base).toBe(0.625);
    expect(b.attackSpeed.bonus).toBeCloseTo(0.625 * 0.02 * mult, 6);
    expect(b.attackSpeed.total).toBeCloseTo(0.625 * (1 + 0.02 * mult), 6);
  });

  test('item stats are bonus, champion level growth stays base', () => {
    const b = statBreakdown(champ, 1, { ...noItems, hp: 200, ad: 40, ap: 120, armor: 30, mr: 25, mana: 500 });
    expect(b.hp).toEqual({ base: 600, bonus: 200, total: 800 });
    expect(b.ad).toEqual({ base: 60, bonus: 40, total: 100 });
    expect(b.ap).toEqual({ base: 0, bonus: 120, total: 120 });
    expect(b.armor).toEqual({ base: 30, bonus: 30, total: 60 });
    expect(b.mr).toEqual({ base: 32, bonus: 25, total: 57 });
    expect(b.mana).toEqual({ base: 300, bonus: 500, total: 800 });
  });

  test('item attack speed is a percentage of base, added to the growth percentage', () => {
    const b = statBreakdown(champ, 10, { ...noItems, attackSpeed: 0.3 });
    const mult = 9 * (0.7025 + 0.0175 * 9);
    expect(b.attackSpeed.base).toBe(0.625);
    expect(b.attackSpeed.bonus).toBeCloseTo(0.625 * (0.02 * mult + 0.3), 6);
    expect(b.attackSpeed.total).toBeCloseTo(0.625 * (1 + 0.02 * mult + 0.3), 6);
  });
});
