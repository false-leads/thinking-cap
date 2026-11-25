// Remembers which words each deck has shown, so the next round (or the next
// game night) doesn't repeat them until the deck runs low.
import { cardKey } from './picker';
import { load, save } from './storage';
import type { Card } from './types';

type Seen = Record<string, string[]>; // deckId -> words shown

const read = () => load<Seen>('seen', {});

export function seenFor(deckIds: readonly string[]): Set<string> {
  const all = read();
  return new Set(deckIds.flatMap((id) => (all[id] ?? []).map((text) => cardKey({ deckId: id, text, level: 'easy' }))));
}

export function markSeen(cards: readonly Card[]): void {
  if (cards.length === 0) return;
  const all = read();
  for (const c of cards) {
    const list = (all[c.deckId] ??= []);
    if (!list.includes(c.text)) list.push(c.text);
  }
  save('seen', all);
}

export function clearSeen(deckIds: readonly string[]): void {
  const all = read();
  for (const id of deckIds) delete all[id];
  save('seen', all);
}
