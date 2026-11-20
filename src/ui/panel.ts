import { lookupChampion, sumItemStats, type GameData } from '../data/load';
import { breakdownOf, type Side } from '../model/matchup';
import { evaluateComponent } from '../model/damage';
import type { AbilityKey } from '../model/types';
import { count } from '../model/combo';
import type { StatPart } from '../model/stats';
import { summarizeStats } from '../model/summary';
import { KEYS, levelingFor, minRank, startingRanks } from '../model/leveling';
import { validateRanks } from '../model/validation';
import { championIconPath, itemIconPath, spellIconPath, statIconPath, type StatIconKey } from '../data/images';
import { h } from './dom';
import { renderDamageLine } from './damage-view';

export type Panel = {
  el: HTMLElement;
  getSide(): Side;
  /** Where the damage numbers get their target (for target-health scalings); defaults to a mirror match. */
  setOpponent(getOpponent: () => Side): void;
  /** Recomputes the damage shown next to each hit counter. */
  refreshCombo(): void;
};

const ITEM_SLOTS = 6;
const BASE_MAX_LEVEL = 18;
const QUEST_MAX_LEVEL = 20;

function select(field: string, options: [string, string][], blank?: string): HTMLSelectElement {
  const sel = h('select', { 'data-field': field }) as HTMLSelectElement;
  if (blank !== undefined) sel.append(h('option', { value: '' }, blank));
  for (const [value, label] of options) sel.append(h('option', { value }, label));
  return sel;
}

function icon(role: string, cls: string): HTMLImageElement {
  const img = h('img', { 'data-role': role, class: cls, alt: '' }) as HTMLImageElement;
  img.addEventListener('error', () => {
    img.hidden = true;
  });
  return img;
}

function setIcon(img: HTMLImageElement, src: string): void {
  if (src) {
    img.setAttribute('src', src);
    img.hidden = false;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
  }
}

function numberInput(field: string, min: number, max: number, value: number): HTMLInputElement {
  return h('input', {
    type: 'number',
    'data-field': field,
    min: String(min),
    max: String(max),
    value: String(value),
  }) as HTMLInputElement;
}

/** Rounds to the given decimals and drops trailing zeros. */
const num = (n: number, decimals = 0) => String(Number((Number.isFinite(n) ? n : 0).toFixed(decimals)));
const describe = (label: string, p: StatPart) =>
  `${label} ${num(p.total)} (${num(p.base)} base + ${num(p.bonus)} bonus)`;

export function createPanel(
  data: GameData,
  side: 'you' | 'enemy',
  title: string,
  onChange: () => void,
): Panel {
  const champions = Object.values(data.champions).sort((a, b) => a.name.localeCompare(b.name));
  const champion = select('champion', champions.map((c): [string, string] => [c.id, c.name]));
  const level = numberInput('level', 1, BASE_MAX_LEVEL, 1);
  const quest = h('input', { type: 'checkbox', 'data-field': 'role-quest' }) as HTMLInputElement;
  // Handlers run later, so they may use maxLevel/currentLevel defined further down.
  const levelButton = (which: 'plus' | 'minus', text: string, delta: number) => {
    const b = h('button', { type: 'button', class: 'rank-button', 'data-role': `level-${which}`, 'aria-label': `${which === 'plus' ? 'Raise' : 'Lower'} level` }, text) as HTMLButtonElement;
    b.addEventListener('click', () => {
      level.value = String(Math.min(maxLevel(), Math.max(1, currentLevel() + delta)));
      level.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return b;
  };
  const levelMinus = levelButton('minus', '−', -1);
  const levelPlus = levelButton('plus', '+', 1);
  // stats.* are the text spans; cells.* are the outer [data-stat] elements (icon + text).
  const cells = {} as Record<string, HTMLElement>;
  let resourceIcon: HTMLImageElement;
  const statCell = (name: StatIconKey | 'resource') => {
    const text = h('span');
    const lead: HTMLElement[] = [];
      const img = icon(`stat-icon-${name}`, 'stat-icon');
    if (name !== 'resource') setIcon(img, statIconPath(name));
    else resourceIcon = img; // set on each refresh, together with the text
    lead.push(img);
    cells[name] = h('span', { 'data-stat': name }, ...lead, text);
    return text;
  };
  const stats = {
    hp: statCell('hp'),
    resource: statCell('resource'),
    ad: statCell('ad'),
    attackSpeed: statCell('attackSpeed'),
    ap: statCell('ap'),
    armor: statCell('armor'),
    mr: statCell('mr'),
  };
  const autosInput = numberInput('autos', 0, 99, 2);
  const igniteBox = h('input', { type: 'checkbox', 'data-field': 'ignite' }) as HTMLInputElement;
  const autosIcon = icon('autos-icon', 'ability-icon');
  setIcon(autosIcon, itemIconPath('1036')); // Long Sword
  const igniteIcon = icon('ignite-icon', 'ability-icon');
  setIcon(igniteIcon, spellIconPath('SummonerDot.png'));
  // One row per cast of each ability, rebuilt when the champion changes.
  type CastRow = { input?: HTMLInputElement; damage: HTMLElement };
  const comboRows = h('div', { class: 'combo-rows' });
  const castRows: Record<AbilityKey, CastRow[]> = { Q: [], W: [], E: [], R: [] };
  let rowsFor: string | undefined;
  let getOpponent: () => Side = () => buildSide();
  const comboBox = h(
    'div',
    { class: 'combo', 'data-role': 'combo' },
    h('h3', {}, side === 'you' ? 'Your combo' : 'Enemy combo'),
    h('p', { class: 'note' }, 'How many times each ability hits, and how many auto-attacks land.'),
    comboRows,
    // Same column layout as the ability rows: icon, name, spacer, control.
    h(
      'label',
      { class: 'combo-row autos' },
      autosIcon,
      h('span', { class: 'combo-name' }, 'Auto-attacks'),
      h('span', { class: 'combo-unit' }),
      autosInput,
    ),
    h(
      'label',
      { class: 'combo-row ignite' },
      igniteIcon,
      h('span', { class: 'combo-name' }, 'Ignite'),
      h('span', { class: 'combo-unit' }),
      igniteBox,
    ),
  );
  const adNote = h('p', { class: 'warning', 'data-role': 'ad-growth-note', hidden: '' }, 'AD growth data is unavailable for this champion, so its AD is understated at higher levels.');
  const summary = h(
    'div',
    { class: 'stat-summary', 'data-role': 'stat-summary' },
    cells.hp, cells.resource, cells.ad, cells.ap, cells.armor, cells.mr, cells.attackSpeed,
    adNote,
  );
  const warning = h('p', { class: 'warning', 'data-role': 'rank-warning', hidden: '' });
  // The rank lives in a hidden input; the +/- buttons change it and the squares show it.
  const ranks = Object.fromEntries(
    KEYS.map((k) => [k, h('input', { type: 'hidden', 'data-field': `rank-${k}`, value: k === 'Q' ? '1' : '0' })]),
  ) as Record<AbilityKey, HTMLInputElement>;
  const rankButtons = {} as Record<AbilityKey, { plus: HTMLButtonElement; minus: HTMLButtonElement }>;
  const rankPips = Object.fromEntries(
    KEYS.map((k) => [k, h('span', { class: 'rank-pips', 'data-role': `rank-pips-${k}` })]),
  ) as Record<AbilityKey, HTMLElement>;
  const stepRank = (k: AbilityKey, delta: number) => {
    const next = Math.min(rules().maxRank[k], Math.max(minRank(rules(), k), (Number(ranks[k].value) || 0) + delta));
    ranks[k].value = String(next);
    ranks[k].dispatchEvent(new Event('change', { bubbles: true }));
  };
  for (const k of KEYS) {
    const button = (which: 'plus' | 'minus', text: string, delta: number) => {
      const b = h('button', { type: 'button', class: 'rank-button', 'data-role': `rank-${which}-${k}`, 'aria-label': `${which === 'plus' ? 'Raise' : 'Lower'} ${k}` }, text) as HTMLButtonElement;
      b.addEventListener('click', () => stepRank(k, delta));
      return b;
    };
    rankButtons[k] = { plus: button('plus', '+', 1), minus: button('minus', '−', -1) };
  }
  const rules = () => levelingFor(champion.value);
  let rankedFor = champion.value;
  /** A new champion means different abilities and rules: start from that champion's usual ranks. */
  const resetRanksForChampion = () => {
    if (champion.value === rankedFor) return;
    rankedFor = champion.value;
    const start = startingRanks(rules());
    for (const k of KEYS) ranks[k].value = String(start[k]);
  };
  const refreshRanks = () => {
    for (const k of KEYS) {
      const rank = Number(ranks[k].value) || 0;
      rankPips[k].replaceChildren(
        ...Array.from({ length: rules().maxRank[k] }, (_, i) => h('span', { class: i < rank ? 'pip on' : 'pip' })),
      );
      rankButtons[k].plus.disabled = rank >= rules().maxRank[k];
      rankButtons[k].minus.disabled = rank <= minRank(rules(), k);
    }
  };

  const selectable = Object.entries(data.items).filter(([, item]) => Object.keys(item.stats).length > 0);
  const nameCount = new Map<string, number>();
  for (const [, item] of selectable) nameCount.set(item.name, (nameCount.get(item.name) ?? 0) + 1);
  // Variants of the same item can have different stats, so duplicated names show their id.
  const itemOptions = selectable
    .sort((a, b) => a[1].name.localeCompare(b[1].name))
    .map(([id, item]): [string, string] => [
      id,
      (nameCount.get(item.name) ?? 0) > 1 ? `${item.name} (#${id})` : item.name,
    ]);
  const items = Array.from({ length: ITEM_SLOTS }, (_, i) =>
    select(`item-${i}`, itemOptions, '(no item)'),
  );
  const itemIcons = items.map((_, i) => icon(`item-icon-${i}`, 'item-icon'));
  // The box keeps its size (a light gray square) when the slot is empty, so the rows do not collapse.
  const itemBoxes = itemIcons.map((img, i) => h('span', { class: 'item-icon-box empty', 'data-role': `item-box-${i}` }, img));
  const portrait = icon('champion-icon', 'champion-icon');
  const abilityIcons = Object.fromEntries(
    KEYS.map((k) => [k, icon(`ability-icon-${k}`, 'rank-icon')]),
  ) as Record<AbilityKey, HTMLImageElement>;

  const runeOptions = Object.entries(data.runes).map(
    ([id, r]): [string, string] => [id, `${r.name} (${r.tree})`],
  );
  const runes = select('runes', runeOptions, '(no rune)');

  const section = h(
    'section',
    { class: 'panel', 'data-side': side },
    h('h2', {}, title),
    h('label', {}, 'Champion ', champion),
    h(
      'div',
      { class: 'level-row' },
      h('span', { class: 'level-control' }, h('label', {}, 'Level ', level), h('span', { class: 'level-buttons' }, levelMinus, levelPlus)),
      h('label', { class: 'quest' }, quest, ' Top lane role quest (level cap 20)'),
    ),
    h(
      'div',
      { class: 'ranks' },
      ...KEYS.map((k) =>
        h(
          'div',
          { class: 'rank-control' },
          `${k} `,
          abilityIcons[k],
          rankPips[k],
          h('span', { class: 'rank-buttons', 'data-role': `rank-buttons-${k}` }, rankButtons[k].plus, rankButtons[k].minus),
          ranks[k],
        ),
      ),
    ),
    warning,
    h(
      'div',
      { class: 'items' },
      ...items.map((sel, i) => h('span', { class: 'item-slot' }, itemBoxes[i], sel)),
    ),
    h('label', {}, 'Rune ', runes),
    summary,
    comboBox,
    h('p', { class: 'note' }, 'Rune and item effects beyond flat stats are not modelled yet.'),
  );
  const maxLevel = () => (quest.checked ? QUEST_MAX_LEVEL : BASE_MAX_LEVEL);
  const currentLevel = () => Math.min(maxLevel(), Math.max(1, Number(level.value) || 1));
  const currentRanks = () =>
    Object.fromEntries(KEYS.map((k) => [k, Number(ranks[k].value) || 0])) as Record<AbilityKey, number>;
  const refreshLevelAndWarnings = () => {
    level.max = String(maxLevel());
    if (Number(level.value) > maxLevel()) level.value = String(maxLevel());
    const problems = validateRanks(currentLevel(), currentRanks(), rules());
    warning.textContent = problems.join(' ');
    warning.hidden = problems.length === 0;
    levelMinus.disabled = currentLevel() <= 1;
    levelPlus.disabled = currentLevel() >= maxLevel();
  };
  const buildSide = (): Side => {
    const champ = lookupChampion(data, champion.value);
    const itemIds = items.map((s) => s.value).filter(Boolean);
    return {
      champion: champ,
      abilities: data.abilities[champ.id] ?? [],
      build: {
        championId: champ.id,
        level: currentLevel(),
        ranks: currentRanks(),
        itemIds,
        runeIds: runes.value ? [runes.value] : [],
      },
      itemStats: sumItemStats(data, itemIds),
      combo: {
        hits: Object.fromEntries(
          KEYS.map((k) => [k, castRows[k].flatMap((r) => (r.input ? [count(Number(r.input.value))] : []))]),
        ) as Record<AbilityKey, number[]>,
        autos: count(Number(autosInput.value)),
        ignite: igniteBox.checked,
      },
      unmodelledEffects: [
        ...itemIds.filter((id) => data.items[id].hasEffects).map((id) => `${data.items[id].name} (item)`),
        ...(runes.value ? [`${data.runes[runes.value].name} (rune)`] : []),
      ],
    };
  };
  const refreshStats = () => {
    const s = summarizeStats(buildSide());
    stats.hp.textContent = describe('HP', s.hp);
    stats.ad.textContent = describe('AD', s.ad);
    stats.ap.textContent = describe('AP', s.ap);
    stats.armor.textContent = describe('Armor', s.armor);
    stats.mr.textContent = describe('MR', s.mr);
    // Attack speed bonus is shown as a percentage of base attack speed.
    const as = s.attackSpeed;
    const bonusPct = as.base > 0 ? (as.bonus / as.base) * 100 : 0;
    stats.attackSpeed.textContent = `Attack speed ${num(as.total, 3)} (${num(as.base, 3)} base + ${num(bonusPct)}% bonus)`;
    adNote.hidden = !data.champions[champion.value]?.adGrowthUnknown;
    // The line is always there: Mana, Energy, or a note that the champion has no secondary resource.
    cells.resource.setAttribute('data-resource', s.resource?.label ?? 'None');
    setIcon(resourceIcon, statIconPath('mana'));
    stats.resource.textContent = s.resource ? describe(s.resource.label, s.resource) : 'No secondary resource';
  };
  const rebuildRows = () => {
    const abilities = data.abilities[champion.value] ?? [];
    const files = data.champions[champion.value]?.abilityIcons;
    comboRows.replaceChildren();
    KEYS.forEach((k, ki) => {
      castRows[k] = [];
      const ability = abilities.find((a) => a.key === k);
      if (!ability) return;
      const casts = ability.casts.length > 0 ? ability.casts : [undefined];
      casts.forEach((cast, i) => {
        const img = icon(`combo-icon-${k}-${i}`, 'ability-icon');
        if (i === 0) setIcon(img, files?.[ki] ? spellIconPath(files[ki]) : '');
        else img.style.visibility = 'hidden';
        const title = casts.length > 1 ? `${k} ${ability.name}: ${cast?.name}` : `${k} ${ability.name}`;
        const note =
          i > 0 ? '' : ability.unread.length > 0 ? ' not counted' : !cast ? ' no damage' : '';
        const damage = h('span', { class: 'combo-damage' });
        const input = cast ? numberInput(`hits-${k}-${i}`, 0, 99, 1) : undefined;
        comboRows.append(
          h(
            'div',
            { class: 'combo-row', 'data-role': `combo-row-${k}-${i}` },
            img,
            h('span', { class: 'combo-name' }, title),
            h('span', { class: 'combo-unit' }, input ? 'hits' : ''),
            ...(input ? [input] : []),
            damage,
            ...(note ? [h('span', { class: 'note', title: ability.unread.join('; ') }, note)] : []),
          ),
        );
        if (cast) castRows[k].push({ input, damage });
      });
    });
    rowsFor = champion.value;
  };
  const refreshCombo = () => {
    if (rowsFor !== champion.value) rebuildRows();
    const abilities = data.abilities[champion.value] ?? [];
    const mine = breakdownOf(buildSide());
    const theirs = breakdownOf(getOpponent());
    for (const k of KEYS) {
      const ability = abilities.find((a) => a.key === k);
      const rank = Number(ranks[k].value) || 0;
      castRows[k].forEach((row, i) => {
        if (row.input) row.input.disabled = rank < 1;
        row.damage.replaceChildren(
          ...(rank < 1
            ? []
            : (ability?.casts[i]?.components ?? []).map((c) => renderDamageLine(evaluateComponent(c, rank, mine, theirs)))),
        );
      });
    }
  };
  const refreshIcons = () => {
    setIcon(portrait, champion.value ? championIconPath(champion.value) : '');
    items.forEach((sel, i) => {
      setIcon(itemIcons[i], sel.value ? itemIconPath(sel.value) : '');
      itemBoxes[i].classList.toggle('empty', !sel.value);
    });
    const files = data.champions[champion.value]?.abilityIcons;
    KEYS.forEach((k, i) => setIcon(abilityIcons[k], files?.[i] ? spellIconPath(files[i]) : ''));
  };
  section.addEventListener('change', () => {
    resetRanksForChampion();
    refreshLevelAndWarnings();
    refreshRanks();
    refreshStats();
    refreshCombo();
    refreshIcons();
    onChange();
  });
  refreshLevelAndWarnings();
  refreshRanks();
  refreshStats();
  refreshCombo();
  refreshIcons();
  const el = h(
    'div',
    { class: 'side', 'data-side': side },
    h('div', { class: 'portrait' }, portrait),
    section,
  );

  return {
    el,
    getSide: buildSide,
    setOpponent: (fn) => { getOpponent = fn; },
    refreshCombo,
  };
}
