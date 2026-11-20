import { describe, expect, test } from 'vitest';
import { comboDamage, evaluateComponent, mitigate } from '../src/model/damage';
import type { StatBreakdown } from '../src/model/stats';
import type { Ability, DamageComponent } from '../src/model/types';

type Parts = Partial<Record<keyof StatBreakdown, { base: number; bonus: number }>>;
function fighter(parts: Parts = {}): StatBreakdown {
  const out = {} as StatBreakdown;
  for (const k of ['hp', 'mana', 'armor', 'mr', 'ad', 'ap', 'attackSpeed'] as const) {
    const { base, bonus } = parts[k] ?? { base: 0, bonus: 0 };
    out[k] = { base, bonus, total: base + bonus };
  }
  return out;
}

const attacker = fighter({
  ap: { base: 0, bonus: 100 }, ad: { base: 60, bonus: 20 }, hp: { base: 1500, bonus: 500 },
  armor: { base: 30, bonus: 20 }, mr: { base: 40, bonus: 10 }, mana: { base: 400, bonus: 200 },
});
const target = fighter({ hp: { base: 2000, bonus: 0 } });

const comp = (over: Partial<DamageComponent> = {}): DamageComponent => ({
  label: 'Magic Damage', cast: 'Active', type: 'magic', base: [100, 150], scalings: [], ...over,
});
const ability = (casts: DamageComponent[][], key: 'Q' | 'W' | 'E' | 'R' = 'Q'): Ability => ({
  key, name: 'Test', unread: [],
  casts: casts.map((components, i) => ({ name: `Cast ${i + 1}`, components })),
});
const noRanks = { Q: 0, W: 0, E: 0, R: 0 };

describe('mitigate', () => {
  test('100 resist halves damage', () => expect(mitigate(100, 100)).toBe(50));
  test('0 resist takes full damage', () => expect(mitigate(100, 0)).toBe(100));
  test('200 resist is a 66% reduction', () => expect(mitigate(100, 200)).toBeCloseTo(100 / 3, 6));
  test('negative resist amplifies but stays finite', () => {
    const v = mitigate(100, -50);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBeGreaterThan(100);
  });
});

describe('evaluateComponent', () => {
  test('takes base and a constant ratio by rank', () => {
    const c = comp({ scalings: [{ stat: 'ap', ratio: [0.5] }] });
    const r = evaluateComponent(c, 2, attacker, target);
    expect(r.base).toBe(150);
    expect(r.scalings).toEqual([{ stat: 'ap', value: 50 }]);
    expect(r.raw).toBe(200);
    expect(r.type).toBe('magic');
  });
  test('a ratio with one value per rank follows the rank', () => {
    const c = comp({ type: 'physical', base: [0], scalings: [{ stat: 'ad', ratio: [0.5, 1] }] });
    expect(evaluateComponent(c, 1, attacker, target).raw).toBe(40);
    expect(evaluateComponent(c, 2, attacker, target).raw).toBe(80);
  });
  test('a rank beyond the table uses the last entry, rank 0 deals nothing', () => {
    expect(evaluateComponent(comp(), 9, attacker, target).raw).toBe(150);
    expect(evaluateComponent(comp(), 0, attacker, target).raw).toBe(0);
  });
  test('separates total from bonus and base stats', () => {
    const stat = (s: Parameters<typeof evaluateComponent>[0]['scalings'][0]['stat']) =>
      evaluateComponent(comp({ base: [0], scalings: [{ stat: s, ratio: [1] }] }), 1, attacker, target).raw;
    expect(stat('ad')).toBe(80);
    expect(stat('bonusAd')).toBe(20);
    expect(stat('ap')).toBe(100);
    expect(stat('maxHp')).toBe(2000);
    expect(stat('bonusHp')).toBe(500);
    expect(stat('armor')).toBe(50);
    expect(stat('bonusArmor')).toBe(20);
    expect(stat('mr')).toBe(50);
    expect(stat('bonusMr')).toBe(10);
    expect(stat('maxMana')).toBe(600);
  });
  test('a scaling that goes through a second stat multiplies both', () => {
    const c = comp({ base: [5], scalings: [{ stat: 'targetMaxHp', via: 'ap', ratio: [0.000025] }] });
    const r = evaluateComponent(c, 1, attacker, target); // 0.000025 * 2000 target HP * 100 AP
    expect(r.scalings).toEqual([{ stat: 'targetMaxHp', via: 'ap', value: 5 }]);
    expect(r.raw).toBe(10);
  });
  test('target health scalings assume a target at full health', () => {
    const stat = (s: Parameters<typeof evaluateComponent>[0]['scalings'][0]['stat']) =>
      evaluateComponent(comp({ base: [0], scalings: [{ stat: s, ratio: [0.1] }] }), 1, attacker, target).raw;
    expect(stat('targetMaxHp')).toBe(200);
    expect(stat('targetCurrentHp')).toBe(200);
    expect(stat('targetMissingHp')).toBe(0);
  });
});

describe('comboDamage', () => {
  const bolt = ability([[comp({ scalings: [{ stat: 'ap', ratio: [0.5] }] })]]);
  const physical = ability([[comp({ type: 'physical', base: [100] })]]);
  const run = (a: Ability[], hits?: Record<'Q' | 'W' | 'E' | 'R', number[]>, autos = 0, tgt = target, rank = 1) =>
    comboDamage(a, { ...noRanks, Q: rank, W: rank, E: rank, R: rank }, attacker, tgt, autos, hits).total;

  test('physical damage uses armor, magic uses MR, true ignores both', () => {
    const tgt = fighter({ hp: { base: 2000, bonus: 0 }, armor: { base: 100, bonus: 0 }, mr: { base: 300, bonus: 0 } });
    expect(run([physical], undefined, 0, tgt)).toBe(50);
    expect(run([ability([[comp({ base: [100] })]])], undefined, 0, tgt)).toBe(25);
    expect(run([ability([[comp({ type: 'true', base: [100] })]])], undefined, 0, tgt)).toBe(100);
  });
  test('base 100 + 0.5 AP at 100 AP vs 0 MR is 150, and MR reduces it', () => {
    expect(run([bolt])).toBe(150);
    expect(run([bolt], undefined, 0, fighter({ mr: { base: 100, bonus: 0 } }))).toBe(75);
  });
  test('rank 0 deals nothing', () => expect(run([bolt], undefined, 0, target, 0)).toBe(0));

  test('each cast has its own hit count and damage', () => {
    const two = ability([[comp({ base: [100] })], [comp({ base: [10] })]]);
    expect(run([two])).toBe(110);
    expect(run([two], { Q: [3, 1], W: [], E: [], R: [] })).toBe(310);
    expect(run([two], { Q: [0, 2], W: [], E: [], R: [] })).toBe(20);
  });
  test('a cast with several damage lines sums them', () => {
    const both = ability([[comp({ base: [100] }), comp({ type: 'true', base: [5] })]]);
    expect(run([both])).toBe(105);
  });
  test('negative, fractional and non-numeric hit counts are sanitised', () => {
    const hits = (n: number) => ({ Q: [n], W: [], E: [], R: [] });
    expect(run([bolt], hits(-2))).toBe(0);
    expect(run([bolt], hits(2.9))).toBe(300);
    expect(run([bolt], hits(NaN))).toBe(0);
  });
  test('autos scale with the count and are cut by armor', () => {
    expect(run([], undefined, 3)).toBe(240);
    expect(run([], undefined, 4, fighter({ armor: { base: 100, bonus: 0 } }))).toBe(160);
    expect(run([], undefined, -1)).toBe(0);
  });
  test('abilities with unread damage lines are listed, the readable lines still count', () => {
    const odd: Ability = { ...bolt, key: 'W', unread: ['"Damage": unknown scaling "x"'] };
    const r = comboDamage([bolt, odd], { ...noRanks, Q: 1, W: 1 }, attacker, target, 0);
    expect(r.total).toBe(300);
    expect(r.notModelled).toEqual([odd]);
  });
});
