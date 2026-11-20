import { describe, expect, test } from 'vitest';
import { validateRanks } from '../src/model/validation';

const ranks = (Q = 0, W = 0, E = 0, R = 0) => ({ Q, W, E, R });

describe('validateRanks', () => {
  test('valid setups give no warnings', () => {
    expect(validateRanks(6, ranks(3, 1, 1, 1))).toEqual([]);
    expect(validateRanks(1, ranks(1, 0, 0, 0))).toEqual([]);
  });

  test('unlearned abilities never warn', () => {
    expect(validateRanks(1, ranks())).toEqual([]);
  });

  test('R rank 1 needs champion level 6', () => {
    expect(validateRanks(5, ranks(0, 0, 0, 1))[0]).toMatch(/R.*6/);
    expect(validateRanks(6, ranks(0, 0, 0, 1))).toEqual([]);
  });

  test('R rank 2 needs level 11 and R rank 3 needs level 16', () => {
    expect(validateRanks(10, ranks(0, 0, 0, 2))[0]).toMatch(/R.*11/);
    expect(validateRanks(11, ranks(0, 0, 0, 2))).toEqual([]);
    expect(validateRanks(15, ranks(0, 0, 0, 3))[0]).toMatch(/R.*16/);
    expect(validateRanks(16, ranks(0, 0, 0, 3))).toEqual([]);
  });

  test('a basic ability rank cannot exceed half the level rounded up', () => {
    expect(validateRanks(1, ranks(2))[0]).toMatch(/Q.*1/);
    expect(validateRanks(7, ranks(5))[0]).toMatch(/Q.*4/);
    expect(validateRanks(7, ranks(4))).toEqual([]);
    expect(validateRanks(9, ranks(5))).toEqual([]);
  });

  test('reports every broken rule', () => {
    expect(validateRanks(1, ranks(3, 3, 0, 1))).toHaveLength(3);
  });
});
