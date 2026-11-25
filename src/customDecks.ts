// Decks made in the app or imported from a file. They live only on this
// device (localStorage), which is also the place for anything you'd rather
// not publish in the open-source repo.
//
// Text format (also what the deck editor shows):
//
//     # easy
//     Pikachu
//     Mario
//     # hard
//     Kirby
//
// The "# easy / # medium / # hard" headers are optional; words before any
// header count as medium. Other lines starting with # are comments.
//
// JSON files can hold one deck or an array of decks, in the same format as
// the built-in decks (src/decks/*.json). "words" may also be a plain array.
import { load, save } from './storage';
import { LEVELS, type Deck, type Level } from './types';

const KEY = 'custom-decks';
const MAX_WORD = 60;

/** Background colors handed out to new custom decks (all readable with white text). */
const PALETTE = ['#0f766e', '#7c3aed', '#be185d', '#1d4ed8', '#b45309', '#15803d', '#9333ea', '#b91c1c'];

export function emptyWords(): Record<Level, string[]> {
  return { easy: [], medium: [], hard: [] };
}

export function wordCount(deck: Pick<Deck, 'words'>): number {
  return LEVELS.reduce((n, l) => n + (deck.words[l]?.length ?? 0), 0);
}

export function parseDeckText(text: string): Record<Level, string[]> {
  const words = emptyWords();
  const seen = new Set<string>();
  let level: Level = 'medium';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = /^#+\s*(easy|medium|hard)\s*:?\s*$/i.exec(line) ?? /^(easy|medium|hard)\s*:$/i.exec(line);
    if (header) {
      level = header[1].toLowerCase() as Level;
      continue;
    }
    if (line.startsWith('#')) continue;
    addWord(words, seen, level, line);
  }
  return words;
}

function addWord(words: Record<Level, string[]>, seen: Set<string>, level: Level, word: unknown): void {
  if (typeof word !== 'string') return;
  const w = word.trim().replace(/\s+/g, ' ').slice(0, MAX_WORD);
  const key = w.toLowerCase();
  if (!w || seen.has(key)) return;
  seen.add(key);
  words[level].push(w);
}

/** The editor's text for a deck: plain list if it only has medium words, otherwise with headers. */
export function deckToText(deck: Pick<Deck, 'words'>): string {
  const used = LEVELS.filter((l) => deck.words[l]?.length);
  if (used.length === 0) return '';
  if (used.length === 1 && used[0] === 'medium') return deck.words.medium.join('\n');
  return used.map((l) => `# ${l}\n${deck.words[l].join('\n')}`).join('\n\n');
}

export function newDeckId(): string {
  return `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function pickColor(existing: readonly Deck[]): string {
  return PALETTE[existing.length % PALETTE.length];
}

/** Turn an imported file into decks. Throws an Error with a friendly message if nothing usable is found. */
export function parseImport(fileName: string, content: string, existing: readonly Deck[] = []): Deck[] {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Imported deck';
  const trimmed = content.trim();
  let decks: Deck[];
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error(`${fileName} looks like JSON but couldn't be read. Check for a missing comma or quote.`);
    }
    const items = Array.isArray(data) ? data : [data];
    decks = items.map((item, i) => deckFromJson(item, items.length > 1 ? `${baseName} ${i + 1}` : baseName));
  } else {
    decks = [{ id: '', name: titleCase(baseName), emoji: '📝', color: '', words: parseDeckText(content), custom: true }];
  }
  decks = decks.filter((d) => wordCount(d) > 0);
  if (decks.length === 0) throw new Error(`No words found in ${fileName}. Put one word per line.`);
  const all = [...existing];
  for (const d of decks) {
    d.id = newDeckId();
    d.color ||= pickColor(all);
    all.push(d);
  }
  return decks;
}

function deckFromJson(item: unknown, fallbackName: string): Deck {
  const o = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
  const words = emptyWords();
  const seen = new Set<string>();
  if (Array.isArray(o.words)) {
    for (const w of o.words) addWord(words, seen, 'medium', w);
  } else if (typeof o.words === 'object' && o.words !== null) {
    const byLevel = o.words as Record<string, unknown>;
    for (const l of LEVELS) if (Array.isArray(byLevel[l])) for (const w of byLevel[l] as unknown[]) addWord(words, seen, l, w);
  }
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const color = str(o.color);
  return {
    id: '',
    name: str(o.name) ?? titleCase(fallbackName),
    emoji: str(o.emoji) ?? '📝',
    color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : '',
    blurb: str(o.blurb),
    hint: str(o.hint),
    words,
    custom: true,
  };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- storage ---------------------------------------------------------------

export function loadCustomDecks(): Deck[] {
  const decks = load<Deck[]>(KEY, []);
  return Array.isArray(decks) ? decks.filter((d) => d && typeof d.id === 'string' && d.words) : [];
}

export function saveCustomDeck(deck: Deck): void {
  const decks = loadCustomDecks();
  const i = decks.findIndex((d) => d.id === deck.id);
  if (i >= 0) decks[i] = deck;
  else decks.push(deck);
  save(KEY, decks);
}

export function addCustomDecks(newDecks: readonly Deck[]): void {
  save(KEY, [...loadCustomDecks(), ...newDecks]);
}

export function deleteCustomDeck(id: string): void {
  save(KEY, loadCustomDecks().filter((d) => d.id !== id));
}

export function nextCustomColor(): string {
  return pickColor(loadCustomDecks());
}
