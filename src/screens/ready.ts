import { wordCount } from '../customDecks';
import { getDeck, MIX_ID, sourceDecks } from '../decks';
import { h } from '../dom';
import { buildPool } from '../picker';
import { startRound } from '../round';
import { goBack, navigate, type Params, type Screen } from '../router';
import { getSettings, ROUND_LENGTHS, updateSettings } from '../settings';
import { LEVEL_LABELS, LEVELS } from '../types';

export function readyScreen(params: Params): Screen {
  const deck = getDeck(params.deckId);
  if (!deck) {
    queueMicrotask(() => navigate('home', {}, { replace: true }));
    return { el: h('div') };
  }
  const decks = sourceDecks(deck.id);
  const countAt = (level: (typeof LEVELS)[number]) => decks.reduce((n, d) => n + (d.words[level]?.length ?? 0), 0);
  const total = decks.reduce((n, d) => n + wordCount(d), 0);

  const poolNote = h('p', { class: 'small pool-note' });
  const levelChips = LEVELS.map((level) =>
    h(
      'button',
      { class: 'chip', 'aria-pressed': 'false', onclick: () => toggleLevel(level) },
      LEVEL_LABELS[level],
      h('span', { class: 'chip-count' }, String(countAt(level))),
    ),
  );
  const timeChips = ROUND_LENGTHS.map((s) =>
    h('button', { class: 'chip', 'aria-pressed': 'false', onclick: () => setTime(s) }, s < 60 ? `${s}s` : s % 60 ? `${s}s` : `${s / 60} min`),
  );

  function toggleLevel(level: (typeof LEVELS)[number]) {
    const cur = getSettings().levels;
    const next = cur.includes(level) ? cur.filter((l) => l !== level) : [...cur, level];
    if (next.length) updateSettings({ levels: next });
    refresh();
  }

  function setTime(s: number) {
    updateSettings({ roundSeconds: s });
    refresh();
  }

  function refresh() {
    const s = getSettings();
    LEVELS.forEach((l, i) => levelChips[i].setAttribute('aria-pressed', String(s.levels.includes(l))));
    ROUND_LENGTHS.forEach((t, i) => timeChips[i].setAttribute('aria-pressed', String(s.roundSeconds === t)));
    const pool = buildPool(decks, s.levels).length;
    const picked = s.levels.reduce((n, l) => n + countAt(l), 0);
    poolNote.textContent = pool > picked ? `Only ${picked} words at that level, so every level is in play.` : '';
  }
  refresh();

  const upMeansCorrect = !getSettings().swapTilt;
  const el = h(
    'div',
    { class: 'screen ready', style: `--c:${deck.color}` },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'text-btn', onclick: () => goBack() }, '‹ Back'),
      deck.custom ? h('button', { class: 'text-btn', onclick: () => navigate('editor', { deckId: deck.id }) }, 'Edit deck') : null,
    ),
    h(
      'div',
      { class: 'ready-body' },
      h(
        'div',
        { class: 'ready-title' },
        h('div', { class: 'ready-emoji', 'aria-hidden': 'true' }, deck.emoji),
        h('h1', null, deck.name),
        deck.blurb ? h('p', null, deck.blurb) : null,
        deck.hint ? h('p', { class: 'ready-hint' }, deck.hint) : null,
        h('p', { class: 'small' }, `${total} words${deck.id === MIX_ID ? ` from ${decks.length} categories` : ''}`),
      ),
      h(
        'div',
        { class: 'ready-options' },
        h('div', { class: 'opt' }, h('div', { class: 'opt-label' }, 'Words'), h('div', { class: 'chips' }, ...levelChips)),
        poolNote,
        h('div', { class: 'opt' }, h('div', { class: 'opt-label' }, 'Time'), h('div', { class: 'chips' }, ...timeChips)),
        h(
          'button',
          { class: 'btn primary start-btn', onclick: () => startRound(deck.id) },
          'Start',
        ),
        h(
          'p',
          { class: 'small tilt-legend' },
          `Tilt UP: ${upMeansCorrect ? 'got it' : 'pass'}. Tilt DOWN: ${upMeansCorrect ? 'pass' : 'got it'}.`,
        ),
      ),
    ),
  );
  return { el };
}
