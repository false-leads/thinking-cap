import { h } from '../dom';
import { goBack, type Screen } from '../router';
import { getSettings } from '../settings';

export function helpScreen(): Screen {
  const upCorrect = !getSettings().swapTilt;
  const el = h(
    'div',
    { class: 'screen help' },
    h('header', { class: 'topbar' }, h('button', { class: 'text-btn', onclick: () => goBack() }, '‹ Back'), h('h1', { class: 'topbar-title' }, 'How to play')),
    h(
      'ol',
      { class: 'help-steps' },
      h('li', null, h('strong', null, 'Pick a category'), ' and how hard the words should be.'),
      h('li', null, h('strong', null, 'The guesser holds the phone to their forehead'), ', sideways, screen facing out. Don’t peek!'),
      h('li', null, h('strong', null, 'Everyone else describes the word'), ' without saying it. In Act It Out you mime, and in Sing It you hum.'),
      h('li', null, h('strong', null, upCorrect ? 'Tilt UP when you get it' : 'Tilt DOWN when you get it'), '. ', h('strong', null, upCorrect ? 'Tilt DOWN to pass' : 'Tilt UP to pass'), '. Then bring the phone back upright for the next word.'),
      h('li', null, h('strong', null, 'When time runs out'), ', read the list together, then pass the phone to the next player.'),
    ),
    h(
      'div',
      { class: 'help-tips' },
      h('h2', null, 'Tips'),
      h('p', null, 'No tilt sensor (or playing on a laptop)? Turn on "Use buttons instead of tilting" in Settings, or use the ↑ and ↓ arrow keys.'),
      h('p', null, 'If tilts get missed or fire by accident, change the sensitivity in Settings. The tilt tester there shows what the phone sees.'),
      h('p', null, 'Make your own decks with "New deck", or import a .txt file with one word per line.'),
    ),
  );
  return { el };
}
