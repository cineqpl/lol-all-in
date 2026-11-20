/**
 * Downloads ability descriptions from the League of Legends Wiki into data/wiki-abilities.json.
 * Run with `npm run fetch-wiki`. Content is CC BY-SA 3.0 (see WIKI_SOURCE); the app never calls the wiki.
 *
 * Politeness: only the rendered champion pages (allowed by robots.txt, no api.php or ?action= URLs),
 * one request at a time with a delay, retries with backoff, and raw pages cached in
 * .superpowers/wiki-cache so re-parsing never hits the site again. Delete the cache to refresh.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseWikiAbilities, wikiPageUrl, WIKI_SOURCE, type WikiAbility } from '../src/data/wiki';

const CACHE = '.superpowers/wiki-cache';
const DELAY_MS = 1000;
const USER_AGENT = 'lol-all-in-personal-calculator (static ability data, one-off fetch)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return res.text();
    if (attempt >= 3 || (res.status < 500 && res.status !== 429)) {
      throw new Error(`GET ${url} failed: ${res.status}`);
    }
    await sleep(5000 * attempt);
  }
}

/** Returns the cached page, or downloads it (and waits afterwards) when not cached. */
async function pageHtml(id: string, url: string): Promise<string> {
  const file = `${CACHE}/${id}.html`;
  try {
    return await readFile(file, 'utf8');
  } catch {
    const html = await download(url);
    await writeFile(file, html);
    await sleep(DELAY_MS);
    return html;
  }
}

async function main() {
  const champions = JSON.parse(await readFile('data/champions.json', 'utf8')) as { id: string; name: string }[];
  await mkdir(CACHE, { recursive: true });
  const result: Record<string, { page: string; abilities: WikiAbility[] }> = {};
  const failures: string[] = [];
  for (const [i, c] of champions.entries()) {
    const page = wikiPageUrl(c.name);
    try {
      const abilities = parseWikiAbilities(await pageHtml(c.id, page));
      result[c.id] = { page, abilities };
      const slots = new Set(abilities.map((a) => a.slot));
      const missing = ['innate', 'q', 'w', 'e', 'r'].filter((s) => !slots.has(s as never));
      if (missing.length) console.warn(`${c.name}: no ${missing.join(', ')} found`);
    } catch (e) {
      failures.push(`${c.name}: ${(e as Error).message}`);
    }
    if ((i + 1) % 20 === 0) console.log(`${i + 1}/${champions.length}`);
  }
  await writeFile(
    'data/wiki-abilities.json',
    JSON.stringify({ source: WIKI_SOURCE, fetchedAt: new Date().toISOString(), champions: result }, null, 1) + '\n',
  );
  console.log(`Wrote ${Object.keys(result).length} champions to data/wiki-abilities.json`);
  if (failures.length) {
    console.error(`Failed (${failures.length}):\n${failures.join('\n')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
