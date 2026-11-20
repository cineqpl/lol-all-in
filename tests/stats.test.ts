import { describe, expect, test } from 'vitest';
import { statsAtLevel } from '../src/model/stats';
import type { ChampionBase } from '../src/model/types';

const champ: ChampionBase = {
  id: 'Test',
  name: 'Test',
  base: { hp: 600, mana: 300, armor: 30, mr: 32, ad: 60, ap: 0 },
  growth: { hp: 100, mana: 40, armor: 4, mr: 1.25, ad: 3, ap: 0 },
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

  test('levels outside 1-18 clamp', () => {
    expect(statsAtLevel(champ, 0)).toEqual(statsAtLevel(champ, 1));
    expect(statsAtLevel(champ, 19)).toEqual(statsAtLevel(champ, 18));
  });
});
