/**
 * Manual review of parsed abilities. Each risky ability gets an entry in data/overrides/<Champion>.json
 * (see scripts/init-overrides.ts); build-abilities applies the entries on top of the parsed data.
 */
import type { Ability, Cast } from '../model/types';

/** unchecked = not looked at yet; ok = looked at, the parse is right; fixed = `override` replaces the casts. */
export type ReviewStatus = 'unchecked' | 'ok' | 'fixed';

export type OverrideEntry = {
  status: ReviewStatus;
  override: { casts: Cast[] } | null;
};

const PER_HIT = /per |stack|tick|second|bonus|empowered|execute/i;

/** Why an ability is worth a manual look; empty when its parse is a single plain damage line. */
export function riskReasons(a: Ability): string[] {
  const reasons: string[] = [];
  if (a.unread.length > 0) reasons.push(`${a.unread.length} unread damage line(s)`);
  if (a.casts.length > 1) reasons.push(`${a.casts.length} casts`);
  if (a.casts.some((c) => c.components.length > 1)) reasons.push('several damage lines in one cast');
  if (a.casts.some((c) => c.components.some((x) => PER_HIT.test(x.label)))) {
    reasons.push('per-hit wording (stacks, ticks, empowered, bonus, execute)');
  }
  return reasons;
}

/** The ability with its review applied: reviewed abilities stop being reported as unread. */
export function applyOverride(a: Ability, entry: OverrideEntry | undefined): Ability {
  if (!entry || entry.status === 'unchecked') return a;
  return { ...a, casts: entry.override?.casts ?? a.casts, unread: [] };
}
