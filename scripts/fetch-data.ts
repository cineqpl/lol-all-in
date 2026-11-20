/**
 * Downloads public League data and writes normalised JSON into data/.
 * Run with `npm run fetch-data`; the app itself never calls these APIs.
 *
 * Sources:
 *  - Data Dragon (current patch): champion stats, items, runes, summoner spells.
 *  - Meraki Analytics: only the per-level AD growth missing from Data Dragon for some champions.
 *  - Ability damage comes from the wiki instead: see scripts/fetch-wiki.ts and scripts/build-abilities.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { imageJobs, type ImageJob } from '../src/data/images';
import {
  abilityIconFiles,
  applyAdGrowth,
  normaliseChampions,
  normaliseItems,
  normaliseRunes,
  normaliseSummoners,
} from '../src/data/normalise';

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

/** Runs fn over items with a small concurrency limit. */
async function mapPool<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 8): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) results[i] = await fn(items[i]);
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
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
  const baseChamps = normaliseChampions(champions);
  // Spell icon file names are only in the per-champion files, so fetch one per champion.
  const iconFiles = await mapPool(baseChamps, async (c) =>
    abilityIconFiles(await getJson(`${base}/champion/${c.id}.json`), c.id),
  );
  const champList = applyAdGrowth(baseChamps, meraki.champions).map((c, i) => ({
    ...c,
    abilityIcons: iconFiles[i],
  }));
  await mkdir('data', { recursive: true });
  const write = (name: string, value: unknown) =>
    writeFile(`data/${name}`, JSON.stringify(value, null, 1) + '\n');

  await write('champions.json', champList);
  await write('items.json', normaliseItems(items));
  await write('runes.json', normaliseRunes(runes));
  await write('summoners.json', normaliseSummoners(summoners));
  await write('meta.json', {
    patch,
    fetchedAt: new Date().toISOString(),
    adGrowthSource: 'meraki',
    adGrowthLastModified: meraki.lastModified,
  });
  // Only icons the UI can show: every champion, and items that have flat stats (the picker list).
  const itemData = normaliseItems(items);
  const selectableItemIds = Object.entries(itemData)
    .filter(([, item]) => Object.keys(item.stats).length > 0)
    .map(([id]) => id);
  // SummonerDot is Ignite, shown in the combo box.
  const jobs = imageJobs(patch, champList.map((c) => c.id), selectableItemIds, [...iconFiles.flat(), 'SummonerDot.png']);
  await downloadImages(jobs);
  console.log(`Wrote data and ${jobs.length} images for patch ${patch}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
