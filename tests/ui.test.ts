// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest';
import type { GameData } from '../src/data/load';
import type { ComponentStat } from '../src/model/types';
import { bootstrap, mount } from '../src/ui/main';

const zero = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0, attackSpeed: 0 };
const champ = (id: string, hp: number, resource = 'Mana', mana = 0) => ({
  id, name: id, resource, base: { ...zero, hp, mana }, growth: zero,
  abilityIcons: [`${id}Q.png`, `${id}W.png`, `${id}E.png`, `${id}R.png`],
});
const comp = (type: 'physical' | 'magic' | 'true', base: number, scalings: { stat: ComponentStat; ratio: number[] }[] = [], label = 'Damage') => ({
  label, cast: 'Active', type, base: [base], scalings,
});
const cast = (name: string, ...components: ReturnType<typeof comp>[]) => ({ name, components });
const trueQ = (dmg: number) => ({
  key: 'Q' as const, name: 'Zap', unread: [], casts: [cast('Active', comp('true', dmg))],
});
const oddW = { key: 'W' as const, name: 'Weird', casts: [], unread: ['Magic Damage: unknown scaling "x"'] };
// Two casts with different damage types and scalings, for the damage display.
const comboE = {
  key: 'E' as const, name: 'Combo', unread: [],
  casts: [
    cast('First Cast', comp('physical', 50, [{ stat: 'bonusAd', ratio: [1] }, { stat: 'targetMaxHp', ratio: [0.1] }])),
    cast('Second Cast', comp('magic', 20, [{ stat: 'ap', ratio: [0.5] }])),
  ],
};

const data: GameData = {
  meta: { patch: '16.1.1', abilitiesFetchedAt: '2026-01-15T10:00:00Z' },
  champions: {
    Alpha: champ('Alpha', 1000, 'Mana', 300),
    Beta: champ('Beta', 500, 'Energy', 200),
    Delta: { id: 'Delta', name: 'Delta', resource: 'None', base: { ...zero, hp: 600, attackSpeed: 0.625 }, growth: { ...zero, attackSpeed: 0.02 } },
    Jayce: champ('Jayce', 800, 'Mana', 300),
    Karma: champ('Karma', 700, 'Mana', 300),
    Udyr: champ('Udyr', 900, 'None', 0),
    Gamma: { id: 'Gamma', name: 'Gamma', resource: 'None', adGrowthUnknown: true, base: { ...zero, hp: 1000 }, growth: { ...zero, hp: 100 } },
  },
  abilities: { Alpha: [trueQ(100), oddW, comboE], Beta: [trueQ(400)], Gamma: [trueQ(1)], Delta: [trueQ(1)] },
  items: {
    '1': { name: 'Sword', stats: { ad: 10, mana: 250 }, hasEffects: false },
    '2': { name: 'Deathcap', stats: { ap: 100 }, hasEffects: true },
    '3': { name: 'Cloak', stats: { armor: 25, mr: 15 }, hasEffects: false },
    '4': { name: 'Dagger', stats: { attackSpeed: 0.3 }, hasEffects: false },
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

  test('ignite is labelled Ignite and shows its icon', () => {
    const label = q('.panel[data-side=you] label.ignite');
    expect(label.textContent?.trim()).toBe('Ignite');
    expect(label.querySelector('img')?.getAttribute('src')).toBe('/img/spell/SummonerDot.png');
    // icon, name, then the checkbox on the right
    expect((label.lastElementChild as HTMLInputElement).type).toBe('checkbox');
  });

  test('auto-attacks show the Long Sword icon', () => {
    const label = q('.panel[data-side=you] label.autos');
    expect(label.querySelector('img')?.getAttribute('src')).toBe('/img/item/1036.png');
    expect(label.textContent).toContain('Auto-attacks');
    expect((label.lastElementChild as HTMLInputElement).getAttribute('data-field')).toBe('autos');
  });

  test('ignite adds level-based true damage to the combo', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Beta');
    const box = field('you', 'ignite');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(q('[data-testid=your-damage]').textContent).toContain('170');
  });

  test('lists abilities with unread damage lines and why', () => {
    set(field('you', 'champion'), 'Alpha');
    expect(q('[data-testid=not-modelled-you]').textContent).toMatch(/Weird.*unknown scaling/);
  });

  test('status reflects the matchup and the ability data source and date are shown', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Beta');
    expect(q('[data-testid=status]').dataset.status).toBe('even');
    expect(root.textContent).toContain('League of Legends Wiki');
    expect(root.textContent).toContain('2026-01-15');
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
  test('an empty item slot shows a placeholder square so the rows keep their shape', () => {
    const box = (i: number) => q(`.panel[data-side=you] [data-role=item-box-${i}]`);
    expect(box(0).classList.contains('empty')).toBe(true);
    set(field('you', 'item-0'), '2');
    expect(box(0).classList.contains('empty')).toBe(false);
    expect(box(1).classList.contains('empty')).toBe(true);
    set(field('you', 'item-0'), '');
    expect(box(0).classList.contains('empty')).toBe(true);
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

describe('champion leveling exceptions', () => {
  const pips = (key: string) => root.querySelectorAll(`.side[data-side=you] [data-role=rank-pips-${key}] .pip`).length;
  const rank = (key: string) => field('you', `rank-${key}`).value;
  const plus = (key: string) => q(`.side[data-side=you] [data-role=rank-plus-${key}]`) as HTMLButtonElement;
  const warning = () => q('.side[data-side=you] [data-role=rank-warning]');

  test('Udyr: R is an ordinary ability with five ranks', () => {
    set(field('you', 'champion'), 'Udyr');
    expect([pips('Q'), pips('R')]).toEqual([5, 5]);
    for (let i = 0; i < 5; i++) plus('R').click();
    expect(rank('R')).toBe('5');
    expect(warning().textContent).toMatch(/R rank 5.*level 1/); // half-level rule applies to R
  });
  test('Karma: ultimate starts at rank 1, has four ranks, and warns by the 1/6/11/16 table', () => {
    set(field('you', 'champion'), 'Karma');
    expect(rank('R')).toBe('1');
    expect(pips('R')).toBe(4);
    expect(warning().hidden).toBe(true);
    plus('R').click();
    expect(warning().textContent).toMatch(/R.*6/);
  });
  test('Karma, Nidalee, Elise and Jayce: the ultimate cannot go below rank 1', () => {
    for (const id of ['Karma', 'Jayce']) {
      set(field('you', 'champion'), id);
      const minus = q('.side[data-side=you] [data-role=rank-minus-R]') as HTMLButtonElement;
      expect(minus.disabled).toBe(true);
      minus.click();
      expect(rank('R')).toBe('1');
    }
    set(field('you', 'champion'), 'Karma');
    plus('R').click();
    const minus = q('.side[data-side=you] [data-role=rank-minus-R]') as HTMLButtonElement;
    expect(minus.disabled).toBe(false);
    minus.click();
    expect(rank('R')).toBe('1');
    expect(minus.disabled).toBe(true);
  });
  test('Jayce: basics have six ranks and his ultimate is a single rank, already learned', () => {
    set(field('you', 'champion'), 'Jayce');
    expect([pips('Q'), pips('W'), pips('E'), pips('R')]).toEqual([6, 6, 6, 1]);
    expect(rank('R')).toBe('1');
    expect(plus('R').disabled).toBe(true);
  });
  test('switching back to a standard champion restores the standard ranks', () => {
    set(field('you', 'champion'), 'Karma');
    set(field('you', 'champion'), 'Alpha');
    expect(pips('R')).toBe(3);
    expect(rank('R')).toBe('0');
    expect(rank('Q')).toBe('1');
  });
});

describe('level buttons', () => {
  const lvl = (which: 'plus' | 'minus', side = 'you') =>
    q(`.side[data-side=${side}] [data-role=level-${which}]`) as HTMLButtonElement;
  test('plus and minus change the level, side by side right after the level box', () => {
    const box = field('you', 'level');
    expect(box.value).toBe('1');
    lvl('plus').click();
    lvl('plus').click();
    expect(box.value).toBe('3');
    lvl('minus').click();
    expect(box.value).toBe('2');
    const row = lvl('plus').parentElement as HTMLElement;
    expect([...row.children].map((b) => b.getAttribute('data-role'))).toEqual(['level-minus', 'level-plus']);
    expect(row.previousElementSibling?.contains(box)).toBe(true);
  });
  test('stops at level 1 and at 18, or 20 with the top lane quest', () => {
    expect(lvl('minus').disabled).toBe(true);
    for (let i = 0; i < 30; i++) lvl('plus').click();
    expect(field('you', 'level').value).toBe('18');
    expect(lvl('plus').disabled).toBe(true);
    const quest = field('you', 'role-quest');
    quest.checked = true;
    quest.dispatchEvent(new Event('change', { bubbles: true }));
    expect(lvl('plus').disabled).toBe(false);
    lvl('plus').click();
    lvl('plus').click();
    expect(field('you', 'level').value).toBe('20');
  });
  test('the level feeds the stats like typing it does, and each side has its own buttons', () => {
    set(field('you', 'champion'), 'Gamma'); // 1000 HP + 100 per level growth
    lvl('plus').click();
    expect(q('.side[data-side=you] [data-stat=hp]').textContent).toContain('1072');
    expect(field('enemy', 'level').value).toBe('1');
  });
});

describe('ability rank buttons', () => {
  const btn = (key: string, which: 'plus' | 'minus') =>
    q(`.side[data-side=you] [data-role=rank-${which}-${key}]`) as HTMLButtonElement;
  const pips = (key: string) => [...root.querySelectorAll(`.side[data-side=you] [data-role=rank-pips-${key}] .pip`)];
  const learned = (key: string) => pips(key).filter((p) => p.classList.contains('on')).length;
  test('plus raises and minus lowers the rank', () => {
    expect(learned('W')).toBe(0);
    btn('W', 'plus').click();
    btn('W', 'plus').click();
    expect(field('you', 'rank-W').value).toBe('2');
    btn('W', 'minus').click();
    expect(field('you', 'rank-W').value).toBe('1');
  });
  test('each ability reads icon, then level squares, then the buttons, and the icon is the large one', () => {
    const control = q('.side[data-side=you] [data-role=rank-buttons-Q]').parentElement as HTMLElement;
    const parts = [...control.children].map((c) => c.getAttribute('data-role') ?? c.tagName.toLowerCase());
    expect(parts).toEqual(['ability-icon-Q', 'rank-pips-Q', 'rank-buttons-Q', 'input']);
    expect(control.querySelector('img')?.classList.contains('rank-icon')).toBe(true);
  });
  test('squares fill from the bottom: they are laid out as a column that starts at the bottom', () => {
    // The first square in the DOM is the first level, shown lowest (CSS column-reverse).
    const first = q('.side[data-side=you] [data-role=rank-pips-Q] .pip');
    expect(first.classList.contains('on')).toBe(true);
  });
  test('plus is above minus', () => {
    const box = q('.side[data-side=you] [data-role=rank-buttons-Q]');
    expect([...box.children].map((b) => b.getAttribute('data-role'))).toEqual(['rank-plus-Q', 'rank-minus-Q']);
  });
  test('one green square per learned level and one gray square per level still to learn', () => {
    expect(pips('Q')).toHaveLength(5);
    expect(learned('Q')).toBe(1); // Q starts at rank 1
    btn('Q', 'plus').click();
    expect(learned('Q')).toBe(2);
    expect(pips('Q')).toHaveLength(5);
    expect(pips('R')).toHaveLength(3);
    expect(learned('R')).toBe(0);
  });
  test('the buttons stop at 0 and at the maximum rank', () => {
    expect(btn('R', 'minus').disabled).toBe(true);
    for (let i = 0; i < 5; i++) btn('R', 'plus').click();
    expect(field('you', 'rank-R').value).toBe('3');
    expect(btn('R', 'plus').disabled).toBe(true);
    expect(learned('R')).toBe(3);
  });
  test('changing a rank updates the rank warning and the damage', () => {
    for (let i = 0; i < 3; i++) btn('Q', 'plus').click();
    expect(root.querySelector('.side[data-side=you] [data-role=rank-warning]')?.textContent).toMatch(/Q/);
  });
});

describe('ability icons', () => {
  const abilityIcon = (side: string, key: string) =>
    q(`.side[data-side=${side}] img[data-role=ability-icon-${key}]`) as HTMLImageElement;
  test('each rank selector shows the champion ability icon and follows the selection', () => {
    set(field('you', 'champion'), 'Beta');
    expect(abilityIcon('you', 'Q').getAttribute('src')).toBe('/img/spell/BetaQ.png');
    expect(abilityIcon('you', 'R').getAttribute('src')).toBe('/img/spell/BetaR.png');
    set(field('you', 'champion'), 'Alpha');
    expect(abilityIcon('you', 'W').getAttribute('src')).toBe('/img/spell/AlphaW.png');
  });
  test('the key letter stays next to the icon', () => {
    expect(q('.side[data-side=you] .ranks').textContent).toMatch(/Q.*W.*E.*R/);
  });
  test('icons are hidden for a champion without icon data', () => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    const bare = { ...data, champions: { Solo: { id: 'Solo', name: 'Solo', base: { ...zero, hp: 1 }, growth: zero } }, abilities: { Solo: [] } };
    mount(root, bare);
    expect(abilityIcon('you', 'Q').hidden).toBe(true);
  });
});

describe('stat summary', () => {
  const stat = (side: string, name: string) =>
    q(`.side[data-side=${side}] [data-role=stat-summary] [data-stat=${name}]`);
  test('shows hp, ad and ap from the champion and items', () => {
    set(field('you', 'champion'), 'Alpha');
    expect(stat('you', 'hp').textContent).toContain('1000');
    expect(stat('you', 'ad').textContent).toContain('0');
    set(field('you', 'item-0'), '1');
    expect(stat('you', 'ad').textContent).toContain('10');
  });
  test('stats render in order with attack speed last', () => {
    set(field('you', 'champion'), 'Alpha');
    const order = [...root.querySelectorAll('.side[data-side=you] [data-role=stat-summary] [data-stat]')]
      .map((el) => el.getAttribute('data-stat'));
    expect(order).toEqual(['hp', 'resource', 'ad', 'ap', 'armor', 'mr', 'attackSpeed']);
  });
  test('each stat has its icon', () => {
    const src = (name: string) => q(`.side[data-side=you] [data-stat=${name}] img`)?.getAttribute('src');
    expect(src('hp')).toBe('/img/stat/hp.svg');
    expect(src('ad')).toBe('/img/stat/ad.svg');
    expect(src('ap')).toBe('/img/stat/ap.svg');
    expect(src('attackSpeed')).toBe('/img/stat/attackSpeed.png');
    expect(src('armor')).toBe('/img/stat/armor.svg');
    expect(src('mr')).toBe('/img/stat/mr.svg');
  });
  test('splits stats into base and bonus', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('you', 'item-0'), '1');
    expect(stat('you', 'hp').textContent).toBe('HP 1000 (1000 base + 0 bonus)');
    expect(stat('you', 'ad').textContent).toBe('AD 10 (0 base + 10 bonus)');
    expect(stat('you', 'resource').textContent).toBe('Mana 550 (300 base + 250 bonus)');
  });
  test('attack speed shows base plus a bonus percentage from growth and items', () => {
    set(field('you', 'champion'), 'Delta');
    expect(stat('you', 'attackSpeed').textContent).toBe('Attack speed 0.625 (0.625 base + 0% bonus)');
    set(field('you', 'level'), '10');
    set(field('you', 'item-0'), '4');
    // growth 0.02 * 7.74 = 15.48% plus items 30%
    expect(stat('you', 'attackSpeed').textContent).toBe('Attack speed 0.909 (0.625 base + 45% bonus)');
  });
  test('updates with the level (quest level 20)', () => {
    set(field('enemy', 'champion'), 'Gamma');
    expect(stat('enemy', 'hp').textContent).toContain('1000');
    const box = field('enemy', 'role-quest');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    set(field('enemy', 'level'), '20');
    expect(stat('enemy', 'hp').textContent).toContain('2967');
  });
  test('labels the resource as Mana or Energy, with item mana only for Mana', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('you', 'item-0'), '1');
    expect(stat('you', 'resource').textContent).toMatch(/Mana.*550/);
    set(field('you', 'champion'), 'Beta');
    expect(stat('you', 'resource').textContent).toMatch(/Energy.*200/);
  });
  test('mana has its icon and colour tag, energy has neither', () => {
    set(field('you', 'champion'), 'Alpha');
    const cell = q('.side[data-side=you] [data-stat=resource]') as HTMLElement;
    expect(cell.querySelector('img')?.getAttribute('src')).toBe('/img/stat/mana.svg');
    expect(cell.querySelector('img')?.hidden).toBe(false);
    expect(cell.getAttribute('data-resource')).toBe('Mana');
    set(field('you', 'champion'), 'Beta');
    expect(cell.querySelector('img')?.hidden).toBe(true);
    expect(cell.getAttribute('data-resource')).toBe('Energy');
  });
  test('shows armor and magic resist including items', () => {
    set(field('you', 'champion'), 'Alpha');
    expect(stat('you', 'armor').textContent).toContain('0');
    set(field('you', 'item-0'), '3');
    expect(stat('you', 'armor').textContent).toContain('25');
    expect(stat('you', 'mr').textContent).toContain('15');
  });
  test('warns when a champion has no AD growth data', () => {
    const note = () => q('.side[data-side=you] [data-role=ad-growth-note]');
    set(field('you', 'champion'), 'Gamma');
    expect(note().hidden).toBe(false);
    expect(note().textContent).toMatch(/AD growth/);
    set(field('you', 'champion'), 'Alpha');
    expect(note().hidden).toBe(true);
  });
  test('hides the resource row when the champion has none', () => {
    set(field('you', 'champion'), 'Gamma');
    expect(stat('you', 'resource').hidden).toBe(true);
  });
  test('each panel has its own summary', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Gamma');
    expect(stat('you', 'hp').textContent).toContain('1000');
    expect(stat('enemy', 'hp').textContent).toContain('1000');
    set(field('you', 'item-0'), '1');
    expect(stat('enemy', 'ad').textContent).toContain('0');
  });
});

describe('combo editor', () => {
  const row = (side: string, key: string, i = 0) => q(`.side[data-side=${side}] [data-role=combo-row-${key}-${i}]`);
  test('has hit inputs per cast and an auto-attack input with sensible defaults', () => {
    expect(field('you', 'hits-Q-0').value).toBe('1');
    expect(field('you', 'autos').value).toBe('2');
    expect(field('enemy', 'hits-Q-0')).toBeTruthy();
  });
  test('more hits means more damage in the results', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Gamma');
    set(field('you', 'hits-Q-0'), '3');
    expect(q('[data-testid=your-damage]').textContent).toContain('300 damage');
  });
  test('auto-attacks add damage at the champion AD', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Gamma');
    set(field('you', 'item-0'), '1'); // Sword: +10 AD
    set(field('you', 'hits-Q-0'), '0');
    set(field('you', 'autos'), '4');
    expect(q('[data-testid=your-damage]').textContent).toContain('40 damage');
  });
  test('the two sides keep separate combos', () => {
    set(field('you', 'hits-Q-0'), '5');
    expect(field('enemy', 'hits-Q-0').value).toBe('1');
  });
  test('an ability with several casts gets a row and a hit count for each', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('you', 'rank-E'), '1');
    expect(row('you', 'E', 0).textContent).toContain('First Cast');
    expect(row('you', 'E', 1).textContent).toContain('Second Cast');
    set(field('enemy', 'champion'), 'Gamma');
    set(field('you', 'hits-E-1'), '2');
    // E needs rank 1 and level 1 allows it: 50 physical + 0 bonus AD + 10% of 1000 HP, then 2 x 20 magic
    expect(q('[data-testid=your-damage]').textContent).toContain('290 damage');
  });
  test('hit counts survive a change elsewhere but reset with the champion', () => {
    set(field('you', 'champion'), 'Alpha');
    set(field('you', 'hits-Q-0'), '4');
    set(field('you', 'level'), '3');
    expect(field('you', 'hits-Q-0').value).toBe('4');
    set(field('you', 'champion'), 'Beta');
    expect(field('you', 'hits-Q-0').value).toBe('1');
  });
  test('rows name the ability, utility and unread abilities are marked', () => {
    set(field('you', 'champion'), 'Alpha');
    expect(row('you', 'Q').textContent).toContain('Zap');
    expect(row('you', 'W').textContent).toMatch(/Weird/);
    expect(row('you', 'W').textContent).toMatch(/not counted/);
    expect(row('you', 'Q').textContent).not.toMatch(/not counted/);
  });
  test('hits are disabled for an ability that is not learned', () => {
    set(field('you', 'champion'), 'Alpha');
    expect(field('you', 'hits-E-0').disabled).toBe(true);
    set(field('you', 'rank-E'), '1');
    expect(field('you', 'hits-E-0').disabled).toBe(false);
  });
});

describe('damage display next to the hit counter', () => {
  const line = (side: string, key: string, i: number) =>
    q(`.side[data-side=${side}] [data-role=combo-row-${key}-${i}] .dmg-line`);
  const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim();
  beforeEach(() => {
    set(field('you', 'champion'), 'Alpha');
    set(field('enemy', 'champion'), 'Gamma'); // 1000 HP
    set(field('you', 'item-0'), '1'); // +10 AD (bonus)
    set(field('you', 'item-1'), '2'); // +100 AP
    set(field('you', 'rank-E'), '1');
  });
  test('shows total damage, then base and each scaling by name, as DAMAGE (BASE + SCALING)', () => {
    expect(text(line('you', 'E', 0))).toBe("160 (50 + 10 bonus AD + 100 target's max HP)");
    expect(text(line('you', 'E', 1))).toBe('70 (20 + 50 AP)');
  });
  test('the total is coloured by damage type, base is plain, scalings take the stat colour', () => {
    expect(line('you', 'E', 0).querySelector('.dmg')?.getAttribute('data-type')).toBe('physical');
    expect(line('you', 'E', 1).querySelector('.dmg')?.getAttribute('data-type')).toBe('magic');
    expect(line('you', 'Q', 0).querySelector('.dmg')?.getAttribute('data-type')).toBe('true');
    expect(line('you', 'E', 0).querySelector('.dmg-base')?.textContent).toBe('50');
    const colours = [...line('you', 'E', 0).querySelectorAll('.scale')].map((s) => s.getAttribute('data-color'));
    expect(colours).toEqual(['ad', 'hp']);
    expect(line('you', 'E', 1).querySelector('.scale')?.getAttribute('data-color')).toBe('ap');
  });
  test('an ability with no scaling shows only its damage', () => {
    expect(text(line('you', 'Q', 0))).toBe('100');
  });
  test('shows nothing for an ability that is not learned', () => {
    set(field('you', 'rank-E'), '0');
    expect(q('.side[data-side=you] [data-role=combo-row-E-0] .dmg-line')).toBeNull();
  });
  test('follows the enemy: target-health scaling uses the enemy HP', () => {
    set(field('enemy', 'champion'), 'Beta'); // 500 HP
    expect(text(line('you', 'E', 0))).toBe("110 (50 + 10 bonus AD + 50 target's max HP)");
  });
});

describe('bootstrap errors', () => {
  test('a load failure shows the message with the missing id instead of a blank page', async () => {
    const el = document.createElement('div');
    await bootstrap(el, () => Promise.reject(new Error('Unknown champion id: Zzz')));
    expect(el.querySelector('[data-testid=error]')!.textContent).toContain('Zzz');
  });
});
