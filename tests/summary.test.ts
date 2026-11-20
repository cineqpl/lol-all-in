import { describe, expect, test } from 'vitest';
import type { Side } from '../src/model/matchup';
import { summarizeStats } from '../src/model/summary';
import type { StatBlock } from '../src/model/types';

const zero: StatBlock = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0 };

function side(resource: string | undefined, level: number, itemStats: Partial<StatBlock> = {}): Side {
  return {
    champion: {
      id: 'X', name: 'X', resource,
      base: { ...zero, hp: 600, mana: 300, ad: 60 },
      growth: { ...zero, hp: 100, mana: 40, ad: 3 },
    },
    abilities: [],
    build: { championId: 'X', level, ranks: { Q: 0, W: 0, E: 0, R: 0 }, itemIds: [], runeIds: [] },
    itemStats: { ...zero, ...itemStats },
  };
}

describe('summarizeStats', () => {
  test('level 1 with no items is the base stats', () => {
    expect(summarizeStats(side('Mana', 1))).toEqual({
      hp: 600, ad: 60, ap: 0, resource: { label: 'Mana', value: 300 },
    });
  });

  test('adds level growth and item stats', () => {
    const s = summarizeStats(side('Mana', 18, { hp: 200, ad: 40, ap: 120, mana: 500 }));
    expect(s.hp).toBeCloseTo(600 + 100 * 17 + 200, 6);
    expect(s.ad).toBeCloseTo(60 + 3 * 17 + 40, 6);
    expect(s.ap).toBe(120);
    expect(s.resource).toEqual({ label: 'Mana', value: expect.closeTo(300 + 40 * 17 + 500, 6) });
  });

  test('energy champions ignore item mana', () => {
    const s = summarizeStats(side('Energy', 1, { mana: 500 }));
    expect(s.resource).toEqual({ label: 'Energy', value: 300 });
  });

  test('champions with another or no resource show none', () => {
    expect(summarizeStats(side('Fury', 1)).resource).toBeUndefined();
    expect(summarizeStats(side('None', 1)).resource).toBeUndefined();
    expect(summarizeStats(side(undefined, 1)).resource).toBeUndefined();
  });
});
