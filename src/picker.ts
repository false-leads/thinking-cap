// Choosing which words come up. Pure functions, so they're unit-tested.
import { LEVELS, type Card, type Deck, type Level } from './types';

/** If the chosen difficulties leave fewer words than this, use every difficulty. */
export const MIN_POOL = 15;
/** Start a deck over once fewer than this many unseen words remain. */
export const MIN_FRESH = 25;

/** Every word from `decks` at the chosen difficulty levels. */
export function buildPool(decks: readonly Deck[], levels: readonly Level[]): Card[] {
  const pick = (lv: readonly Level[]) =>
    decks.flatMap((d) => lv.flatMap((level) => (d.words[level] ?? []).map((text) => ({ text, level, deckId: d.id }))));
  const pool = pick(levels);
  // Small decks (US States on Easy, a short custom deck) would repeat words
  // every round, so fall back to the whole deck.
  return pool.length >= MIN_POOL ? pool : pick(LEVELS);
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const cardKey = (c: Card): string => `${c.deckId}|${c.text}`;

/**
 * Order the words for a round: words not seen recently first (shuffled), then
 * already-seen ones as a backstop for very long rounds. When too few unseen
 * words are left, start over (`reset: true` tells the caller to clear history).
 */
export function buildQueue(
  pool: readonly Card[],
  seen: ReadonlySet<string>,
  rng: () => number = Math.random,
): { queue: Card[]; reset: boolean } {
  const fresh = pool.filter((c) => !seen.has(cardKey(c)));
  if (fresh.length < Math.min(MIN_FRESH, pool.length)) return { queue: shuffle(pool, rng), reset: true };
  const stale = pool.filter((c) => seen.has(cardKey(c)));
  return { queue: [...shuffle(fresh, rng), ...shuffle(stale, rng)], reset: false };
}
