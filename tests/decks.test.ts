import { describe, expect, it } from 'vitest';
import { loadDeckFiles, validateDeck } from '../scripts/check-decks.mjs';
import { BUILT_IN } from '../src/decks';

describe('built-in decks', () => {
  const files = loadDeckFiles();

  it('all pass the deck checker', () => {
    expect(files.flatMap(({ file, deck }) => validateDeck(deck, file))).toEqual([]);
  });

  it('are all loaded by the app', () => {
    expect(BUILT_IN.map((d) => d.id).sort()).toEqual(files.map(({ file }) => file.replace('.json', '')).sort());
  });
});

describe('validateDeck', () => {
  const good = {
    id: 'x',
    name: 'X',
    emoji: '❌',
    color: '#123456',
    words: {
      easy: Array.from({ length: 12 }, (_, i) => `e${i}`),
      medium: Array.from({ length: 12 }, (_, i) => `m${i}`),
      hard: Array.from({ length: 8 }, (_, i) => `h${i}`),
    },
  };

  it('accepts a good deck', () => {
    expect(validateDeck(good, 'x.json')).toEqual([]);
  });

  it('catches duplicates across levels, pale colors and bad ids', () => {
    const bad = { ...good, id: 'Bad Id', color: '#ffff99', words: { ...good.words, hard: [...good.words.hard, 'E-0'] } };
    const errs = validateDeck(bad, 'x.json').join('\n');
    expect(errs).toMatch(/kebab-case/);
    expect(errs).toMatch(/too light/);
    expect(errs).toMatch(/duplicate "E-0"/);
  });
});
