import { deckToText, deleteCustomDeck, emptyWords, loadCustomDecks, newDeckId, nextCustomColor, parseDeckText, saveCustomDeck, wordCount } from '../customDecks';
import { h, toast } from '../dom';
import { goBack, type Params, type Screen } from '../router';
import type { Deck } from '../types';

export function editorScreen(params: Params): Screen {
  const existing = loadCustomDecks().find((d) => d.id === params.deckId);
  const deck: Deck = existing ?? { id: newDeckId(), name: '', emoji: '📝', color: nextCustomColor(), words: emptyWords(), custom: true };

  const emojiInput = h('input', { class: 'emoji-input', value: deck.emoji, maxlength: '4', 'aria-label': 'Emoji' });
  const nameInput = h('input', { class: 'name-input', value: deck.name, placeholder: 'Deck name, e.g. Pokémon', maxlength: '40' });
  const textArea = h('textarea', {
    class: 'words-input',
    spellcheck: 'false',
    placeholder: 'One word or phrase per line.\n\nOptional: put "# easy", "# medium" or "# hard" on its own line and the words below it get that difficulty.',
  });
  textArea.value = deckToText(deck);
  const countEl = h('span', { class: 'small' });
  const updateCount = () => {
    const n = wordCount({ words: parseDeckText(textArea.value) });
    countEl.textContent = `${n} word${n === 1 ? '' : 's'}`;
  };
  textArea.addEventListener('input', updateCount);
  updateCount();

  function save() {
    const name = nameInput.value.trim();
    const words = parseDeckText(textArea.value);
    if (!name) return toast('Give the deck a name');
    if (wordCount({ words }) === 0) return toast('Add at least one word');
    saveCustomDeck({ ...deck, name, emoji: emojiInput.value.trim() || '📝', words });
    toast('Saved');
    goBack();
  }

  function remove() {
    if (!confirm(`Delete "${deck.name}"? This can't be undone.`)) return;
    deleteCustomDeck(deck.id);
    goBack();
  }

  const el = h(
    'div',
    { class: 'screen editor' },
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'text-btn', onclick: () => goBack() }, '‹ Cancel'),
      h('h1', { class: 'topbar-title' }, existing ? 'Edit deck' : 'New deck'),
      h('button', { class: 'btn primary small-btn', onclick: save }, 'Save'),
    ),
    h('div', { class: 'editor-row' }, emojiInput, nameInput),
    textArea,
    h(
      'div',
      { class: 'editor-row editor-foot' },
      countEl,
      existing ? h('button', { class: 'text-btn danger', onclick: remove }, 'Delete deck') : null,
    ),
    h('p', { class: 'small' }, 'Decks you make are saved on this device only. To share one, put the words in a .txt file and use Import on the other phone.'),
  );
  return { el };
}
