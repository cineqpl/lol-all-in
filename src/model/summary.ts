import { totalStats, type Side } from './matchup';
import { statsAtLevel } from './stats';

export type StatSummary = {
  hp: number;
  ad: number;
  ap: number;
  /** Only for champions that use Mana or Energy. */
  resource?: { label: 'Mana' | 'Energy'; value: number };
};

/** HP, AD, AP and mana/energy for one side, from champion level and items. */
export function summarizeStats(side: Side): StatSummary {
  const total = totalStats(side);
  const summary: StatSummary = { hp: total.hp, ad: total.ad, ap: total.ap };
  if (side.champion.resource === 'Mana') {
    summary.resource = { label: 'Mana', value: total.mana };
  } else if (side.champion.resource === 'Energy') {
    // Items add mana, not energy, so energy comes from the champion alone.
    summary.resource = { label: 'Energy', value: statsAtLevel(side.champion, side.build.level).mana };
  }
  return summary;
}
