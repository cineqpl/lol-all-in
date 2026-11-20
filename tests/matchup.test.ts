import { describe, expect, test } from 'vitest';
import { computeMatchup, type Side } from '../src/model/matchup';
import type { Ability, StatBlock } from '../src/model/types';

const zero: StatBlock = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0, attackSpeed: 0 };

function side(damage: number, id = 'X'): Side {
  const q: Ability = {
    key: 'Q', name: 'Q', unread: [],
    casts: [{ name: 'Active', components: [{ label: 'True Damage', cast: 'Active', type: 'true', base: [damage], scalings: [] }] }],
  };
  return {
    champion: { id, name: id, base: { ...zero, hp: 1000 }, growth: zero },
    abilities: damage > 0 ? [q] : [],
    build: { championId: id, level: 1, ranks: { Q: 1, W: 0, E: 0, R: 0 }, itemIds: [], runeIds: [] },
    itemStats: zero,
  };
}

describe('computeMatchup', () => {
  test('even when neither side can kill', () => {
    const r = computeMatchup(side(500), side(500));
    expect(r.status).toBe('even');
    expect(r.yourPctOfEnemyHp).toBeCloseTo(0.5);
    expect(r.enemyPctOfYourHp).toBeCloseTo(0.5);
  });
  test('safe when you can kill and they cannot', () => {
    expect(computeMatchup(side(1000), side(500)).status).toBe('safe');
  });
  test('danger when they can kill you', () => {
    expect(computeMatchup(side(100), side(1000)).status).toBe('danger');
  });
  test('danger wins when both can kill', () => {
    expect(computeMatchup(side(1000), side(1000)).status).toBe('danger');
  });
  test('mirror matchup is symmetric', () => {
    const r = computeMatchup(side(300, 'A'), side(300, 'A'));
    expect(r.yourDamage).toBe(r.enemyDamage);
  });
  test('champion with no modelled abilities deals 0 and does not throw', () => {
    const r = computeMatchup(side(0), side(0));
    expect(r.yourDamage).toBe(0);
    expect(r.status).toBe('even');
  });
  test('reports not-modelled abilities per side', () => {
    const you = side(0);
    you.abilities = [{ key: 'W', name: 'W', casts: [], unread: ['"Damage": unknown scaling'] }];
    expect(computeMatchup(you, side(0)).yourNotModelled).toHaveLength(1);
  });
});

describe('unmodelled effects', () => {
  test('are passed through per side', () => {
    const you = { ...side(0), unmodelledEffects: ['Rabadon (item)'] };
    const r = computeMatchup(you, side(0));
    expect(r.yourUnmodelledEffects).toEqual(['Rabadon (item)']);
    expect(r.enemyUnmodelledEffects).toEqual([]);
  });
});

describe('user-defined combo', () => {
  const withCombo = (s: Side, combo: Side['combo']): Side => ({ ...s, combo });
  const strong = (): Side => {
    const s = side(100);
    s.champion = { ...s.champion, base: { ...s.champion.base, ad: 50 } };
    return s;
  };
  test('without a combo, each ability hits once and two autos are thrown', () => {
    expect(computeMatchup(strong(), side(0)).yourDamage).toBe(100 + 2 * 50);
  });
  test('hit counts and auto count come from the combo', () => {
    const you = withCombo(strong(), { hits: { Q: [3], W: [], E: [], R: [] }, autos: 5 });
    expect(computeMatchup(you, side(0)).yourDamage).toBe(3 * 100 + 5 * 50);
  });
  test('each side uses its own combo', () => {
    const you = withCombo(side(100), { hits: { Q: [2], W: [], E: [], R: [] }, autos: 0 });
    const enemy = withCombo(side(100), { hits: { Q: [1], W: [], E: [], R: [] }, autos: 0 });
    const r = computeMatchup(you, enemy);
    expect(r.yourDamage).toBe(200);
    expect(r.enemyDamage).toBe(100);
  });
});

describe('ignite', () => {
  const noHits = { Q: [0], W: [], E: [], R: [] };
  const withCombo = (s: Side, level: number, ignite?: boolean): Side => ({
    ...s,
    build: { ...s.build, level },
    combo: { hits: noHits, autos: 0, ignite },
  });
  const armored = (): Side => {
    const s = side(0, 'E');
    return { ...s, champion: { ...s.champion, base: { ...zero, hp: 1000, armor: 100, mr: 100 } } };
  };

  test('adds level-based damage that armor and magic resist do not reduce', () => {
    const r = computeMatchup(withCombo(side(0), 6, true), armored());
    expect(r.yourDamage).toBe(175);
  });
  test('adds nothing unless chosen', () => {
    expect(computeMatchup(withCombo(side(0), 6), armored()).yourDamage).toBe(0);
    expect(computeMatchup(withCombo(side(0), 6, false), armored()).yourDamage).toBe(0);
  });
  test('applies to the enemy side too, using their level', () => {
    const r = computeMatchup(side(0), withCombo(side(0, 'E'), 18, true));
    expect(r.enemyDamage).toBe(475);
  });
});
