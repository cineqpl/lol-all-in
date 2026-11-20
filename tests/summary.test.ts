import { describe, expect, test } from 'vitest';
import type { Side } from '../src/model/matchup';
import { summarizeStats } from '../src/model/summary';
import type { StatBlock } from '../src/model/types';

const zero: StatBlock = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0, attackSpeed: 0 };

function side(resource: string | undefined, level: number, itemStats: Partial<StatBlock> = {}): Side {
  return {
    champion: {
      id: 'X', name: 'X', resource,
      base: { ...zero, hp: 600, mana: 300, ad: 60, armor: 20, mr: 30, attackSpeed: 0.625 },
      growth: { ...zero, hp: 100, mana: 40, ad: 3, armor: 4, mr: 1.5, attackSpeed: 0.02 },
    },
    abilities: [],
    build: { championId: 'X', level, ranks: { Q: 0, W: 0, E: 0, R: 0 }, itemIds: [], runeIds: [] },
    itemStats: { ...zero, ...itemStats },
  };
}

describe('summarizeStats', () => {
  test('level 1 with no items is all base', () => {
    const s = summarizeStats(side('Mana', 1));
    expect(s.hp).toEqual({ base: 600, bonus: 0, total: 600 });
    expect(s.ad).toEqual({ base: 60, bonus: 0, total: 60 });
    expect(s.ap).toEqual({ base: 0, bonus: 0, total: 0 });
    expect(s.armor).toEqual({ base: 20, bonus: 0, total: 20 });
    expect(s.mr).toEqual({ base: 30, bonus: 0, total: 30 });
    expect(s.attackSpeed).toEqual({ base: 0.625, bonus: 0, total: 0.625 });
    expect(s.resource).toEqual({ label: 'Mana', base: 300, bonus: 0, total: 300 });
  });

  test('level growth is base, item stats are bonus', () => {
    const s = summarizeStats(side('Mana', 18, { hp: 200, ad: 40, ap: 120, mana: 500 }));
    expect(s.hp.base).toBeCloseTo(600 + 100 * 17, 6);
    expect(s.hp.bonus).toBe(200);
    expect(s.hp.total).toBeCloseTo(600 + 100 * 17 + 200, 6);
    expect(s.ad.base).toBeCloseTo(60 + 3 * 17, 6);
    expect(s.ad.bonus).toBe(40);
    expect(s.ap).toEqual({ base: 0, bonus: 120, total: 120 });
    expect(s.resource?.bonus).toBe(500);
    expect(s.resource?.total).toBeCloseTo(300 + 40 * 17 + 500, 6);
  });

  test('armor and magic resist split into base and bonus', () => {
    const s = summarizeStats(side('Mana', 18, { armor: 40, mr: 25 }));
    expect(s.armor.base).toBeCloseTo(20 + 4 * 17, 6);
    expect(s.armor.bonus).toBe(40);
    expect(s.mr.base).toBeCloseTo(30 + 1.5 * 17, 6);
    expect(s.mr.bonus).toBe(25);
  });

  test('attack speed: only the base value is base; growth and items are bonus', () => {
    const s = summarizeStats(side('Mana', 10, { attackSpeed: 0.3 }));
    const mult = 9 * (0.7025 + 0.0175 * 9);
    expect(s.attackSpeed.base).toBe(0.625);
    expect(s.attackSpeed.bonus).toBeCloseTo(0.625 * (0.02 * mult + 0.3), 6);
    expect(s.attackSpeed.total).toBeCloseTo(0.625 * (1 + 0.02 * mult + 0.3), 6);
  });

  test('energy champions ignore item mana', () => {
    const s = summarizeStats(side('Energy', 1, { mana: 500 }));
    expect(s.resource).toEqual({ label: 'Energy', base: 300, bonus: 0, total: 300 });
  });

  test('champions with another or no resource show none', () => {
    expect(summarizeStats(side('Fury', 1)).resource).toBeUndefined();
    expect(summarizeStats(side('None', 1)).resource).toBeUndefined();
    expect(summarizeStats(side(undefined, 1)).resource).toBeUndefined();
  });
});
