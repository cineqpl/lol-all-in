import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { normaliseChampions, normaliseItems, normaliseRunes } from '../src/data/normalise';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/${f}`, 'utf8'));

describe('normaliseChampions', () => {
  const champs = normaliseChampions(fx('dd-champion.json'));
  const annie = champs.find((c) => c.id === 'Annie')!;

  test('base and growth stats match Data Dragon values', () => {
    expect(annie.name).toBe('Annie');
    expect(annie.base).toEqual({ hp: 560, mana: 418, armor: 23, mr: 30, ad: 50, ap: 0 });
    expect(annie.growth.hp).toBe(96);
    expect(annie.growth.mana).toBe(25);
    expect(annie.growth.mr).toBe(1.3);
    expect(annie.growth.ap).toBe(0);
  });

  test('keeps the Data Dragon id, not the display name', () => {
    expect(champs.some((c) => c.id === 'MonkeyKing' && c.name === 'Wukong')).toBe(true);
  });
});

describe('normaliseItems', () => {
  const items = normaliseItems(fx('dd-item.json'));

  test('flat-stat item has no effects', () => {
    expect(items['1036']).toMatchObject({ name: 'Long Sword', stats: { ad: 10 }, hasEffects: false });
  });
  test('item with a passive is flagged hasEffects', () => {
    expect(items['3089']).toMatchObject({ stats: { ap: 130 }, hasEffects: true });
  });
});

describe('normaliseRunes', () => {
  test('flattens trees into an id lookup', () => {
    const runes = normaliseRunes(fx('dd-runes.json'));
    const first = Object.values(runes)[0];
    expect(first.name).toBeTruthy();
    expect(first.tree).toBeTruthy();
  });
});

describe('normaliseItems filtering', () => {
  const raw = {
    data: {
      '1': { name: 'Sword', description: '', stats: { FlatPhysicalDamageMod: 10 }, maps: { '11': true }, gold: { purchasable: true } },
      '771': { name: 'Sword', description: '', stats: { FlatPhysicalDamageMod: 12 }, maps: { '11': false, '30': true }, gold: { purchasable: true } },
      '2': { name: 'Hidden', description: '', stats: { FlatHPPoolMod: 5 }, maps: { '11': true }, gold: { purchasable: false } },
    },
  };
  test('keeps only purchasable Summoners Rift items', () => {
    expect(Object.keys(normaliseItems(raw))).toEqual(['1']);
  });
});
