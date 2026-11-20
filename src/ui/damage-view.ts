import type { ComponentDamage } from '../model/damage';
import type { ComponentStat } from '../model/types';
import { h } from './dom';

/** How a scaling stat is named next to its number. */
const STAT_LABEL: Record<ComponentStat, string> = {
  ad: 'AD',
  bonusAd: 'bonus AD',
  ap: 'AP',
  maxHp: 'max HP',
  bonusHp: 'bonus HP',
  armor: 'armor',
  bonusArmor: 'bonus armor',
  mr: 'MR',
  bonusMr: 'bonus MR',
  maxMana: 'max mana',
  targetMaxHp: "target's max HP",
  targetCurrentHp: "target's current HP",
  targetMissingHp: "target's missing HP",
};

/** Which stat colour a scaling uses (see the data-color rules in style.css). */
const STAT_COLOR: Record<ComponentStat, string> = {
  ad: 'ad', bonusAd: 'ad', ap: 'ap',
  maxHp: 'hp', bonusHp: 'hp', targetMaxHp: 'hp', targetCurrentHp: 'hp', targetMissingHp: 'hp',
  armor: 'armor', bonusArmor: 'armor', mr: 'mr', bonusMr: 'mr', maxMana: 'mana',
};

const whole = (n: number) => String(Math.round(Number.isFinite(n) ? n : 0));

/**
 * One damage line as "TOTAL (BASE + SCALING + SCALING)". The total is coloured by damage type, the
 * base is plain, and each scaling takes its stat's colour. A line with no scaling shows only the total,
 * and a zero base is left out.
 */
export function renderDamageLine(d: ComponentDamage): HTMLElement {
  const line = h('span', { class: 'dmg-line', title: d.label }, h('span', { class: 'dmg', 'data-type': d.type }, whole(d.raw)));
  if (d.scalings.length === 0) return line;
  const parts: (string | HTMLElement)[] = [' ('];
  if (d.base !== 0) parts.push(h('span', { class: 'dmg-base' }, whole(d.base)), ' + ');
  d.scalings.forEach((s, i) => {
    if (i > 0) parts.push(' + ');
    parts.push(h('span', { class: 'scale', 'data-color': STAT_COLOR[s.stat], 'data-stat': s.stat }, `${whole(s.value)} ${STAT_LABEL[s.stat]}`));
  });
  parts.push(')');
  line.append(...parts);
  return line;
}
