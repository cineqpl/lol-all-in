/**
 * Builds data/abilities.json (damage components per champion) from data/wiki-abilities.json.
 * Run after `npm run fetch-wiki` or after changing src/data/components.ts: `npm run build-abilities`.
 * Ability text is from the League of Legends Wiki (CC BY-SA 3.0); the attribution travels in the output.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { abilitiesFromWiki } from '../src/data/components';
import type { WikiAbility } from '../src/data/wiki';

const wiki = JSON.parse(await readFile('data/wiki-abilities.json', 'utf8')) as {
  source: unknown;
  fetchedAt: string;
  champions: Record<string, { abilities: WikiAbility[] }>;
};
const champions = JSON.parse(await readFile('data/champions.json', 'utf8')) as { id: string }[];

const out = Object.fromEntries(
  champions.map((c) => [c.id, abilitiesFromWiki(wiki.champions[c.id]?.abilities)]),
);
await writeFile(
  'data/abilities.json',
  JSON.stringify({ source: wiki.source, fetchedAt: wiki.fetchedAt, champions: out }, null, 1) + '\n',
);
const missing = champions.filter((c) => !wiki.champions[c.id]).map((c) => c.id);
console.log(`Wrote abilities for ${champions.length} champions; no wiki data for: ${missing.join(', ') || 'none'}`);
