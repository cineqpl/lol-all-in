import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  abilityIconFiles,
  applyAdGrowth,
  normaliseChampions,
  normaliseItems,
  normaliseRunes,
} from '../src/data/normalise';

const fx = (f: string) => JSON.parse(readFileSync(`tests/fixtures/${f}`, 'utf8'));

describe('normaliseChampions', () => {
  const champs = normaliseChampions(fx('dd-champion.json'));
  const annie = champs.find((c) => c.id === 'Annie')!;

  test('base and growth stats match Data Dragon values', () => {
    expect(annie.name).toBe('Annie');
    expect(annie.base).toEqual({ hp: 560, mana: 418, armor: 23, mr: 30, ad: 50, ap: 0, attackSpeed: 0.61 });
    expect(annie.growth.hp).toBe(96);
    expect(annie.growth.mana).toBe(25);
    expect(annie.growth.mr).toBe(1.3);
    expect(annie.growth.ap).toBe(0);
  });

  test('attack speed growth is stored as a fraction of base (Data Dragon gives percent)', () => {
    expect(annie.growth.attackSpeed).toBeCloseTo(0.0136, 10);
  });

  test('keeps the resource type (partype)', () => {
    expect(annie.resource).toBe('Mana');
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
  test('percent attack speed becomes a bonus fraction', () => {
    const raw = {
      data: {
        '9': {
          name: 'Dagger', description: '', maps: { '11': true }, gold: { purchasable: true },
          stats: { PercentAttackSpeedMod: 0.12, FlatPhysicalDamageMod: 5 },
        },
      },
    };
    expect(normaliseItems(raw)['9'].stats).toEqual({ attackSpeed: 0.12, ad: 5 });
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

describe('abilityIconFiles', () => {
  test('returns the Q/W/E/R icon file names in order', () => {
    expect(abilityIconFiles(fx('dd-champion-detail.json'), 'Annie')).toEqual([
      'AnnieQ.png', 'AnnieW.png', 'AnnieE.png', 'AnnieR.png',
    ]);
  });
  test('unknown champion id throws naming the id', () => {
    expect(() => abilityIconFiles(fx('dd-champion-detail.json'), 'Nobody')).toThrow(/Nobody/);
  });
});

describe('applyAdGrowth', () => {
  const meraki = fx('meraki-champions.json');
  const champs = normaliseChampions(fx('dd-champion.json'));
  const fixed = applyAdGrowth(champs, meraki);
  const byId = Object.fromEntries(fixed.map((c) => [c.id, c]));

  test('Data Dragon reports 0 AD growth, so Meraki growth is used', () => {
    expect(champs.find((c) => c.id === 'Annie')!.growth.ad).toBe(0);
    expect(byId.Annie.growth.ad).toBe(2.65);
    expect(byId.Annie.adGrowthUnknown).toBeUndefined();
  });
  test('a champion unknown to Meraki is flagged and keeps 0', () => {
    expect(byId.Locke.growth.ad).toBe(0);
    expect(byId.Locke.adGrowthUnknown).toBe(true);
  });
  test('a positive Data Dragon value wins over Meraki', () => {
    const dd = [{ ...champs[0], growth: { ...champs[0].growth, ad: 3.3 } }];
    expect(applyAdGrowth(dd, { [dd[0].id]: { stats: { attackDamage: { perLevel: 9 } } } })[0].growth.ad).toBe(3.3);
  });
  test('an explicit 0 from Meraki is real zero growth, not unknown', () => {
    const dd = [champs[0]];
    const out = applyAdGrowth(dd, { [dd[0].id]: { stats: { attackDamage: { perLevel: 0 } } } })[0];
    expect(out.growth.ad).toBe(0);
    expect(out.adGrowthUnknown).toBeUndefined();
  });
  test('does not change other stats', () => {
    expect(byId.Annie.base).toEqual(champs.find((c) => c.id === 'Annie')!.base);
    expect(byId.Annie.growth.hp).toBe(96);
  });
});
