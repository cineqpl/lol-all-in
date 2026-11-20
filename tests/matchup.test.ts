import { describe, expect, test } from 'vitest';
import { computeMatchup, type Side } from '../src/model/matchup';
import type { Ability, StatBlock } from '../src/model/types';

const zero: StatBlock = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0 };

function side(damage: number, id = 'X'): Side {
  const q: Ability = {
    key: 'Q', name: 'Q', damageType: 'true', baseByRank: [damage],
    scalings: [], status: 'modelled',
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
    you.abilities = [{ key: 'W', name: 'W', damageType: 'magic', baseByRank: [], scalings: [], status: 'not-modelled', reason: 'recast' }];
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
    const you = withCombo(strong(), { hits: { Q: 3, W: 0, E: 0, R: 0 }, autos: 5 });
    expect(computeMatchup(you, side(0)).yourDamage).toBe(3 * 100 + 5 * 50);
  });
  test('each side uses its own combo', () => {
    const you = withCombo(side(100), { hits: { Q: 2, W: 0, E: 0, R: 0 }, autos: 0 });
    const enemy = withCombo(side(100), { hits: { Q: 1, W: 0, E: 0, R: 0 }, autos: 0 });
    const r = computeMatchup(you, enemy);
    expect(r.yourDamage).toBe(200);
    expect(r.enemyDamage).toBe(100);
  });
});
