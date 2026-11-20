import { describe, expect, test } from 'vitest';
import { clampRanks, levelingFor, minRank, startingRanks } from '../src/model/leveling';
import { validateRanks } from '../src/model/validation';

const ranks = (Q = 0, W = 0, E = 0, R = 0) => ({ Q, W, E, R });

describe('levelingFor', () => {
  test('most champions: basics to 5, ultimate to 3 at levels 6, 11 and 16', () => {
    const r = levelingFor('Annie');
    expect(r.maxRank).toEqual({ Q: 5, W: 5, E: 5, R: 3 });
    expect(r.ultimateLevels).toEqual([6, 11, 16]);
  });

  test('Udyr has no ultimate: all four abilities go to 5 under the half-level cap', () => {
    const r = levelingFor('Udyr');
    expect(r.maxRank).toEqual({ Q: 5, W: 5, E: 5, R: 5 });
    expect(r.ultimateLevels).toBeNull();
    expect(validateRanks(1, ranks(1, 0, 0, 1), r)).toEqual([]);
    expect(validateRanks(1, ranks(0, 0, 0, 2), r)[0]).toMatch(/R.*1/);
    expect(validateRanks(9, ranks(0, 0, 0, 5), r)).toEqual([]);
    expect(validateRanks(7, ranks(0, 0, 0, 5), r)[0]).toMatch(/R.*4/);
  });

  test.each(['Nidalee', 'Elise', 'Karma'])('%s has the ultimate at level 1, up to rank 4 at levels 6, 11 and 16', (id) => {
    const r = levelingFor(id);
    expect(r.maxRank.R).toBe(4);
    expect(validateRanks(1, ranks(0, 0, 0, 1), r)).toEqual([]);
    expect(validateRanks(5, ranks(0, 0, 0, 2), r)[0]).toMatch(/R.*6/);
    expect(validateRanks(6, ranks(0, 0, 0, 2), r)).toEqual([]);
    expect(validateRanks(10, ranks(0, 0, 0, 3), r)[0]).toMatch(/R.*11/);
    expect(validateRanks(15, ranks(0, 0, 0, 4), r)[0]).toMatch(/R.*16/);
    expect(validateRanks(16, ranks(0, 0, 0, 4), r)).toEqual([]);
    expect(r.maxRank).toEqual({ Q: 5, W: 5, E: 5, R: 4 });
  });

  test('Jayce has his ultimate at level 1 always and basics up to 6 under the half-level cap', () => {
    const r = levelingFor('Jayce');
    expect(r.maxRank).toEqual({ Q: 6, W: 6, E: 6, R: 1 });
    expect(validateRanks(1, ranks(1, 0, 0, 1), r)).toEqual([]);
    expect(validateRanks(10, ranks(6), r)[0]).toMatch(/Q.*5/);
    expect(validateRanks(11, ranks(6, 6, 6), r)).toEqual([]);
  });
});

describe('validateRanks against a champion maximum', () => {
  test('a rank above the champion maximum is reported', () => {
    expect(validateRanks(18, ranks(0, 0, 0, 2), levelingFor('Jayce'))[0]).toMatch(/R.*maximum.*1/);
  });
});

describe('minRank', () => {
  test.each(['Nidalee', 'Elise', 'Karma', 'Jayce'])('%s cannot go below ultimate rank 1', (id) => {
    expect(minRank(levelingFor(id), 'R')).toBe(1);
    expect(minRank(levelingFor(id), 'Q')).toBe(0);
  });
  test('everyone else can leave the ultimate unlearned', () => {
    expect(minRank(levelingFor('Annie'), 'R')).toBe(0);
    expect(minRank(levelingFor('Udyr'), 'R')).toBe(0);
  });
});

describe('startingRanks and clampRanks', () => {
  test('Q starts at 1; the ultimate also starts at 1 when it is available at level 1', () => {
    expect(startingRanks(levelingFor('Annie'))).toEqual(ranks(1, 0, 0, 0));
    expect(startingRanks(levelingFor('Karma'))).toEqual(ranks(1, 0, 0, 1));
    expect(startingRanks(levelingFor('Jayce'))).toEqual(ranks(1, 0, 0, 1));
    expect(startingRanks(levelingFor('Udyr'))).toEqual(ranks(1, 0, 0, 0));
  });
  test('clampRanks cuts ranks to the champion maximum', () => {
    expect(clampRanks(ranks(6, 2, 0, 5), levelingFor('Annie'))).toEqual(ranks(5, 2, 0, 3));
  });
  test('clampRanks raises an ultimate that must stay learned', () => {
    expect(clampRanks(ranks(1, 0, 0, 0), levelingFor('Karma'))).toEqual(ranks(1, 0, 0, 1));
  });
});
