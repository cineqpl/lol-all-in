import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseWikiAbilities, wikiPageUrl } from '../src/data/wiki';

const html = readFileSync('tests/fixtures/wiki-aatrox.html', 'utf8');

describe('parseWikiAbilities', () => {
  const abilities = parseWikiAbilities(html);

  test('returns one entry per ability block, in page order, ignoring tooltip blurbs', () => {
    expect(abilities.map((a) => [a.slot, a.name])).toEqual([
      ['innate', 'Deathbringer Stance'],
      ['q', 'The Darkin Blade'],
    ]);
  });

  test('reads header stats as label/value pairs without the trailing colon', () => {
    const q = abilities[1];
    expect(q.stats).toContainEqual({ label: 'COOLDOWN', value: '14 / 12 / 10 / 8 / 6' });
    expect(q.stats).toContainEqual({ label: 'CAST TIME', value: '0.6' });
  });

  test('keeps description text and per-rank values of each row', () => {
    const q = abilities[1];
    const firstCast = q.rows.find((r) => r.text.startsWith('First Cast:'));
    expect(firstCast?.text).toContain('rectangular area');
    expect(firstCast?.values).toEqual([
      { label: 'First Cast Damage', value: '10 / 25 / 40 / 55 / 70 (+ 60 / 67.5 / 75 / 82.5 / 90% AD)' },
      { label: 'First Sweetspot Damage', value: '17.5 / 43.75 / 70 / 96.25 / 122.5 (+ 105 / 118.125 / 131.25 / 144.375 / 157.5% AD)' },
    ]);
  });

  test('keeps rows that carry only description text, with no values', () => {
    const q = abilities[1];
    const intro = q.rows.find((r) => r.text.startsWith('Aatrox can activate'));
    expect(intro?.values).toEqual([]);
  });

  test('maps Hwei-style classes like skill_qqwe to their slot letter', () => {
    const block = (cls: string, name: string) =>
      `<div class="skill ${cls}"><div class="ability-info-stats__ability">${name}</div></div>`;
    const page = `<div>${block('skill_qqwe', 'Subject Q')}${block('skill_wqwe', 'Subject W')}${block('skill_eqwe', 'Subject E')}</div>`;
    expect(parseWikiAbilities(page).map((a) => [a.slot, a.name])).toEqual([
      ['q', 'Subject Q'],
      ['w', 'Subject W'],
      ['e', 'Subject E'],
    ]);
  });

  test('returns an empty list for a page with no ability blocks', () => {
    expect(parseWikiAbilities('<html><body><p>nothing</p></body></html>')).toEqual([]);
  });
});

describe('wikiPageUrl', () => {
  test('uses underscores and encodes special characters', () => {
    expect(wikiPageUrl('Dr. Mundo')).toBe('https://wiki.leagueoflegends.com/en-us/Dr._Mundo');
    expect(wikiPageUrl("Kai'Sa")).toBe("https://wiki.leagueoflegends.com/en-us/Kai'Sa");
    expect(wikiPageUrl('Nunu & Willump')).toBe('https://wiki.leagueoflegends.com/en-us/Nunu_%26_Willump');
  });
});
