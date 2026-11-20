import type { Ability, ChampionBase, StatBlock } from '../model/types';
import type { ItemData, RuneData } from './normalise';

export type DataMeta = { patch: string; abilitiesPatch?: string };

export type GameData = {
  meta: DataMeta;
  champions: Record<string, ChampionBase>;
  abilities: Record<string, Ability[]>;
  items: Record<string, ItemData>;
  runes: Record<string, RuneData>;
};

/** Loads the committed JSON assets. They are bundled, so no network call is made at runtime. */
export async function loadData(): Promise<GameData> {
  const [meta, champions, abilities, items, runes] = await Promise.all([
    import('../../data/meta.json'),
    import('../../data/champions.json'),
    import('../../data/abilities.json'),
    import('../../data/items.json'),
    import('../../data/runes.json'),
  ]);
  const list = champions.default as unknown as ChampionBase[];
  return {
    meta: { patch: meta.default.patch, abilitiesPatch: meta.default.abilitiesPatch },
    champions: Object.fromEntries(list.map((c) => [c.id, c])),
    abilities: abilities.default as unknown as Record<string, Ability[]>,
    items: items.default as unknown as Record<string, ItemData>,
    runes: runes.default as unknown as Record<string, RuneData>,
  };
}

export function lookupChampion(data: GameData, id: string): ChampionBase {
  const champ = data.champions[id];
  if (!champ) throw new Error(`Unknown champion id: ${id}`);
  return champ;
}

export function sumItemStats(data: GameData, ids: string[]): StatBlock {
  const total: StatBlock = { hp: 0, mana: 0, armor: 0, mr: 0, ad: 0, ap: 0 };
  for (const id of ids) {
    const item = data.items[id];
    if (!item) throw new Error(`Unknown item id: ${id}`);
    for (const k of Object.keys(item.stats) as (keyof StatBlock)[]) total[k] += item.stats[k] ?? 0;
  }
  return total;
}
