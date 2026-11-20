// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import type { GameData } from '../src/data/load';
import { bootstrap, mount } from '../src/ui/main';

const zero = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0 };
const champ = (id: string, hp: number) => ({
  id, name: id, base: { ...zero, hp }, growth: zero,
});
const trueQ = (dmg: number) => ({
  key: 'Q' as const, name: 'Zap', damageType: 'true' as const, baseByRank: [dmg, dmg, dmg, dmg, dmg],
  scalings: [], status: 'modelled' as const,
});
const oddW = {
  key: 'W' as const, name: 'Weird', damageType: 'magic' as const, baseByRank: [], scalings: [],
  status: 'not-modelled' as const, reason: 'recast',
};

const data: GameData = {
  meta: { patch: '16.1.1', abilitiesPatch: '15.1' },
  champions: {
    Alpha: champ('Alpha', 1000),
    Beta: champ('Beta', 500),
    Gamma: { id: 'Gamma', name: 'Gamma', base: { ...zero, hp: 1000 }, growth: { ...zero, hp: 100 } },
  },
  abilities: { Alpha: [trueQ(100), oddW], Beta: [trueQ(400)], Gamma: [trueQ(1)] },
  items: {
    '1': { name: 'Sword', stats: { ad: 10 }, hasEffects: false },
    '2': { name: 'Deathcap', stats: { ap: 100 }, hasEffects: true },
    '99': { name: 'Sword', stats: { ad: 12 }, hasEffects: false },
  },
  runes: {},
};

let root: HTMLElement;
const q = (sel: string) => root.querySelector(sel) as HTMLElement;
const field = (side: string, f: string) => q(`.panel[data-side=${side}] [data-field=${f}]`) as HTMLInputElement;
function set(el: HTMLInputElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  mount(root, data);
});

describe('matchup UI', () => {
  test('choosing two champions renders both damage numbers', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Beta');
    expect(q('[data-testid=your-damage]').textContent).toContain('100');
    expect(q('[data-testid=enemy-damage]').textContent).toContain('400');
  });

  test('shows not-modelled abilities with their reason', () => {
    set(field('you', 'champion'), 'Alpha');
    expect(q('[data-testid=not-modelled-you]').textContent).toMatch(/Weird.*recast/);
  });

  test('status reflects the matchup and the ability-data patch is shown', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Beta');
    expect(q('[data-testid=status]').dataset.status).toBe('even');
    expect(root.textContent).toContain('15.1');
  });

  test('same champion in both panels does not link the panels', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Alpha');
    set(field('you', 'level'), '12');
    expect(field('enemy', 'level').value).toBe('1');
  });
});

describe('unmodelled item effects', () => {
  test('a chosen item with effects is listed as not modelled', () => {
    set(field('you', 'item-0'), '2');
    expect(q('[data-testid=not-modelled-you]').textContent).toContain('Deathcap');
  });
  test('a flat-stat item is not listed', () => {
    set(field('you', 'item-0'), '1');
    expect(q('[data-testid=not-modelled-you]').textContent).not.toContain('Sword');
  });
});

describe('duplicate item names', () => {
  const labels = () => Array.from(field('you', 'item-0').querySelectorAll('option')).map((o) => o.textContent);
  test('are disambiguated by item id', () => {
    expect(labels()).toContain('Sword (#1)');
    expect(labels()).toContain('Sword (#99)');
  });
  test('unique names are left alone', () => {
    expect(labels()).toContain('Deathcap');
  });
});

describe('icons', () => {
  const icon = (side: string, role: string) => q(`.side[data-side=${side}] img[data-role=${role}]`) as HTMLImageElement;
  test('champion portrait sits above the panel and follows the selection', () => {
    set(field('you', 'champion'), 'Beta');
    expect(icon('you', 'champion-icon').getAttribute('src')).toBe('/img/champion/Beta.png');
    const side = q('.side[data-side=you]');
    expect(side.firstElementChild).toBe(icon('you', 'champion-icon').parentElement);
  });
  test('each panel has its own portrait', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Beta');
    expect(icon('you', 'champion-icon').getAttribute('src')).toBe('/img/champion/Alpha.png');
    expect(icon('enemy', 'champion-icon').getAttribute('src')).toBe('/img/champion/Beta.png');
  });
  test('item icon shows the chosen item and hides when the slot is emptied', () => {
    set(field('you', 'item-0'), '2');
    expect(icon('you', 'item-icon-0').getAttribute('src')).toBe('/img/item/2.png');
    expect(icon('you', 'item-icon-0').hidden).toBe(false);
    set(field('you', 'item-0'), '');
    expect(icon('you', 'item-icon-0').hidden).toBe(true);
  });
});

describe('level and rank validation', () => {
  const warning = (side: string) => q(`.side[data-side=${side}] [data-role=rank-warning]`);
  const quest = (side: string) => field(side, 'role-quest');
  const tick = (side: string, on: boolean) => {
    quest(side).checked = on;
    quest(side).dispatchEvent(new Event('change', { bubbles: true }));
  };

  test('level input caps at 18 and the top lane quest raises it to 20', () => {
    expect(field('you', 'level').max).toBe('18');
    tick('you', true);
    expect(field('you', 'level').max).toBe('20');
  });
  test('unticking the quest while above 18 brings the level back to 18', () => {
    tick('you', true);
    set(field('you', 'level'), '20');
    tick('you', false);
    expect(field('you', 'level').value).toBe('18');
  });
  test('the quest checkbox is per panel', () => {
    tick('you', true);
    expect(field('enemy', 'level').max).toBe('18');
  });
  test('level 20 reaches the damage calculation with level-20 stats', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Gamma');
    expect(q('[data-testid=your-damage]').textContent).toContain('10%'); // 100 / 1000 hp
    tick('enemy', true);
    set(field('enemy', 'level'), '20');
    expect(q('[data-testid=your-damage]').textContent).toContain('3%'); // 100 / 2966.5 hp
  });
  test('a rank above half the level shows a red warning', () => {
    set(field('you', 'rank-Q'), '3');
    expect(warning('you').hidden).toBe(false);
    expect(warning('you').textContent).toMatch(/Q/);
    expect(warning('enemy').hidden).toBe(true);
  });
  test('R rank 1 below level 6 warns and clears at level 6', () => {
    set(field('you', 'rank-R'), '1');
    expect(warning('you').textContent).toMatch(/R.*6/);
    set(field('you', 'level'), '6');
    expect(warning('you').hidden).toBe(true);
  });
});

describe('bootstrap errors', () => {
  test('a load failure shows the message with the missing id instead of a blank page', async () => {
    const el = document.createElement('div');
    await bootstrap(el, () => Promise.reject(new Error('Unknown champion id: Zzz')));
    expect(el.querySelector('[data-testid=error]')!.textContent).toContain('Zzz');
  });
});
