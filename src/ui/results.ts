import type { GameData } from '../data/load';
import type { MatchupResult } from '../model/matchup';
import type { Ability } from '../model/types';
import { h } from './dom';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const dmg = (v: number) => String(Math.round(v));

const STATUS_TEXT: Record<MatchupResult['status'], string> = {
  safe: 'Safe: you can kill them and they cannot kill you',
  even: 'Even: neither combo kills',
  danger: 'Danger: their combo can kill you',
};

function notModelledList(
  testId: string,
  title: string,
  abilities: Ability[],
  effects: string[],
): HTMLElement {
  const items = [
    ...abilities.map((a) => h('li', {}, `${a.key} ${a.name} (${a.damageType}): ${a.reason ?? 'not modelled'}`)),
    ...effects.map((e) => h('li', {}, `${e}: effect not modelled`)),
  ];
  return h('div', { 'data-testid': testId }, h('h3', {}, title), h('ul', {}, ...items));
}

export function renderResults(el: HTMLElement, r: MatchupResult, data: GameData): void {
  el.replaceChildren(
    h(
      'p',
      { 'data-testid': 'status', 'data-status': r.status, class: `status ${r.status}` },
      STATUS_TEXT[r.status],
    ),
    h(
      'p',
      { 'data-testid': 'your-damage' },
      `Your combo: ${dmg(r.yourDamage)} damage (${pct(r.yourPctOfEnemyHp)} of their estimated HP)`,
    ),
    h(
      'p',
      { 'data-testid': 'enemy-damage' },
      `Their combo: ${dmg(r.enemyDamage)} damage (${pct(r.enemyPctOfYourHp)} of your HP)`,
    ),
    notModelledList('not-modelled-you', 'Your abilities and effects not modelled', r.yourNotModelled, r.yourUnmodelledEffects),
    notModelledList('not-modelled-enemy', 'Their abilities and effects not modelled', r.enemyNotModelled, r.enemyUnmodelledEffects),
    h(
      'p',
      { class: 'note', 'data-testid': 'patch' },
      `Stats, items and runes: patch ${data.meta.patch}. Ability damage data: patch ${data.meta.abilitiesPatch ?? 'unknown'} (may be older).`,
    ),
  );
}
