import { getDeck } from '../decks';
import { h } from '../dom';
import { getLastRound, startRound } from '../round';
import { goBack, navigate, type Params, type Screen } from '../router';

export function resultsScreen(params: Params): Screen {
  const round = getLastRound();
  const deck = getDeck(params.deckId);
  if (!round || !deck) {
    queueMicrotask(() => navigate('home', {}, { replace: true }));
    return { el: h('div') };
  }
  const correct = round.cards.filter((c) => c.outcome === 'correct').length;
  const passed = round.cards.length - correct;

  const el = h(
    'div',
    { class: 'screen results', style: `--c:${deck.color}` },
    h(
      'div',
      { class: 'results-head' },
      h('div', { class: 'results-score' }, String(correct)),
      h(
        'div',
        null,
        h('h1', null, correct === 1 ? 'word guessed' : 'words guessed'),
        h('p', null, `${deck.emoji} ${deck.name}${passed ? ` · ${passed} passed` : ''}`),
      ),
    ),
    round.cards.length
      ? h(
          'ol',
          { class: 'results-list' },
          ...round.cards.map(({ card, outcome }) =>
            h('li', { class: outcome }, h('span', { class: 'mark', 'aria-label': outcome === 'correct' ? 'got it' : 'passed' }, outcome === 'correct' ? '✓' : '✗'), card.text),
          ),
        )
      : h('p', { class: 'results-empty' }, 'No words this round. Tilt up or down to answer.'),
    h(
      'div',
      { class: 'btn-row results-actions' },
      h('button', { class: 'btn primary', onclick: () => startRound(deck.id) }, 'Next player'),
      h('button', { class: 'btn', onclick: () => goBack() }, 'Categories'),
    ),
  );
  return { el };
}
