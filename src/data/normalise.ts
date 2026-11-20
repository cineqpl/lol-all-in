import type { ChampionBase, StatBlock } from '../model/types';

export type ItemData = { name: string; stats: Partial<StatBlock>; hasEffects: boolean };
export type RuneData = { name: string; key: string; tree: string };
export type SummonerData = { id: string; name: string; cooldown: number };

type Raw = Record<string, any>;

export function normaliseChampions(raw: unknown): ChampionBase[] {
  const data = (raw as Raw).data as Raw;
  return Object.values(data).map((c) => {
    const s = c.stats;
    return {
      id: c.id,
      name: c.name,
      base: { hp: s.hp, mana: s.mp, armor: s.armor, mr: s.spellblock, ad: s.attackdamage, ap: 0 },
      growth: {
        hp: s.hpperlevel,
        mana: s.mpperlevel,
        armor: s.armorperlevel,
        mr: s.spellblockperlevel,
        ad: s.attackdamageperlevel,
        ap: 0,
      },
    };
  });
}

const ITEM_STAT_KEYS: Record<string, keyof StatBlock> = {
  FlatHPPoolMod: 'hp',
  FlatMPPoolMod: 'mana',
  FlatArmorMod: 'armor',
  FlatSpellBlockMod: 'mr',
  FlatPhysicalDamageMod: 'ad',
  FlatMagicDamageMod: 'ap',
};

export function normaliseItems(raw: unknown): Record<string, ItemData> {
  const data = (raw as Raw).data as Raw;
  const out: Record<string, ItemData> = {};
  for (const [id, item] of Object.entries<Raw>(data)) {
    // Summoners Rift (map 11) purchasable items only: other modes reuse names with different stats.
    if (item.maps?.['11'] !== true || item.gold?.purchasable === false) continue;
    const stats: Partial<StatBlock> = {};
    for (const [k, v] of Object.entries<number>(item.stats ?? {})) {
      const key = ITEM_STAT_KEYS[k];
      if (key) stats[key] = v;
    }
    const desc: string = item.description ?? '';
    out[id] = { name: item.name, stats, hasEffects: /<(passive|active|unique)/i.test(desc) };
  }
  return out;
}

export function normaliseRunes(raw: unknown): Record<string, RuneData> {
  const out: Record<string, RuneData> = {};
  for (const tree of raw as Raw[]) {
    for (const slot of tree.slots) {
      for (const r of slot.runes) out[String(r.id)] = { name: r.name, key: r.key, tree: tree.name };
    }
  }
  return out;
}

export function normaliseSummoners(raw: unknown): Record<string, SummonerData> {
  const data = (raw as Raw).data as Raw;
  const out: Record<string, SummonerData> = {};
  for (const s of Object.values<Raw>(data)) {
    out[s.id] = { id: s.id, name: s.name, cooldown: s.cooldown?.[0] ?? 0 };
  }
  return out;
}
