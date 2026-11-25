import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import './style.css';
import { isNative } from './platform';
import { registerScreen, startRouter } from './router';
import { editorScreen } from './screens/editor';
import { helpScreen } from './screens/help';
import { homeScreen } from './screens/home';
import { playScreen } from './screens/play';
import { readyScreen } from './screens/ready';
import { resultsScreen } from './screens/results';
import { settingsScreen } from './screens/settings';

registerScreen('home', homeScreen);
registerScreen('ready', readyScreen);
registerScreen('play', playScreen);
registerScreen('results', resultsScreen);
registerScreen('settings', settingsScreen);
registerScreen('editor', editorScreen);
registerScreen('help', helpScreen);

// ?deck=animals opens straight onto that category (handy for sharing links)
const deckParam = new URLSearchParams(location.search).get('deck');
startRouter(document.getElementById('app')!, deckParam ? { name: 'ready', params: { deckId: deckParam } } : { name: 'home', params: {} });

if (!isNative && import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
