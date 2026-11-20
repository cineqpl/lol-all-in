/**
 * Turns one wiki ability into damage components: one per damage line, grouped by cast.
 * Lines it cannot read safely are returned in `skipped` with a reason, never guessed.
 * Used by scripts only; the app reads the generated JSON. Wiki text is CC BY-SA 3.0 (see WIKI_SOURCE).
 */
import type { Ability, AbilityKey, Cast, ComponentScaling, ComponentStat, DamageComponent, DamageType } from '../model/types';
import type { WikiAbility } from './wiki';

export type { ComponentScaling, ComponentStat, DamageComponent };

export type SkippedLine = { label: string; value: string; reason: string };
export type ParsedAbility = { components: DamageComponent[]; skipped: SkippedLine[] };

const NUM = String.raw`-?\d+(?:\.\d+)?`;
const SERIES = new RegExp(String.raw`^\s*(${NUM}%?(?:\s*/\s*${NUM}%?)*)\s*(.*?)\s*$`);
const numbers = (s: string) => [...s.matchAll(new RegExp(NUM, 'g'))].map((m) => parseFloat(m[0]));

const OWNER = String.raw`(?:of )?(?:his |her |their |your |its |the champion's )?`;
const TARGET = String.raw`(?:of )?(?:the )?(?:target'?s?|enemy'?s?) `;
const STATS: [RegExp, ComponentStat][] = [
  [new RegExp(`^${TARGET}maximum health$`), 'targetMaxHp'],
  [new RegExp(`^${TARGET}missing health$`), 'targetMissingHp'],
  [new RegExp(`^${TARGET}current health$`), 'targetCurrentHp'],
  [new RegExp(`^${OWNER}bonus health$`), 'bonusHp'],
  [new RegExp(`^${OWNER}maximum health$`), 'maxHp'],
  [new RegExp(`^${OWNER}bonus armor$`), 'bonusArmor'],
  [new RegExp(`^${OWNER}armor$`), 'armor'],
  [new RegExp(`^${OWNER}bonus magic resistance$`), 'bonusMr'],
  [new RegExp(`^${OWNER}magic resistance$`), 'mr'],
  [new RegExp(`^${OWNER}maximum mana$`), 'maxMana'],
  [new RegExp(`^${OWNER}bonus (?:ad|attack damage)$`), 'bonusAd'],
  [new RegExp(`^${OWNER}(?:ad|attack damage)$`), 'ad'],
  [new RegExp(`^${OWNER}ap$`), 'ap'],
];

type Parsed = { base: number[]; scalings: ComponentScaling[] } | { error: string };

/** "(+ 60 / 67.5% AD)", "(+ 2% per 100 AP)", "(+ 8% of his bonus health)" */
function parseScaling(text: string): ComponentScaling | { error: string } {
  const m = SERIES.exec(text.replace(/^\+\s*/, ''));
  if (!m || !m[1].includes('%')) return { error: `unknown scaling "${text}"` };
  let rest = m[2];
  let per = 1;
  const pm = /^per (\d+)\s+(.*)$/.exec(rest);
  if (pm) { per = parseFloat(pm[1]); rest = pm[2]; }
  const stat = STATS.find(([re]) => re.test(rest.toLowerCase()));
  if (!stat) return { error: `unknown scaling "${rest}"` };
  return { stat: stat[1], ratio: numbers(m[1]).map((n) => n / 100 / per) };
}

function parseValue(value: string): Parsed {
  const parens = [...value.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]);
  const head = value.replace(/\([^()]*\)/g, ' ').trim();
  const m = SERIES.exec(head);
  if (!m) return { error: 'no leading number' };
  const scalings: ComponentScaling[] = [];
  let base: number[];
  if (m[1].includes('%')) {
    // "40 / 45 / 50% AD": a percentage of a stat, no flat part.
    const s = parseScaling(head);
    if ('error' in s) return s;
    base = [0];
    scalings.push(s);
  } else if (m[2]) {
    return { error: `unknown scaling "${m[2]}"` };
  } else {
    base = numbers(m[1]);
  }
  for (const p of parens) {
    if (!/^\s*\+/.test(p)) return { error: `unknown scaling "${p.trim()}"` };
    const s = parseScaling(p.trim());
    if ('error' in s) return s;
    scalings.push(s);
  }
  return { base, scalings };
}

const TYPE_WORD = /\b(physical|magic|true) damage/gi;
const typeIn = (text: string): DamageType | undefined => {
  const found = new Set([...text.matchAll(TYPE_WORD)].map((m) => m[1].toLowerCase()));
  return found.size === 1 ? ([...found][0] as DamageType) : undefined;
};

const NOT_DAMAGE = /damage (reduction|amplification|increase|modifier)|bonus attack damage|^attack damage/i;

/** Why a damage line is left out of a duel, or undefined if it belongs. */
function skipReason(label: string, siblings: string[]): string | undefined {
  const l = label.toLowerCase();
  const isMin = /^minimum\b/.test(l);
  const isMax = /^maximum\b/.test(l);
  if (isMin || isMax) {
    const other = isMin ? /^maximum\b/ : /^minimum\b/;
    const isRange = siblings.some((s) => other.test(s.toLowerCase()));
    // The minimum of a range is what a duel is assumed to deal (e.g. before any execute bonus).
    if (isRange) return isMin ? undefined : 'maximum of a range (minimum is used)';
    return 'sum of other lines';
  }
  if (/^(total|combined)\b/.test(l)) return 'sum of other lines';
  if (/sweetspot/.test(l)) return 'sweetspot';
  if (/^reduced damage|\(handle\)/.test(l)) return 'secondary target';
  if (/minion|monster|non-champion|structure|turret/.test(l)) return 'not against champions';
  return undefined;
}

export function parseComponents(ability: WikiAbility): ParsedAbility {
  const abilityType = typeIn(ability.rows.map((r) => r.text).join(' '));
  const components: DamageComponent[] = [];
  const skipped: SkippedLine[] = [];
  for (const row of ability.rows) {
    const cast = /^([^:]{1,45}):/.exec(row.text)?.[1].trim() ?? 'Active';
    const labels = row.values.map((v) => v.label);
    for (const v of row.values) {
      if (!/damage/i.test(v.label) || NOT_DAMAGE.test(v.label)) continue;
      const skip = (reason: string) => skipped.push({ label: v.label, value: v.value, reason });
      const why = skipReason(v.label, labels);
      if (why) { skip(why); continue; }
      const parsed = parseValue(v.value);
      if ('error' in parsed) { skip(parsed.error); continue; }
      const type = typeIn(v.label) ?? abilityType;
      if (!type) { skip('damage type unknown'); continue; }
      components.push({ label: v.label, cast, type, ...parsed });
    }
  }
  return { components, skipped };
}

/** Lines left out on purpose (sweetspots, sums, non-champion lines) are not "unread"; only these are. */
const UNREAD = /^(unknown scaling|no leading number|damage type unknown)/;

const KEYS: AbilityKey[] = ['Q', 'W', 'E', 'R'];

/**
 * Q/W/E/R for one champion from its wiki ability blocks. Where a slot has several forms
 * (Jayce, Elise, Nidalee...), the first one is used. Pass undefined for a champion the wiki data lacks.
 */
export function abilitiesFromWiki(blocks: WikiAbility[] | undefined): Ability[] {
  return KEYS.map((key): Ability => {
    const block = blocks?.find((b) => b.slot === key.toLowerCase());
    if (!block) {
      const unread = blocks ? [] : ['no ability data for this champion'];
      return { key, name: key, casts: [], unread };
    }
    const { components, skipped } = parseComponents(block);
    const casts: Cast[] = [];
    for (const c of components) {
      let cast = casts.find((x) => x.name === c.cast);
      if (!cast) casts.push((cast = { name: c.cast, components: [] }));
      cast.components.push(c);
    }
    const unread = skipped.filter((s) => UNREAD.test(s.reason)).map((s) => `${s.label}: ${s.reason}`);
    return { key, name: block.name, casts, unread };
  });
}
