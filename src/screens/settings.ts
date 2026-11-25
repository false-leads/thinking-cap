import { clearSeen } from '../history';
import { BUILT_IN } from '../decks';
import { loadCustomDecks } from '../customDecks';
import { h, toast } from '../dom';
import { canVibrate, isNative, requestMotionAccess } from '../platform';
import { goBack, type Screen } from '../router';
import { getSettings, ROUND_LENGTHS, TRIGGER_DEGREES, updateSettings, type Sensitivity, type Settings } from '../settings';
import { listenMotion, optionsFor, TiltDetector } from '../tilt';
import { REPO_URL } from './home';

type Choice<T> = { value: T; label: string };

export function settingsScreen(): Screen {
  let stopTest = () => {};

  function segmented<K extends keyof Settings>(key: K, choices: Choice<Settings[K]>[]) {
    const buttons = choices.map((c) =>
      h('button', { class: 'chip', onclick: () => { updateSettings({ [key]: c.value } as Partial<Settings>); sync(); } }, c.label),
    );
    const sync = () => choices.forEach((c, i) => buttons[i].setAttribute('aria-pressed', String(getSettings()[key] === c.value)));
    sync();
    return h('div', { class: 'chips' }, ...buttons);
  }

  function toggle(key: 'sound' | 'vibrate' | 'tapControls') {
    const input = h('input', { type: 'checkbox', class: 'switch' });
    input.checked = getSettings()[key];
    input.addEventListener('change', () => updateSettings({ [key]: input.checked }));
    return input;
  }

  const row = (label: string, help: string | null, control: HTMLElement) =>
    h('label', { class: 'setting' }, h('div', null, h('div', { class: 'setting-label' }, label), help ? h('div', { class: 'small' }, help) : null), control);

  // --- live tilt tester --------------------------------------------------------
  const angleEl = h('div', { class: 'tilt-angle' }, '–');
  const needle = h('div', { class: 'tilt-needle' });
  const lastEl = h('div', { class: 'tilt-last' }, 'Tap "Test tilt", hold the phone sideways to your forehead, then tilt.');
  const testBtn = h('button', { class: 'btn' }, 'Test tilt');
  testBtn.addEventListener('click', () => {
    void requestMotionAccess().then((access) => {
      if (access === 'unsupported') {
        lastEl.textContent = 'This browser has no motion sensor support.';
        return;
      }
      stopTest();
      const s = getSettings();
      const det = new TiltDetector(optionsFor(TRIGGER_DEGREES[s.sensitivity]));
      det.sign = s.motionSign;
      let got = false;
      const timer = window.setTimeout(() => {
        if (got) return;
        lastEl.textContent =
          access === 'denied'
            ? 'Motion access was blocked. On iPhone, close and reopen Safari to be asked again.'
            : 'No readings yet. This device may not have a motion sensor.';
      }, 2000);
      const stop = listenMotion((x, y, z, t) => {
        got = true;
        const tilt = det.sample(x, y, z, t);
        angleEl.textContent = `${Math.round(det.pitch)}°`;
        needle.style.transform = `rotate(${-Math.max(-90, Math.min(90, det.pitch))}deg)`;
        if (tilt) {
          const upMeans = getSettings().swapTilt ? 'Pass' : 'Got it';
          const downMeans = upMeans === 'Got it' ? 'Pass' : 'Got it';
          lastEl.textContent = tilt === 'up' ? `UP → ${upMeans}` : `DOWN → ${downMeans}`;
        }
      });
      stopTest = () => {
        stop();
        clearTimeout(timer);
      };
      testBtn.textContent = 'Testing…';
      lastEl.textContent = 'Upright should read about 0°. Tilt up or down past the line.';
    });
  });

  const el = h(
    'div',
    { class: 'screen settings' },
    h('header', { class: 'topbar' }, h('button', { class: 'text-btn', onclick: () => goBack() }, '‹ Back'), h('h1', { class: 'topbar-title' }, 'Settings')),
    h(
      'div',
      { class: 'settings-body' },
      row('Round length', null, segmented('roundSeconds', ROUND_LENGTHS.map((s) => ({ value: s, label: s < 60 || s % 60 ? `${s}s` : `${s / 60} min` })))),
      row(
        'Tilt up means',
        'Pick whichever your family finds natural.',
        segmented('swapTilt', [
          { value: false, label: 'Got it' },
          { value: true, label: 'Pass' },
        ]),
      ),
      row(
        'Tilt sensitivity',
        'High needs a smaller tilt. Lower it if words get skipped by accident.',
        segmented('sensitivity', (['low', 'medium', 'high'] as Sensitivity[]).map((v) => ({ value: v, label: `${v[0].toUpperCase()}${v.slice(1)} (${TRIGGER_DEGREES[v]}°)` }))),
      ),
      row('Use buttons instead of tilting', 'Shows Got it / Pass buttons for someone else to tap.', toggle('tapControls')),
      row('Sound', null, toggle('sound')),
      canVibrate ? row('Vibration', null, toggle('vibrate')) : null,
      h(
        'div',
        { class: 'setting tilt-test' },
        h('div', null, h('div', { class: 'setting-label' }, 'Tilt tester'), lastEl),
        h('div', { class: 'tilt-gauge' }, h('div', { class: 'tilt-zone' }), needle, angleEl),
        testBtn,
      ),
      h(
        'div',
        { class: 'setting' },
        h('div', null, h('div', { class: 'setting-label' }, 'Word history'), h('div', { class: 'small' }, 'Words don’t repeat until a category runs low.')),
        h(
          'button',
          {
            class: 'btn',
            onclick: () => {
              clearSeen([...BUILT_IN, ...loadCustomDecks()].map((d) => d.id));
              toast('Word history cleared');
            },
          },
          'Forget seen words',
        ),
      ),
      h(
        'p',
        { class: 'small about' },
        `Thinking Cap ${__APP_VERSION__}${isNative ? ' (Android)' : ''}. Free and open source. `,
        h('a', { href: REPO_URL, target: '_blank', rel: 'noopener' }, 'Source code, word lists and issues on GitHub'),
        '.',
      ),
    ),
  );

  return {
    el,
    leave() {
      stopTest();
    },
  };
}
