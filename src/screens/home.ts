import { addCustomDecks, loadCustomDecks, parseImport, wordCount } from '../customDecks';
import { BUILT_IN, MIX_DECK } from '../decks';
import { h, toast } from '../dom';
import { exitGameMode, keepAwake } from '../platform';
import { navigate, type Screen } from '../router';
import type { Deck } from '../types';

export const REPO_URL = 'https://github.com/false-leads/thinking-cap';

export function homeScreen(): Screen {
  const custom = loadCustomDecks();
  const totalWords = BUILT_IN.reduce((n, d) => n + wordCount(d), 0);

  const fileInput = h('input', {
    type: 'file',
    accept: '.txt,.json,.csv,text/plain,application/json',
    multiple: true,
    hidden: true,
  });
  fileInput.addEventListener('change', async () => {
    const files = [...(fileInput.files ?? [])];
    fileInput.value = '';
    let added = 0;
    for (const file of files) {
      try {
        const decks = parseImport(file.name, await file.text(), loadCustomDecks());
        addCustomDecks(decks);
        added += decks.length;
      } catch (e) {
        toast((e as Error).message, 5000);
      }
    }
    if (added) {
      toast(`Added ${added} deck${added === 1 ? '' : 's'}`);
      navigate('home', {}, { replace: true });
    }
  });

  const card = (deck: Deck, count: number) =>
    h(
      'button',
      { class: 'deck-card', style: `--c:${deck.color}`, onclick: () => navigate('ready', { deckId: deck.id }) },
      h('span', { class: 'deck-emoji', 'aria-hidden': 'true' }, deck.emoji),
      h('span', { class: 'deck-name' }, deck.name),
      h('span', { class: 'deck-count' }, `${count} words`),
    );

  const el = h(
    'div',
    { class: 'screen home' },
    h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'brand' }, h('span', { class: 'brand-logo', 'aria-hidden': 'true' }, '🧢'), 'Thinking Cap'),
      h(
        'div',
        { class: 'topbar-actions' },
        h('button', { class: 'icon-btn', 'aria-label': 'How to play', onclick: () => navigate('help') }, '?'),
        h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: () => navigate('settings') }, '⚙'),
      ),
    ),
    h('h2', null, 'Pick a category'),
    h('div', { class: 'deck-grid' }, card(MIX_DECK, totalWords), ...BUILT_IN.map((d) => card(d, wordCount(d)))),
    h('h2', null, 'My decks'),
    h(
      'div',
      { class: 'deck-grid' },
      ...custom.map((d) => card(d, wordCount(d))),
      h(
        'button',
        { class: 'deck-card ghost', onclick: () => navigate('editor', { deckId: 'new' }) },
        h('span', { class: 'deck-emoji', 'aria-hidden': 'true' }, '＋'),
        h('span', { class: 'deck-name' }, 'New deck'),
        h('span', { class: 'deck-count' }, 'Type your own words'),
      ),
      h(
        'button',
        { class: 'deck-card ghost', onclick: () => fileInput.click() },
        h('span', { class: 'deck-emoji', 'aria-hidden': 'true' }, '📂'),
        h('span', { class: 'deck-name' }, 'Import file'),
        h('span', { class: 'deck-count' }, '.txt or .json'),
      ),
    ),
    fileInput,
    h(
      'footer',
      { class: 'footer' },
      'Free and open source, no ads, no premium decks. ',
      h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'Source on GitHub'),
    ),
  );

  return {
    el,
    enter() {
      void exitGameMode();
      void keepAwake(false);
    },
  };
}
