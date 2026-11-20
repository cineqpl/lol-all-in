import { describe, expect, test } from 'vitest';
import { loadData, lookupChampion, sumItemStats, type GameData } from '../src/data/load';

const zero = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0 };
const data: GameData = {
  meta: { patch: '1.0', abilitiesPatch: '0.9' },
  champions: { Annie: { id: 'Annie', name: 'Annie', base: zero, growth: zero } },
  abilities: {},
  items: {
    '1': { name: 'Sword', stats: { ad: 10 }, hasEffects: false },
    '2': { name: 'Cloak', stats: { armor: 20, ad: 5 }, hasEffects: false },
  },
  runes: {},
};

describe('lookupChampion', () => {
  test('returns a known champion', () => expect(lookupChampion(data, 'Annie').name).toBe('Annie'));
  test('unknown id throws with the id in the message', () => {
    expect(() => lookupChampion(data, 'Nobody')).toThrow(/Nobody/);
  });
});

describe('sumItemStats', () => {
  test('sums stats across items', () => {
    expect(sumItemStats(data, ['1', '2', '2'])).toEqual({ ...zero, ad: 20, armor: 40 });
  });
  test('no items gives all zeros', () => expect(sumItemStats(data, [])).toEqual(zero));
  test('unknown item id throws with the id in the message', () => {
    expect(() => sumItemStats(data, ['1', '999'])).toThrow(/999/);
  });
});

describe('loadData', () => {
  test('loads the committed data files', async () => {
    const d = await loadData();
    expect(d.meta.patch).toMatch(/^\d+\.\d+/);
    expect(d.champions.Annie.name).toBe('Annie');
    expect(d.abilities.Annie).toHaveLength(4);
  });
});
