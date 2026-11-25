#!/usr/bin/env node
// Lints every built-in deck in src/decks/*.json.
//
//   node scripts/check-decks.mjs           -> errors only (exit 1 if any)
//   node scripts/check-decks.mjs --stats   -> also prints word counts per deck
//
// Also imported by tests/decks.test.ts so CI fails on a bad deck.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DECK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'decks');
export const LEVELS = ['easy', 'medium', 'hard'];
/** Floors, not targets. Some decks (US States) are naturally small. */
export const MIN_PER_LEVEL = { easy: 12, medium: 12, hard: 8 };
export const MAX_WORD_LENGTH = 40;
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Contrast ratio of white text on `hex` (WCAG relative luminance). */
export function whiteContrast(hex) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (lum + 0.05);
}

/** Returns a list of human-readable problems with one deck (empty = OK). */
export function validateDeck(deck, file) {
  const errs = [];
  const where = file ?? deck?.id ?? '?';
  const err = (m) => errs.push(`${where}: ${m}`);
  if (typeof deck !== 'object' || deck === null) return [`${where}: not a JSON object`];

  if (typeof deck.id !== 'string' || !ID_RE.test(deck.id)) err('id must be kebab-case');
  if (file && deck.id !== basename(file, '.json')) err(`id "${deck.id}" must match the file name`);
  if (typeof deck.name !== 'string' || !deck.name.trim()) err('name is required');
  if (typeof deck.emoji !== 'string' || !deck.emoji.trim()) err('emoji is required');
  if (typeof deck.color !== 'string' || !COLOR_RE.test(deck.color)) err('color must be #rrggbb');
  else if (whiteContrast(deck.color) < 3) err(`color ${deck.color} is too light for white text`);
  if (deck.hint !== undefined && typeof deck.hint !== 'string') err('hint must be a string');
  const known = new Set(['id', 'name', 'emoji', 'color', 'blurb', 'hint', 'words']);
  for (const k of Object.keys(deck)) if (!known.has(k)) err(`unknown field "${k}"`);

  if (typeof deck.words !== 'object' || deck.words === null) return [...errs, `${where}: words is required`];
  for (const k of Object.keys(deck.words)) if (!LEVELS.includes(k)) err(`unknown difficulty "${k}"`);

  const seen = new Map();
  for (const level of LEVELS) {
    const list = deck.words[level];
    if (!Array.isArray(list)) { err(`words.${level} must be an array`); continue; }
    if (list.length < MIN_PER_LEVEL[level]) err(`words.${level} has ${list.length} words, need at least ${MIN_PER_LEVEL[level]}`);
    for (const w of list) {
      if (typeof w !== 'string') { err(`non-string word in ${level}: ${JSON.stringify(w)}`); continue; }
      if (w !== w.trim() || /\s{2,}/.test(w)) err(`stray whitespace: "${w}"`);
      if (!w.trim()) err(`empty word in ${level}`);
      if (w.length > MAX_WORD_LENGTH) err(`too long (${w.length} > ${MAX_WORD_LENGTH}): "${w}"`);
      const key = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) err(`duplicate "${w}" (${seen.get(key)} and ${level})`);
      else seen.set(key, level);
    }
  }
  return errs;
}

export function loadDeckFiles() {
  return readdirSync(DECK_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, deck: JSON.parse(readFileSync(join(DECK_DIR, f), 'utf8')) }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let files;
  try {
    files = loadDeckFiles();
  } catch (e) {
    console.error(`Could not read decks: ${e.message}`);
    process.exit(1);
  }
  const errors = files.flatMap(({ file, deck }) => validateDeck(deck, file));
  if (process.argv.includes('--stats')) {
    let total = 0;
    for (const { file, deck } of files) {
      const c = LEVELS.map((l) => deck.words?.[l]?.length ?? 0);
      total += c.reduce((a, b) => a + b, 0);
      console.log(`${file.padEnd(24)} easy ${String(c[0]).padStart(3)}  medium ${String(c[1]).padStart(3)}  hard ${String(c[2]).padStart(3)}`);
    }
    console.log(`${files.length} decks, ${total} words`);
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log('All decks OK');
}
