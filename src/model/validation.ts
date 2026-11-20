import type { AbilityKey } from './types';

/** Champion level required to put points into R rank 1, 2 and 3. */
const R_RANK_LEVELS = [6, 11, 16];
const BASIC_KEYS: AbilityKey[] = ['Q', 'W', 'E'];

/**
 * Checks ability ranks against the standard leveling rules and returns one message per violation.
 * Some champions are exceptions to these rules; those are not handled yet.
 */
export function validateRanks(level: number, ranks: Record<AbilityKey, number>): string[] {
  const warnings: string[] = [];
  const cap = Math.ceil(level / 2);
  for (const k of BASIC_KEYS) {
    if (ranks[k] > cap) {
      warnings.push(`${k} rank ${ranks[k]} is too high for level ${level} (maximum ${cap}).`);
    }
  }
  if (ranks.R > cap) {
    warnings.push(`R rank ${ranks.R} is too high for level ${level} (maximum ${cap}).`);
  }
  const requiredLevel = R_RANK_LEVELS[ranks.R - 1];
  if (ranks.R > 0 && requiredLevel !== undefined && level < requiredLevel) {
    warnings.push(`R rank ${ranks.R} requires champion level ${requiredLevel}.`);
  }
  return warnings;
}
