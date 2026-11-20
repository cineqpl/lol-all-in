import { describe, expect, test } from 'vitest';
import { igniteDamage } from '../src/model/summoners';

describe('igniteDamage', () => {
  test.each([
    [1, 70],
    [5, 150],
    [6, 175],
    [10, 275],
    [18, 475],
    [20, 525],
  ])('level %i deals %i true damage', (level, damage) => {
    expect(igniteDamage(level)).toBe(damage);
  });

  test('levels outside 1-20 clamp', () => {
    expect(igniteDamage(0)).toBe(70);
    expect(igniteDamage(25)).toBe(525);
  });
});
