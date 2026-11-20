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
import { dirname } from 'node:path';
import { imageJobs, type ImageJob } from '../src/data/images';
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

/** Downloads images with a small concurrency limit; any failure aborts the run. */
async function downloadImages(jobs: ImageJob[], concurrency = 8): Promise<void> {
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const res = await fetch(job.url);
      if (!res.ok) throw new Error(`GET ${job.url} failed: ${res.status}`);
      await mkdir(dirname(job.dest), { recursive: true });
      await writeFile(job.dest, Buffer.from(await res.arrayBuffer()));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
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
  // Only icons the UI can show: every champion, and items that have flat stats (the picker list).
  const itemData = normaliseItems(items);
  const selectableItemIds = Object.entries(itemData)
    .filter(([, item]) => Object.keys(item.stats).length > 0)
    .map(([id]) => id);
  const jobs = imageJobs(patch, champList.map((c) => c.id), selectableItemIds);
  await downloadImages(jobs);
  console.log(`Wrote data and ${jobs.length} images for patch ${patch}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
