/**
 * Creates data/overrides/<Champion>.json for every ability worth a manual look (see riskReasons),
 * split by champion and ability letter. Each entry shows the wiki damage lines next to what the
 * parser made of them. Existing status, override and note are kept; the reference fields are refreshed.
 * Run: npm run init-overrides, then npm run build-abilities.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { abilitiesFromWiki, parseComponents } from '../src/data/components';
import { riskReasons } from '../src/data/overrides';
import type { WikiAbility } from '../src/data/wiki';
import type { Cast } from '../src/model/types';

const names = Object.fromEntries(
  (JSON.parse(await readFile('data/champions.json', 'utf8')) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
);
const wiki = JSON.parse(await readFile('data/wiki-abilities.json', 'utf8')).champions as Record<string, { abilities: WikiAbility[] }>;

const LABEL: Record<string, string> = {
  ad: 'AD', bonusAd: 'bonus AD', ap: 'AP', maxHp: 'max HP', bonusHp: 'bonus HP', armor: 'armor', bonusArmor: 'bonus armor',
  mr: 'MR', bonusMr: 'bonus MR', maxMana: 'max mana', targetMaxHp: "target's max HP", targetCurrentHp: "target's current HP",
  targetMissingHp: "target's missing HP",
};
const pct = (r: number[]) => r.map((x) => +(x * 100).toFixed(3)).join('/');
const summary = (casts: Cast[]) =>
  casts.flatMap((c) =>
    c.components.map((x) => {
      const sc = x.scalings.map((s) => ` + ${pct(s.ratio)}% ${LABEL[s.stat]}${s.via ? ` x ${LABEL[s.via]}` : ''}`).join('');
      return `${c.name}: ${x.label} (${x.type}) ${x.base.join('/')}${sc}`;
    }),
  );
const stageOf = (text: string) => /^([^:]{1,45}):/.exec(text)?.[1].trim() ?? 'Active';

await mkdir('data/overrides', { recursive: true });
let abilitiesWritten = 0;
let champions = 0;
for (const [id, c] of Object.entries(wiki)) {
  const abilities = abilitiesFromWiki(c.abilities, names[id]);
  const path = `data/overrides/${id}.json`;
  let existing: Record<string, any> = {};
  try { existing = JSON.parse(await readFile(path, 'utf8')); } catch { /* new file */ }
  const out: Record<string, unknown> = {};
  for (const a of abilities) {
    const reasons = riskReasons(a);
    const old = existing[a.key];
    if (reasons.length === 0 && !old) continue;
    const block = c.abilities.find((b) => b.slot === a.key.toLowerCase())!;
    out[a.key] = {
      name: a.name,
      status: old?.status ?? 'unchecked',
      reasons,
      wikiLines: block.rows.flatMap((r) => r.values.filter((v) => /damage/i.test(v.label)).map((v) => `[${stageOf(r.text)}] ${v.label} = ${v.value}`)),
      skipped: parseComponents(block, names[id]).skipped.map((s) => `${s.label}: ${s.reason}`),
      parsed: summary(a.casts),
      override: old?.override ?? null,
      note: old?.note ?? '',
    };
    abilitiesWritten++;
  }
  if (Object.keys(out).length > 0) {
    await writeFile(path, JSON.stringify(out, null, 1) + '\n');
    champions++;
  }
}
console.log(`Wrote ${abilitiesWritten} abilities in ${champions} champion files under data/overrides/`);
