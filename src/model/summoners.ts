/**
 * Ignite true damage over its 5-second duration, by champion level 1-20.
 * Data Dragon only exposes a formula placeholder for this, so the values are copied from the
 * League of Legends Wiki's Ignite page (CC BY-SA 3.0): +20 per level through level 5, then +25.
 */
const IGNITE_BY_LEVEL = [
  70, 90, 110, 130, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 525,
];

/** True damage, not reduced by armor or magic resist. Assumes the full duration ticks. */
export function igniteDamage(level: number): number {
  const n = Math.min(20, Math.max(1, Math.floor(level)));
  return IGNITE_BY_LEVEL[n - 1];
}
