import { comboDamage } from './damage';
import { statsAtLevel } from './stats';
import type { Ability, Build, ChampionBase, StatBlock } from './types';

/** Basic attacks included in every combo. */
export const AUTOS_IN_COMBO = 2;

export type Side = {
  champion: ChampionBase;
  abilities: Ability[];
  build: Build;
  itemStats: StatBlock;
};

export type MatchupResult = {
  yourDamage: number;
  yourPctOfEnemyHp: number;
  enemyDamage: number;
  enemyPctOfYourHp: number;
  status: 'safe' | 'even' | 'danger';
  yourNotModelled: Ability[];
  enemyNotModelled: Ability[];
};

function totalStats(side: Side): StatBlock {
  const base = statsAtLevel(side.champion, side.build.level);
  const out = { ...base };
  for (const k of Object.keys(out) as (keyof StatBlock)[]) out[k] += side.itemStats[k];
  return out;
}

function attack(from: Side, fromStats: StatBlock, targetStats: StatBlock) {
  return comboDamage(
    from.abilities,
    from.build.ranks,
    { total: fromStats, bonusAd: from.itemStats.ad },
    targetStats,
    AUTOS_IN_COMBO,
  );
}

export function computeMatchup(you: Side, enemy: Side): MatchupResult {
  const yours = totalStats(you);
  const theirs = totalStats(enemy);
  const mine = attack(you, yours, theirs);
  const their = attack(enemy, theirs, yours);
  const yourPctOfEnemyHp = mine.total / theirs.hp;
  const enemyPctOfYourHp = their.total / yours.hp;
  const status =
    enemyPctOfYourHp >= 1 ? 'danger' : yourPctOfEnemyHp >= 1 ? 'safe' : 'even';
  return {
    yourDamage: mine.total,
    yourPctOfEnemyHp,
    enemyDamage: their.total,
    enemyPctOfYourHp,
    status,
    yourNotModelled: mine.notModelled,
    enemyNotModelled: their.notModelled,
  };
}
