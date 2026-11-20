import type { Side } from './matchup';
import { statBreakdown, statsAtLevel, type StatPart } from './stats';

export type StatSummary = {
  hp: StatPart;
  ad: StatPart;
  ap: StatPart;
  armor: StatPart;
  mr: StatPart;
  /** Fractions of base: bonus / base is the bonus percentage. */
  attackSpeed: StatPart;
  /** Only for champions that use Mana or Energy. */
  resource?: StatPart & { label: 'Mana' | 'Energy' };
};

/** Base and bonus stats for one side, from champion level and items. */
export function summarizeStats(side: Side): StatSummary {
  const b = statBreakdown(side.champion, side.build.level, side.itemStats);
  const summary: StatSummary = {
    hp: b.hp, ad: b.ad, ap: b.ap, armor: b.armor, mr: b.mr, attackSpeed: b.attackSpeed,
  };
  if (side.champion.resource === 'Mana') {
    summary.resource = { label: 'Mana', ...b.mana };
  } else if (side.champion.resource === 'Energy') {
    // Items add mana, not energy, so energy comes from the champion alone.
    const energy = statsAtLevel(side.champion, side.build.level).mana;
    summary.resource = { label: 'Energy', base: energy, bonus: 0, total: energy };
  }
  return summary;
}
