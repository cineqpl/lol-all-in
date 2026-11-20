import { lookupChampion, sumItemStats, type GameData } from '../data/load';
import type { Side } from '../model/matchup';
import type { AbilityKey } from '../model/types';
import { summarizeStats } from '../model/summary';
import { validateRanks } from '../model/validation';
import { championIconPath, itemIconPath, spellIconPath } from '../data/images';
import { h } from './dom';

export type Panel = { el: HTMLElement; getSide(): Side };

const KEYS: AbilityKey[] = ['Q', 'W', 'E', 'R'];
const MAX_RANK: Record<AbilityKey, number> = { Q: 5, W: 5, E: 5, R: 3 };
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
  const statCell = (name: string) => h('span', { 'data-stat': name });
  const stats = {
    hp: statCell('hp'),
    resource: statCell('resource'),
    ad: statCell('ad'),
    ap: statCell('ap'),
    armor: statCell('armor'),
    mr: statCell('mr'),
  };
  const summary = h(
    'div',
    { class: 'stat-summary', 'data-role': 'stat-summary' },
    stats.hp, stats.resource, stats.ad, stats.ap, stats.armor, stats.mr,
  );
  const warning = h('p', { class: 'warning', 'data-role': 'rank-warning', hidden: '' });
  const ranks = Object.fromEntries(
    KEYS.map((k) => [k, numberInput(`rank-${k}`, 0, MAX_RANK[k], k === 'Q' ? 1 : 0)]),
  ) as Record<AbilityKey, HTMLInputElement>;

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
  const portrait = icon('champion-icon', 'champion-icon');
  const abilityIcons = Object.fromEntries(
    KEYS.map((k) => [k, icon(`ability-icon-${k}`, 'ability-icon')]),
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
      h('label', {}, 'Level ', level),
      h('label', { class: 'quest' }, quest, ' Top lane role quest (level cap 20)'),
    ),
    h('div', { class: 'ranks' }, ...KEYS.map((k) => h('label', {}, `${k} `, abilityIcons[k], ranks[k]))),
    warning,
    h(
      'div',
      { class: 'items' },
      ...items.map((sel, i) => h('span', { class: 'item-slot' }, itemIcons[i], sel)),
    ),
    h('label', {}, 'Rune ', runes),
    summary,
    h('p', { class: 'note' }, 'Rune and item effects beyond flat stats are not modelled yet.'),
  );
  const maxLevel = () => (quest.checked ? QUEST_MAX_LEVEL : BASE_MAX_LEVEL);
  const currentLevel = () => Math.min(maxLevel(), Math.max(1, Number(level.value) || 1));
  const currentRanks = () =>
    Object.fromEntries(KEYS.map((k) => [k, Number(ranks[k].value) || 0])) as Record<AbilityKey, number>;
  const refreshLevelAndWarnings = () => {
    level.max = String(maxLevel());
    if (Number(level.value) > maxLevel()) level.value = String(maxLevel());
    const problems = validateRanks(currentLevel(), currentRanks());
    warning.textContent = problems.join(' ');
    warning.hidden = problems.length === 0;
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
      unmodelledEffects: [
        ...itemIds.filter((id) => data.items[id].hasEffects).map((id) => `${data.items[id].name} (item)`),
        ...(runes.value ? [`${data.runes[runes.value].name} (rune)`] : []),
      ],
    };
  };
  const refreshStats = () => {
    const s = summarizeStats(buildSide());
    stats.hp.textContent = `HP ${Math.round(s.hp)}`;
    stats.ad.textContent = `AD ${Math.round(s.ad)}`;
    stats.ap.textContent = `AP ${Math.round(s.ap)}`;
    stats.armor.textContent = `Armor ${Math.round(s.armor)}`;
    stats.mr.textContent = `MR ${Math.round(s.mr)}`;
    stats.resource.hidden = !s.resource;
    stats.resource.textContent = s.resource ? `${s.resource.label} ${Math.round(s.resource.value)}` : '';
  };
  const refreshIcons = () => {
    setIcon(portrait, champion.value ? championIconPath(champion.value) : '');
    items.forEach((sel, i) => setIcon(itemIcons[i], sel.value ? itemIconPath(sel.value) : ''));
    const files = data.champions[champion.value]?.abilityIcons;
    KEYS.forEach((k, i) => setIcon(abilityIcons[k], files?.[i] ? spellIconPath(files[i]) : ''));
  };
  section.addEventListener('change', () => {
    refreshLevelAndWarnings();
    refreshStats();
    refreshIcons();
    onChange();
  });
  refreshLevelAndWarnings();
  refreshStats();
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
  };
}
