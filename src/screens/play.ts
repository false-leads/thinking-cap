// The round itself: hold to forehead -> 3, 2, 1 -> words until time runs out.
import { sfx } from '../audio';
import { getDeck, MIX_ID, sourceDecks } from '../decks';
import { fitText, h } from '../dom';
import { clearSeen, markSeen, seenFor } from '../history';
import { buildPool, buildQueue, shuffle } from '../picker';
import { buzz } from '../platform';
import { setLastRound } from '../round';
import { goBack, navigate, type Params, type Screen } from '../router';
import { getSettings, TRIGGER_DEGREES, updateSettings } from '../settings';
import { guessSign, listenMotion, optionsFor, TiltDetector, type Tilt } from '../tilt';
import type { Card, Outcome } from '../types';

type Phase = 'position' | 'countdown' | 'playing' | 'paused' | 'over';

/** Phone must be upright on the forehead this long before the countdown starts. */
const HOLD_TO_START_MS = 700;
/** How long after Start we look at the readings to work out the z-axis sign. */
const SIGN_WINDOW_MS = 350;
/** If no motion readings arrive within this time, fall back to buttons. */
const NO_SENSOR_MS = 1500;
const FLASH_MIN_MS = 450;
const FLASH_MAX_MS = 1600;
const COUNTDOWN_STEP_MS = 800;

export function playScreen(params: Params): Screen {
  const deck = getDeck(params.deckId);
  if (!deck) {
    queueMicrotask(() => navigate('home', {}, { replace: true }));
    return { el: h('div') };
  }
  const settings = getSettings();
  const isMix = deck.id === MIX_ID;
  const decks = sourceDecks(deck.id);
  const deckIds = decks.map((d) => d.id);
  const pool = buildPool(decks, settings.levels);
  const built = buildQueue(pool, seenFor(deckIds));
  if (built.reset) clearSeen(deckIds);
  let queue = built.queue;
  let qi = -1;
  let card: Card | null = null;
  const shown: Card[] = [];
  const answers: { card: Card; outcome: Outcome }[] = [];

  // ?seconds=5 shortens rounds (handy for testing)
  const override = Number(new URLSearchParams(location.search).get('seconds'));
  const roundMs = (override > 0 ? override : settings.roundSeconds) * 1000;
  let remainingMs = roundMs;
  let lastTick = Math.ceil(roundMs / 1000);

  let phase: Phase = 'position';
  let leaving = false;
  // Go by whether readings actually arrive, not by the permission answer:
  // some browsers say "denied" and send readings anyway (or the reverse).
  let useMotion = !settings.tapControls && params.motion !== 'unsupported';
  let motionSeen = false;
  const startedAt = performance.now();
  const detector = new TiltDetector(optionsFor(TRIGGER_DEGREES[settings.sensitivity]));
  detector.sign = settings.motionSign;
  const signSamples: number[] = [];
  let signDecided = false;
  let uprightSince: number | null = null;
  let flash: { el: HTMLElement; at: number } | null = null;
  let raf = 0;
  let lastFrame = performance.now();
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

  const upMeans: Outcome = settings.swapTilt ? 'pass' : 'correct';
  const tiltOutcome = (t: Tilt): Outcome => (t === 'up' ? upMeans : upMeans === 'correct' ? 'pass' : 'correct');
  const legend = () =>
    h(
      'div',
      { class: 'legend' },
      h('span', { class: upMeans === 'correct' ? 'good' : 'meh' }, `Tilt UP: ${upMeans === 'correct' ? 'Got it ✓' : 'Pass'}`),
      h('span', { class: upMeans === 'correct' ? 'meh' : 'good' }, `Tilt DOWN: ${upMeans === 'correct' ? 'Pass' : 'Got it ✓'}`),
    );

  // --- DOM -------------------------------------------------------------------
  const scoreEl = h('div', { class: 'hud-score' }, '0');
  const timeEl = h('div', { class: 'hud-time' }, formatTime(roundMs));
  const barEl = h('div', { class: 'hud-bar-fill' });
  const pauseBtn = h('button', { class: 'hud-pause', 'aria-label': 'Pause', onclick: () => pause() }, '❚❚');
  const sourceEl = h('div', { class: 'card-source' });
  const wordEl = h('div', { class: 'card-word' });
  const hintEl = h('div', { class: 'card-hint' });
  const wordBox = h('div', { class: 'card-box' }, wordEl);
  const stage = h('div', { class: 'stage' }, sourceEl, wordBox, hintEl);
  const tapBar = h(
    'div',
    { class: 'tap-controls' },
    h('button', { class: 'tap-pass', onclick: () => answer('pass') }, '✗ Pass'),
    h('button', { class: 'tap-correct', onclick: () => answer('correct') }, '✓ Got it'),
  );
  const noSensorNote = h('p', { class: 'small' });
  const positionEl = h(
    'div',
    { class: 'overlay position', onclick: () => phase === 'position' && startCountdown() },
    h('div', { class: 'phone-icon', 'aria-hidden': 'true' }, h('span', null, '?')),
    h('h1', null, useMotion ? 'Hold it to your forehead' : 'Ready?'),
    h('p', null, useMotion ? 'Screen facing out, so everyone else can read it.' : 'Tap Got it or Pass for each word.'),
    useMotion ? legend() : null,
    noSensorNote,
    h('p', { class: 'small' }, useMotion ? 'Or tap anywhere to start' : 'Tap anywhere to start'),
  );
  const countEl = h('div', { class: 'overlay countdown', 'aria-live': 'assertive' });
  const pausedEl = h(
    'div',
    { class: 'overlay paused' },
    h('h1', null, 'Paused'),
    h(
      'div',
      { class: 'btn-row' },
      h('button', { class: 'btn primary', onclick: () => resume() }, 'Resume'),
      h('button', { class: 'btn', onclick: () => finish() }, 'End round'),
      h('button', { class: 'btn', onclick: () => quit() }, 'Quit'),
    ),
  );
  const rotateEl = h('div', { class: 'rotate-hint' }, h('div', { class: 'rotate-icon' }, '📱'), h('p', null, 'Turn your phone sideways'));

  const el = h(
    'div',
    { class: `screen play ${useMotion ? '' : 'tap-mode'}`, style: `--c:${deck.color}` },
    h('div', { class: 'hud' }, h('div', { class: 'hud-bar' }, barEl), scoreEl, pauseBtn, timeEl),
    stage,
    tapBar,
    positionEl,
    rotateEl,
  );

  // --- flow ------------------------------------------------------------------
  function show(overlay: HTMLElement | null) {
    for (const o of [positionEl, countEl, pausedEl]) if (o !== overlay) o.remove();
    if (overlay && !overlay.isConnected) el.append(overlay);
  }

  function startCountdown() {
    if (phase !== 'position') return;
    phase = 'countdown';
    show(countEl);
    let n = 3;
    const step = () => {
      if (phase !== 'countdown') return;
      if (n === 0) {
        sfx.go();
        startPlaying();
        return;
      }
      countEl.textContent = String(n);
      countEl.classList.remove('pop');
      void countEl.offsetWidth; // restart the animation
      countEl.classList.add('pop');
      sfx.countdown();
      n--;
      later(step, COUNTDOWN_STEP_MS);
    };
    step();
  }

  function startPlaying() {
    phase = 'playing';
    show(null);
    detector.disarm(); // must be upright before the first tilt counts
    lastFrame = performance.now();
    nextCard();
  }

  function nextCard() {
    qi++;
    if (qi >= queue.length) {
      queue = shuffle(pool); // very long round: go round again
      qi = 0;
    }
    card = queue[qi];
    shown.push(card);
    const source = isMix ? getDeck(card.deckId) : deck;
    sourceEl.textContent = isMix && source ? `${source.emoji} ${source.name}` : '';
    hintEl.textContent = source?.hint ?? '';
    wordEl.textContent = card.text;
    wordEl.classList.remove('enter');
    void wordEl.offsetWidth;
    wordEl.classList.add('enter');
    fitWord();
  }

  function fitWord() {
    fitText(wordEl, wordBox, Math.min(wordBox.clientHeight * 0.9, 260), 18);
  }

  function answer(outcome: Outcome) {
    if (phase !== 'playing' || flash || !card) return;
    answers.push({ card, outcome });
    scoreEl.textContent = String(answers.filter((a) => a.outcome === 'correct').length);
    if (outcome === 'correct') {
      sfx.correct();
      buzz(60);
    } else {
      sfx.pass();
      buzz([30, 40, 30]);
    }
    const f = h(
      'div',
      { class: `overlay flash ${outcome}` },
      h('div', { class: 'flash-label' }, outcome === 'correct' ? 'Got it!' : 'Pass'),
      h('div', { class: 'flash-word' }, card.text),
    );
    el.append(f);
    flash = { el: f, at: performance.now() };
  }

  function maybeEndFlash(now: number) {
    if (!flash) return;
    const age = now - flash.at;
    // Wait for the player to bring the phone back upright (so the next word
    // isn't shown to the floor or the ceiling) and for the next tilt to count.
    if (age >= FLASH_MAX_MS || (age >= FLASH_MIN_MS && (!useMotion || detector.isArmed))) {
      flash.el.remove();
      flash = null;
      if (phase === 'playing') nextCard();
    }
  }

  function frame(now: number) {
    const dt = Math.min(250, now - lastFrame);
    lastFrame = now;
    if (phase === 'playing') {
      remainingMs -= dt;
      const secs = Math.max(0, Math.ceil(remainingMs / 1000));
      timeEl.textContent = formatTime(remainingMs);
      barEl.style.transform = `scaleX(${Math.max(0, remainingMs / roundMs)})`;
      if (secs < lastTick) {
        lastTick = secs;
        if (secs > 0 && secs <= 5) {
          sfx.tick();
          timeEl.classList.add('hurry');
        }
      }
      maybeEndFlash(now);
      if (remainingMs <= 0) timeUp();
    }
    if (phase === 'position' && useMotion && !motionSeen && now - startedAt > NO_SENSOR_MS) noSensor();
    raf = requestAnimationFrame(frame);
  }

  function noSensor() {
    useMotion = false;
    el.classList.add('tap-mode');
    positionEl.querySelector('h1')!.textContent = 'Ready?';
    positionEl.querySelector('.legend')?.remove();
    noSensorNote.textContent =
      params.motion === 'denied'
        ? 'Motion access was blocked, so use the Got it / Pass buttons. On iPhone, close and reopen Safari to be asked again.'
        : "This device isn't sending tilt readings, so use the Got it / Pass buttons instead.";
  }

  function onMotion(x: number, y: number, z: number, t: number) {
    motionSeen = true;
    if (!useMotion) return;
    if (!signDecided) {
      if (t - startedAt <= SIGN_WINDOW_MS) signSamples.push(z);
      else {
        signDecided = true;
        const sign = guessSign(signSamples);
        if (sign) {
          detector.sign = sign;
          if (sign !== getSettings().motionSign) updateSettings({ motionSign: sign });
        }
      }
    }
    const tilt = detector.sample(x, y, z, t);
    if (phase === 'position') {
      if (signDecided && detector.isUpright) {
        uprightSince ??= t;
        if (t - uprightSince >= HOLD_TO_START_MS) startCountdown();
      } else uprightSince = null;
    } else if (phase === 'playing' && tilt) {
      answer(tiltOutcome(tilt));
    }
  }

  function pause() {
    if (phase !== 'playing') return;
    phase = 'paused';
    flash?.el.remove();
    if (flash) {
      flash = null;
      nextCard();
    }
    show(pausedEl);
  }

  function resume() {
    if (phase !== 'paused') return;
    show(null);
    phase = 'playing';
    detector.disarm();
    lastFrame = performance.now();
  }

  function timeUp() {
    if (phase === 'over') return;
    phase = 'over';
    flash?.el.remove();
    flash = null;
    sfx.timeUp();
    buzz(400);
    el.append(h('div', { class: 'overlay flash timeup' }, h('div', { class: 'flash-label' }, "Time's up!")));
    later(finish, 1600);
  }

  function finish() {
    phase = 'over';
    markSeen(shown);
    setLastRound({ deckId: deck!.id, cards: answers });
    navigate('results', { deckId: deck!.id }, { replace: true });
  }

  function quit() {
    phase = 'over';
    leaving = true;
    markSeen(shown);
    goBack();
  }

  const onKey = (e: KeyboardEvent) => {
    // Keyboard stand-ins for tilting, for laptops: ↑ / ↓ (and space to start).
    if (phase === 'position' && (e.key === ' ' || e.key === 'Enter')) startCountdown();
    else if (phase === 'playing' && e.key === 'ArrowUp') answer(tiltOutcome('up'));
    else if (phase === 'playing' && e.key === 'ArrowDown') answer(tiltOutcome('down'));
    else if (e.key === 'Escape') phase === 'paused' ? resume() : pause();
    else return;
    e.preventDefault();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') pause();
  };
  const onResize = () => card && fitWord();

  let stopMotion = () => {};
  return {
    el,
    enter() {
      stopMotion = listenMotion(onMotion);
      raf = requestAnimationFrame(frame);
      window.addEventListener('keydown', onKey);
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisibility);
    },
    leave() {
      stopMotion();
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    },
    back() {
      if (leaving) return false;
      if (phase === 'playing') {
        pause();
        return true;
      }
      if (phase === 'paused' || phase === 'over') return true;
      phase = 'over'; // backing out before the round started
      return false;
    },
  };
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
}
