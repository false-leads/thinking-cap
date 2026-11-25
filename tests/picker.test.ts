import { describe, expect, it } from 'vitest';
import { buildPool, buildQueue, cardKey, MIN_FRESH, MIN_POOL, shuffle } from '../src/picker';
import type { Deck } from '../src/types';

const deck = (id: string, easy: number, medium: number, hard: number): Deck => ({
  id,
  name: id,
  emoji: '?',
  color: '#000000',
  words: {
    easy: Array.from({ length: easy }, (_, i) => `${id}-e${i}`),
    medium: Array.from({ length: medium }, (_, i) => `${id}-m${i}`),
    hard: Array.from({ length: hard }, (_, i) => `${id}-h${i}`),
  },
});

/** Deterministic RNG for repeatable shuffles. */
function rng(seed = 1) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('buildPool', () => {
  it('uses only the chosen levels', () => {
    const pool = buildPool([deck('a', 20, 20, 20)], ['easy', 'hard']);
    expect(pool).toHaveLength(40);
    expect(pool.every((c) => c.level !== 'medium')).toBe(true);
  });

  it('falls back to every level when the chosen ones are too small', () => {
    const pool = buildPool([deck('a', 5, 30, 5)], ['easy']);
    expect(5).toBeLessThan(MIN_POOL);
    expect(pool).toHaveLength(40);
  });

  it('merges several decks and remembers where each word came from', () => {
    const pool = buildPool([deck('a', 10, 0, 0), deck('b', 10, 0, 0)], ['easy']);
    expect(new Set(pool.map((c) => c.deckId))).toEqual(new Set(['a', 'b']));
  });
});

describe('shuffle', () => {
  it('keeps every item and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, rng(7));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('buildQueue', () => {
  const pool = buildPool([deck('a', 30, 30, 0)], ['easy', 'medium']);

  it('puts unseen words first', () => {
    const seen = new Set(pool.slice(0, 20).map(cardKey));
    const { queue, reset } = buildQueue(pool, seen, rng(3));
    expect(reset).toBe(false);
    expect(queue).toHaveLength(60);
    expect(queue.slice(0, 40).every((c) => !seen.has(cardKey(c)))).toBe(true);
  });

  it('starts over when the deck runs low on unseen words', () => {
    const seen = new Set(pool.slice(0, 60 - MIN_FRESH + 1).map(cardKey));
    const { queue, reset } = buildQueue(pool, seen, rng(3));
    expect(reset).toBe(true);
    expect(queue).toHaveLength(60);
  });

  it('copes with a tiny deck', () => {
    const tiny = buildPool([deck('t', 3, 0, 0)], ['easy']);
    expect(buildQueue(tiny, new Set(), rng()).queue).toHaveLength(3);
  });
});
