import { describe, expect, it } from 'vitest';
import { applyOverride, riskReasons } from '../src/data/overrides';
import type { Ability, Cast, DamageComponent } from '../src/model/types';

const comp = (label = 'Physical Damage'): DamageComponent => ({ label, cast: 'Active', type: 'physical', base: [10], scalings: [] });
const cast = (name: string, ...components: DamageComponent[]): Cast => ({ name, components });
const ability = (casts: Cast[], unread: string[] = []): Ability => ({ key: 'Q', name: 'Test', casts, unread });

describe('riskReasons', () => {
  it('is empty for one cast with one plain damage line, and for utility', () => {
    expect(riskReasons(ability([cast('Active', comp())]))).toEqual([]);
    expect(riskReasons(ability([]))).toEqual([]);
  });
  it('flags unread lines, several casts, several lines in a cast, and stack/tick wording', () => {
    expect(riskReasons(ability([cast('Active', comp())], ['x: unknown scaling'])).join()).toMatch(/unread/);
    expect(riskReasons(ability([cast('A', comp()), cast('B', comp())])).join()).toMatch(/2 casts/);
    expect(riskReasons(ability([cast('A', comp(), comp('Bonus Damage'))])).join()).toMatch(/several damage lines/);
    expect(riskReasons(ability([cast('A', comp('Damage per Tick'))])).join()).toMatch(/per-hit wording/);
    expect(riskReasons(ability([cast('A', comp('Empowered Damage'))])).join()).toMatch(/per-hit wording/);
  });
});

describe('applyOverride', () => {
  const parsed = ability([cast('Active', comp())], ['Damage: unknown scaling "x"']);
  it('leaves an unchecked ability exactly as parsed', () => {
    expect(applyOverride(parsed, { status: 'unchecked', override: null })).toEqual(parsed);
    expect(applyOverride(parsed, undefined)).toEqual(parsed);
  });
  it('an ability marked ok keeps its casts and stops being reported as unread', () => {
    const r = applyOverride(parsed, { status: 'ok', override: null });
    expect(r.casts).toEqual(parsed.casts);
    expect(r.unread).toEqual([]);
  });
  it('an override replaces the casts and clears the unread warning', () => {
    const fixed = [cast('Active', comp('Fixed'))];
    const r = applyOverride(parsed, { status: 'fixed', override: { casts: fixed } });
    expect(r.casts).toEqual(fixed);
    expect(r.unread).toEqual([]);
    expect(r.name).toBe('Test');
  });
});
