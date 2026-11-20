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
};

export type Scaling = {
  stat: 'ad' | 'bonusAd' | 'ap' | 'maxHp';
  ratio: number;
};

export type AbilityKey = 'Q' | 'W' | 'E' | 'R';

export type Ability = {
  key: AbilityKey;
  name: string;
  damageType: 'physical' | 'magic' | 'true';
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
