import { describe, expect, it } from 'vitest';
import { deckToText, parseDeckText, parseImport, wordCount } from '../src/customDecks';

describe('parseDeckText', () => {
  it('reads plain lists as medium', () => {
    expect(parseDeckText('Pikachu\n\n  Mario  \nKirby')).toEqual({ easy: [], medium: ['Pikachu', 'Mario', 'Kirby'], hard: [] });
  });

  it('reads difficulty headers, skips comments and duplicates', () => {
    const words = parseDeckText('# my deck\n# Easy\nCat\ncat\nDog\n## hard\nAxolotl\nMedium:\nOwl');
    expect(words).toEqual({ easy: ['Cat', 'Dog'], medium: ['Owl'], hard: ['Axolotl'] });
  });

  it('round-trips through the editor text', () => {
    const words = { easy: ['A'], medium: ['B', 'C'], hard: [] };
    expect(parseDeckText(deckToText({ words }))).toEqual(words);
    expect(deckToText({ words: { easy: [], medium: ['X', 'Y'], hard: [] } })).toBe('X\nY');
  });
});

describe('parseImport', () => {
  it('imports a text file named after the file', () => {
    const [d] = parseImport('pokemon_names.txt', 'Pikachu\nEevee');
    expect(d.name).toBe('Pokemon Names');
    expect(d.custom).toBe(true);
    expect(d.id).toMatch(/^custom-/);
    expect(d.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(wordCount(d)).toBe(2);
  });

  it('imports a JSON deck in the built-in format', () => {
    const json = JSON.stringify({ name: 'Dinos', emoji: '🦕', words: { easy: ['T-Rex'], hard: ['Ankylosaurus'] } });
    const [d] = parseImport('x.json', json);
    expect(d).toMatchObject({ name: 'Dinos', emoji: '🦕', words: { easy: ['T-Rex'], medium: [], hard: ['Ankylosaurus'] } });
  });

  it('imports an array of decks with plain word lists', () => {
    const decks = parseImport('pack.json', JSON.stringify([{ name: 'A', words: ['x', 'y'] }, { words: ['z'] }]));
    expect(decks.map((d) => d.name)).toEqual(['A', 'Pack 2']);
    expect(decks[0].words.medium).toEqual(['x', 'y']);
    expect(new Set(decks.map((d) => d.id)).size).toBe(2);
  });

  it('explains what went wrong', () => {
    expect(() => parseImport('empty.txt', '\n\n')).toThrow(/No words/);
    expect(() => parseImport('bad.json', '{"name": "x",')).toThrow(/couldn't be read/);
  });
});
