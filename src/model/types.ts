export type StatBlock = {
  hp: number;
  mana: number;
  armor: number;
  mr: number;
  ad: number;
  ap: number;
};

/** growth is the per-level value; ap is 0 in both base and growth */
export type ChampionBase = {
  id: string;
  name: string;
  base: StatBlock;
  growth: StatBlock;
  /** Q/W/E/R icon file names from Data Dragon (served from /img/spell/). */
  abilityIcons?: string[];
  /** Data Dragon partype: Mana, Energy, Fury, None, ... */
  resource?: string;
  /** True when no data source has this champion's per-level AD growth (it is then 0). */
  adGrowthUnknown?: boolean;
};

export type Scaling = {
  stat: 'ad' | 'bonusAd' | 'ap' | 'maxHp';
  ratio: number;
};

export type AbilityKey = 'Q' | 'W' | 'E' | 'R';

/** unknown = the ability data gives no usable single damage type (only on not-modelled abilities). */
export type DamageType = 'physical' | 'magic' | 'true' | 'unknown';

export type Ability = {
  key: AbilityKey;
  name: string;
  damageType: DamageType;
  baseByRank: number[];
  scalings: Scaling[];
  status: 'modelled' | 'not-modelled';
  reason?: string;
};

export type Build = {
  championId: string;
  level: number;
  ranks: Record<AbilityKey, number>;
  itemIds: string[];
  runeIds: string[];
};
