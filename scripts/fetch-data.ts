/**
 * Downloads public League data and writes normalised JSON into data/.
 * Run with `npm run fetch-data`; the app itself never calls these APIs.
 *
 * Sources:
 *  - Data Dragon (current patch): champion stats, items, runes, summoner spells.
 *  - Meraki Analytics (ability damage/ratios): the only structured source found. Its snapshot
 *    lags the live patch (see abilitiesPatch in data/meta.json). Data Dragon and Community
 *    Dragon expose only formula placeholders such as {{ totaldamage }} for ability damage.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import {
  normaliseChampions,
  normaliseItems,
  normaliseRunes,
  normaliseSummoners,
} from '../src/data/normalise';
import { missingAbilities, normaliseAbilities } from '../src/data/abilities';

const MERAKI = 'https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json';
const DD = 'https://ddragon.leagueoflegends.com';

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

async function fetchMeraki(): Promise<{ champions: Record<string, any>; lastModified: string | null }> {
  const res = await fetch(MERAKI);
  if (!res.ok) throw new Error(`GET ${MERAKI} failed: ${res.status}`);
  return { champions: (await res.json()) as Record<string, any>, lastModified: res.headers.get('last-modified') };
}

async function main() {
  const versions = (await getJson(`${DD}/api/versions.json`)) as string[];
  const patch = versions[0];
  const base = `${DD}/cdn/${patch}/data/en_US`;
  const [champions, items, runes, summoners] = await Promise.all([
    getJson(`${base}/champion.json`),
    getJson(`${base}/item.json`),
    getJson(`${base}/runesReforged.json`),
    getJson(`${base}/summoner.json`),
  ]);

  const meraki = await fetchMeraki();
  const champList = normaliseChampions(champions);
  const abilities = Object.fromEntries(
    champList.map((c) => [c.id, meraki.champions[c.id] ? normaliseAbilities(meraki.champions[c.id]) : missingAbilities()]),
  );
  const abilitiesPatch = Object.values(meraki.champions)
    .map((c) => String(c.patchLastChanged ?? ''))
    .sort()
    .at(-1);

  await mkdir('data', { recursive: true });
  const write = (name: string, value: unknown) =>
    writeFile(`data/${name}`, JSON.stringify(value, null, 1) + '\n');

  await write('champions.json', champList);
  await write('abilities.json', abilities);
  await write('items.json', normaliseItems(items));
  await write('runes.json', normaliseRunes(runes));
  await write('summoners.json', normaliseSummoners(summoners));
  await write('meta.json', {
    patch,
    fetchedAt: new Date().toISOString(),
    abilitiesSource: 'meraki',
    abilitiesPatch,
    abilitiesLastModified: meraki.lastModified,
  });
  console.log(`Wrote data for patch ${patch}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
