import { DEFAULT_COMBO, type Combo } from './combo';
import { comboDamage } from './damage';
import { statBreakdown, type StatBreakdown } from './stats';
import { igniteDamage } from './summoners';
import type { Ability, Build, ChampionBase, StatBlock } from './types';

export type Side = {
  champion: ChampionBase;
  abilities: Ability[];
  build: Build;
  itemStats: StatBlock;
  /** Selected items/runes whose effects the model ignores (shown to the user). */
  unmodelledEffects?: string[];
  /** What this side does in the skirmish; defaults to DEFAULT_COMBO. */
  combo?: Combo;
};

export type MatchupResult = {
  yourDamage: number;
  yourPctOfEnemyHp: number;
  enemyDamage: number;
  enemyPctOfYourHp: number;
  status: 'safe' | 'even' | 'danger';
  yourNotModelled: Ability[];
  enemyNotModelled: Ability[];
  yourUnmodelledEffects: string[];
  enemyUnmodelledEffects: string[];
};

export function breakdownOf(side: Side): StatBreakdown {
  return statBreakdown(side.champion, side.build.level, side.itemStats);
}

function attack(from: Side, fromStats: StatBreakdown, targetStats: StatBreakdown) {
  const combo = from.combo ?? DEFAULT_COMBO;
  const result = comboDamage(from.abilities, from.build.ranks, fromStats, targetStats, combo.autos, combo.hits);
  // Ignite is true damage, so the target's armor and magic resist do not apply.
  if (combo.ignite) result.total += igniteDamage(from.build.level);
  return result;
}

export function computeMatchup(you: Side, enemy: Side): MatchupResult {
  const yours = breakdownOf(you);
  const theirs = breakdownOf(enemy);
  const mine = attack(you, yours, theirs);
  const their = attack(enemy, theirs, yours);
  const yourPctOfEnemyHp = mine.total / theirs.hp.total;
  const enemyPctOfYourHp = their.total / yours.hp.total;
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
    yourUnmodelledEffects: you.unmodelledEffects ?? [],
    enemyUnmodelledEffects: enemy.unmodelledEffects ?? [],
  };
}
