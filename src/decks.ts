// All the decks the app knows about: the built-in ones (src/decks/*.json),
// the ones made on this device, and the "Everything" mix.
import { loadCustomDecks } from './customDecks';
import type { Deck } from './types';

const files = import.meta.glob<Deck>('./decks/*.json', { eager: true, import: 'default' });

/** Home-screen order. Decks not listed here go at the end, alphabetically. */
const ORDER = [
  'superheroes', 'animals', 'food', 'disney', 'cartoons', 'kids-movies',
  'countries', 'us-states', 'landmarks',
  'act-it-out', 'sing-it', 'video-games', 'storybook', 'fairy-tales',
  'toys-games', 'holidays', 'sports', 'jobs', 'around-the-house', 'vehicles',
];

const rank = (id: string) => {
  const i = ORDER.indexOf(id);
  return i < 0 ? ORDER.length : i;
};

export const BUILT_IN: readonly Deck[] = Object.values(files).sort(
  (a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name),
);

export const MIX_ID = 'everything';

export const MIX_DECK: Deck = {
  id: MIX_ID,
  name: 'Everything',
  emoji: '🎲',
  color: '#4338ca',
  blurb: 'A bit of every category',
  words: { easy: [], medium: [], hard: [] },
};

export function getDeck(id: string): Deck | undefined {
  if (id === MIX_ID) return MIX_DECK;
  return BUILT_IN.find((d) => d.id === id) ?? loadCustomDecks().find((d) => d.id === id);
}

/** The decks whose words a round on `id` draws from. */
export function sourceDecks(id: string): Deck[] {
  if (id === MIX_ID) return [...BUILT_IN];
  const d = getDeck(id);
  return d ? [d] : [];
}

