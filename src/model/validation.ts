import { KEYS, levelingFor, type LevelingRules } from './leveling';
import type { AbilityKey } from './types';

/**
 * Checks ability ranks against the leveling rules and returns one message per violation.
 * Defaults to the standard rules; pass a champion's rules (see levelingFor) for the exceptions.
 */
export function validateRanks(
  level: number,
  ranks: Record<AbilityKey, number>,
  rules: LevelingRules = levelingFor(''),
): string[] {
  const warnings: string[] = [];
  const cap = Math.ceil(level / 2);
  for (const k of KEYS) {
    if (ranks[k] > rules.maxRank[k]) {
      warnings.push(`${k} rank ${ranks[k]} is above the maximum for this champion (${rules.maxRank[k]}).`);
    }
    if (k === 'R' && rules.ultimateLevels) {
      // The ultimate follows its own table of required levels instead of the half-level rule.
      const required = rules.ultimateLevels[ranks.R - 1];
      if (ranks.R > 0 && required !== undefined && level < required) {
        warnings.push(`R rank ${ranks.R} requires champion level ${required}.`);
      }
    } else if (ranks[k] > cap) {
      warnings.push(`${k} rank ${ranks[k]} is too high for level ${level} (maximum ${cap}).`);
    }
  }
  return warnings;
}
