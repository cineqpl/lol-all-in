/**
 * Parses ability descriptions out of a League of Legends Wiki champion page.
 * Content from https://wiki.leagueoflegends.com is licensed CC BY-SA 3.0 (see WIKI_SOURCE).
 * Only used by scripts/fetch-wiki.ts; the app itself never imports this file.
 */
import { JSDOM } from 'jsdom';

export const WIKI_BASE = 'https://wiki.leagueoflegends.com/en-us/';

export const WIKI_SOURCE = {
  name: 'League of Legends Wiki',
  url: 'https://wiki.leagueoflegends.com/',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  note: 'Ability descriptions copied from the wiki pages named in each champion\'s "page" field. Derived data must keep this attribution and license.',
};

export type WikiSlot = 'innate' | 'q' | 'w' | 'e' | 'r';
export type WikiValue = { label: string; value: string };
export type WikiRow = { text: string; values: WikiValue[] };
export type WikiAbility = {
  slot: WikiSlot;
  name: string;
  stats: WikiValue[];
  rows: WikiRow[];
};

export function wikiPageUrl(championName: string): string {
  return WIKI_BASE + encodeURIComponent(championName.replace(/ /g, '_')).replace(/%27/g, "'");
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const noColon = (s: string) => s.replace(/:\s*$/, '').trim();

/** Slot from a class like skill_q; Hwei's families use skill_qqwe, skill_wqwe and skill_eqwe. */
function slotOf(el: Element): WikiSlot | undefined {
  for (const cls of el.classList) {
    const m = /^skill_(innate|[qwer])(?:qwe)?$/.exec(cls);
    if (m) return m[1] as WikiSlot;
  }
  return undefined;
}

export function parseWikiAbilities(html: string): WikiAbility[] {
  const doc = new JSDOM(html).window.document;
  const abilities: WikiAbility[] = [];
  for (const block of doc.querySelectorAll('div.skill')) {
    // Tooltip blurbs repeat the ability text elsewhere on the page.
    if (block.classList.contains('abilitytooltip') || block.classList.contains('blurb')) continue;
    const slot = slotOf(block);
    if (!slot) continue;
    const stats: WikiValue[] = [...block.querySelectorAll('.ability-info-stats__stat')].map((s) => ({
      label: noColon(clean(s.querySelector('.ability-info-stats__stat-label')?.textContent)),
      value: clean(s.querySelector('.ability-info-stats__stat-value')?.textContent),
    }));
    const rows: WikiRow[] = [];
    for (const row of block.querySelectorAll('.ability-info-content > .ability-info-row')) {
      const values: WikiValue[] = [];
      for (const dt of row.querySelectorAll('.ability-info-stats dt')) {
        const dd = dt.nextElementSibling;
        values.push({ label: noColon(clean(dt.textContent)), value: clean(dd?.textContent) });
      }
      const text = clean(row.querySelector('.ability-info-description')?.textContent);
      if (text || values.length) rows.push({ text, values });
    }
    abilities.push({
      slot,
      name: clean(block.querySelector('.ability-info-stats__ability')?.textContent),
      stats,
      rows,
    });
  }
  return abilities;
}
