import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyRollMode, formatExpression, parseDice, roll } from './dice';

/** Makes the next dice come up as the given faces, in order. */
function rigDice(...faces: number[]) {
  const queue = [...faces];
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(arr: T) => {
    const next = queue.shift();
    if (next === undefined) throw new Error('rigDice: ran out of faces');
    // randomInt() maps the random value v to (v % sides) + 1.
    (arr as unknown as Uint32Array)[0] = next - 1;
    return arr;
  });
}

afterEach(() => vi.restoreAllMocks());

describe('parseDice', () => {
  it('parses single dice, counts, modifiers and keep rules', () => {
    expect(parseDice('d20')).toEqual([{ sign: 1, count: 1, sides: 20 }]);
    expect(parseDice('2d6+3')).toEqual([
      { sign: 1, count: 2, sides: 6 },
      { sign: 1, count: 3, sides: 0 },
    ]);
    expect(parseDice('4d6kh3')).toEqual([{ sign: 1, count: 4, sides: 6, keep: { type: 'h', n: 3 } }]);
    expect(parseDice('2d20kl1')).toEqual([{ sign: 1, count: 2, sides: 20, keep: { type: 'l', n: 1 } }]);
  });

  it('ignores spaces and case, and allows a leading minus', () => {
    expect(parseDice(' 2D6 + 1d4 - 1 ')).toHaveLength(3);
    expect(parseDice('-1d4')?.[0].sign).toBe(-1);
  });

  it.each(['', '2d', 'd', '2d6+', 'abc', '1d1', '0d6', '101d6', '4d6kh5', '4d6kh0', '1d20++5'])(
    'rejects %j',
    (expr) => expect(parseDice(expr)).toBeNull(),
  );
});

describe('roll', () => {
  it('adds dice and modifiers', () => {
    rigDice(3, 5);
    const r = roll('2d6+3', 'Test')!;
    expect(r.total).toBe(11);
    expect(r.label).toBe('Test');
    expect(r.terms[0].rolls).toEqual([3, 5]);
  });

  it('subtracts negative terms', () => {
    rigDice(4, 2);
    expect(roll('1d8 - 1d4 - 1')!.total).toBe(1);
  });

  it('keeps the highest dice for 4d6kh3', () => {
    rigDice(1, 6, 4, 3);
    const r = roll('4d6kh3')!;
    expect(r.total).toBe(13);
    expect(r.terms[0].kept).toEqual([false, true, true, true]);
  });

  it('keeps the lowest die for disadvantage', () => {
    rigDice(17, 4);
    const r = roll('2d20kl1+2')!;
    expect(r.total).toBe(6);
    expect(r.natural).toBe(4);
  });

  it('reports natural 20s and 1s on a single d20', () => {
    rigDice(20);
    expect(roll('1d20+5')!.natural).toBe(20);
    rigDice(1);
    expect(roll('1d20+5')!.natural).toBe(1);
  });

  it('has no natural value when several d20s are kept', () => {
    rigDice(10, 12);
    expect(roll('2d20')!.natural).toBeUndefined();
  });

  it('returns null for invalid expressions', () => {
    expect(roll('nope')).toBeNull();
  });

  it('always stays within the possible range (real randomness)', () => {
    for (let i = 0; i < 500; i++) {
      const t = roll('3d6')!.total;
      expect(t).toBeGreaterThanOrEqual(3);
      expect(t).toBeLessThanOrEqual(18);
    }
  });
});

describe('applyRollMode', () => {
  it('turns a leading d20 into 2d20 keep-highest/lowest', () => {
    expect(applyRollMode('1d20+5', 'advantage')).toBe('2d20kh1+5');
    expect(applyRollMode('d20', 'disadvantage')).toBe('2d20kl1');
    expect(applyRollMode('1d20+5', 'normal')).toBe('1d20+5');
  });

  it('leaves other dice alone', () => {
    expect(applyRollMode('2d6+3', 'advantage')).toBe('2d6+3');
    expect(applyRollMode('10d20', 'advantage')).toBe('10d20');
    expect(applyRollMode('1d200', 'advantage')).toBe('1d200');
  });
});

describe('formatExpression', () => {
  it('writes expressions back out in a readable form', () => {
    expect(formatExpression(parseDice('2d6+1d4-1')!)).toBe('2d6 + 1d4 - 1');
  });
});
