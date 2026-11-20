import { describe, expect, it } from 'vitest';
import { abilitiesFromWiki, parseComponents } from '../src/data/components';
import type { WikiAbility } from '../src/data/wiki';

function ability(rows: { text: string; values: [string, string][] }[]): WikiAbility {
  return {
    slot: 'q',
    name: 'Test',
    stats: [],
    rows: rows.map((r) => ({ text: r.text, values: r.values.map(([label, value]) => ({ label, value })) })),
  };
}

describe('parseComponents', () => {
  it('reads base, scaling and type of a simple ability', () => {
    const { components, skipped } = parseComponents(
      ability([{ text: 'Active: Annie fires a bolt.', values: [['Magic Damage', '80 / 125 / 170 / 215 / 260 (+ 80% AP)']] }]),
    );
    expect(skipped).toEqual([]);
    expect(components).toEqual([
      {
        label: 'Magic Damage',
        cast: 'Active',
        type: 'magic',
        base: [80, 125, 170, 215, 260],
        scalings: [{ stat: 'ap', ratio: [0.8] }],
      },
    ]);
  });

  it('keeps a ratio that changes per rank as one value per rank', () => {
    const { components } = parseComponents(
      ability([{ text: 'Active: x', values: [['Physical Damage', '10 / 25 (+ 60 / 67.5% AD)']] }]),
    );
    expect(components[0].scalings).toEqual([{ stat: 'ad', ratio: [0.6, 0.675] }]);
  });

  it('separates bonus stats from total stats, in any order', () => {
    const { components } = parseComponents(
      ability([{ text: 'Active: x', values: [['Magic Damage', '110 / 220 / 330 (+ 50% bonus AD) (+ 30% AP) (+ 8% of his bonus health)']] }]),
    );
    expect(components[0].scalings).toEqual([
      { stat: 'bonusAd', ratio: [0.5] },
      { stat: 'ap', ratio: [0.3] },
      { stat: 'bonusHp', ratio: [0.08] },
    ]);
  });

  it('treats a percent-only value as a scaling with no flat base', () => {
    const { components } = parseComponents(
      ability([
        { text: 'Active: Darius empowers his next attack.', values: [['Bonus Physical Damage', '40 / 45 / 50 / 55 / 60% AD']] },
        { text: 'Passive: x', values: [['Magic Damage', "8 / 9 / 10% of target's maximum health"]] },
      ]),
    );
    expect(components[0].base).toEqual([0]);
    expect(components[0].scalings).toEqual([{ stat: 'ad', ratio: [0.4, 0.45, 0.5, 0.55, 0.6] }]);
    expect(components[1].scalings).toEqual([{ stat: 'targetMaxHp', ratio: [0.08, 0.09, 0.1] }]);
  });

  it('makes one cast per stage so each recast gets its own hit count', () => {
    const { components } = parseComponents(
      ability([
        { text: 'Active: three strikes dealing physical damage.', values: [] },
        { text: 'First Cast: a strike dealing physical damage.', values: [['First Cast Damage', '10 / 25 (+ 60% AD)']] },
        { text: 'Second Cast: another strike.', values: [['Second Cast Damage', '12.5 / 31.25 (+ 75% AD)']] },
      ]),
    );
    expect(components.map((c) => c.cast)).toEqual(['First Cast', 'Second Cast']);
  });

  it('takes the damage type from the ability text when the label has none', () => {
    const { components } = parseComponents(
      ability([{ text: 'Active: deals physical damage to enemies.', values: [['Damage', '50 (+ 10% AD)']] }]),
    );
    expect(components[0].type).toBe('physical');
  });

  it('skips sweetspot, reduced, minion and total lines, saying why', () => {
    const { components, skipped } = parseComponents(
      ability([
        {
          text: 'First Cast: a strike dealing physical damage.',
          values: [
            ['First Cast Damage', '10 (+ 60% AD)'],
            ['First Sweetspot Damage', '17.5 (+ 105% AD)'],
            ['Reduced Damage', '5 (+ 30% AD)'],
            ['Minion Damage', '60 (+ 80% AD)'],
            ['Total Damage', '70 (+ 80% AD)'],
          ],
        },
      ]),
    );
    expect(components.map((c) => c.label)).toEqual(['First Cast Damage']);
    expect(skipped.map((s) => [s.label, s.reason])).toEqual([
      ['First Sweetspot Damage', 'sweetspot'],
      ['Reduced Damage', 'secondary target'],
      ['Minion Damage', 'not against champions'],
      ['Total Damage', 'sum of other lines'],
    ]);
  });

  it('uses the minimum of a min-to-max range, and reports lines it cannot read instead of guessing', () => {
    const { components, skipped } = parseComponents(
      ability([
        {
          text: 'Active: x',
          values: [
            ['Magic Damage', '25% (+ 25% per 100 bonus AD) of expended Grit'],
            ['Minimum Magic Damage', '70 (+ 30% AP)'],
            ['Maximum Magic Damage', '210 (+ 90% AP)'],
            ['Damage', '50 (+ 10% AD)'],
          ],
        },
      ]),
    );
    expect(components.map((c) => c.label)).toEqual(['Minimum Magic Damage']);
    expect(skipped.map((s) => s.reason)).toEqual([
      'unknown scaling "of expended Grit"',
      'maximum of a range (minimum is used)',
      'damage type unknown',
    ]);
  });
});

describe('abilitiesFromWiki', () => {
  const block = (slot: WikiAbility['slot'], name: string, rows: Parameters<typeof ability>[0]): WikiAbility => ({ ...ability(rows), slot, name });

  it('makes Q, W, E and R, grouping each ability\'s damage lines into casts', () => {
    const abilities = abilitiesFromWiki([
      block('innate', 'Passive', []),
      block('q', 'Darkin Blade', [
        { text: 'First Cast: dealing physical damage.', values: [['First Cast Damage', '10 (+ 60% AD)']] },
        { text: 'Second Cast: more.', values: [['Second Cast Damage', '12 (+ 75% AD)']] },
      ]),
      block('w', 'Chains', [
        { text: 'Active: dealing physical damage.', values: [['Physical Damage', '30'], ['Bonus Physical Damage', '10']] },
      ]),
    ]);
    expect(abilities.map((a) => [a.key, a.name, a.casts.map((c) => c.name)])).toEqual([
      ['Q', 'Darkin Blade', ['First Cast', 'Second Cast']],
      ['W', 'Chains', ['Active']],
      ['E', 'E', []],
      ['R', 'R', []],
    ]);
    expect(abilities[1].casts[0].components).toHaveLength(2);
  });

  it('lists only the lines it could not read, not the ones left out on purpose', () => {
    const [q] = abilitiesFromWiki([
      block('q', 'Odd', [
        {
          text: 'Active: dealing magic damage.',
          values: [['Magic Damage', '25% (+ 25% per 100 bonus AD) of expended Grit'], ['Sweetspot Damage', '10'], ['Minion Damage', '5']],
        },
      ]),
    ]);
    expect(q.unread).toEqual(['Magic Damage: unknown scaling "of expended Grit"']);
  });

  it('uses the first form when a slot has several (shapeshifters)', () => {
    const [q] = abilitiesFromWiki([block('q', 'Hammer', []), block('q', 'Cannon', [])]);
    expect(q.name).toBe('Hammer');
  });

  it('gives placeholders that say so when a champion has no wiki data', () => {
    const abilities = abilitiesFromWiki(undefined);
    expect(abilities.map((a) => a.key)).toEqual(['Q', 'W', 'E', 'R']);
    expect(abilities[0].unread).toEqual(['no ability data for this champion']);
  });
});
