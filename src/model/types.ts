export type StatBlock = {
  hp: number;
  mana: number;
  armor: number;
  mr: number;
  ad: number;
  ap: number;
  /**
   * Champion base: base attack speed; growth: per-level fraction of base (0.02 = +2%);
   * items: bonus fraction of base (0.35 = +35%).
   */
  attackSpeed: number;
};

/** growth is the per-level value; ap is 0 in both base and growth; see StatBlock.attackSpeed */
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

export type AbilityKey = 'Q' | 'W' | 'E' | 'R';

/** What an ability can scale with: the caster's own stats (bonus = from items), or the target's health. */
export type ComponentStat =
  | 'ad' | 'bonusAd' | 'ap'
  | 'maxHp' | 'bonusHp'
  | 'armor' | 'bonusArmor' | 'mr' | 'bonusMr'
  | 'maxMana'
  | 'targetMaxHp' | 'targetCurrentHp' | 'targetMissingHp';

/** ratio is a fraction (0.6 = 60%): one value for every rank, or one per rank. */
export type ComponentScaling = { stat: ComponentStat; ratio: number[] };

export type DamageType = 'physical' | 'magic' | 'true';

/** One damage line of an ability: flat base plus scalings, per rank. */
export type DamageComponent = {
  label: string;
  /** The wiki stage this belongs to ("Active", "First Cast", "Recast"). */
  cast: string;
  type: DamageType;
  /** One value per rank, or a single value for every rank. */
  base: number[];
  scalings: ComponentScaling[];
};

/** One cast of an ability. Each cast gets its own hit count in the combo. */
export type Cast = { name: string; components: DamageComponent[] };

export type Ability = {
  key: AbilityKey;
  name: string;
  casts: Cast[];
  /** Damage lines the data has but the model could not read, as readable messages. Empty when fully read. */
  unread: string[];
};

export type Build = {
  championId: string;
  level: number;
  ranks: Record<AbilityKey, number>;
  itemIds: string[];
  runeIds: string[];
};
