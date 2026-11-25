// End-to-end smoke test: plays real rounds in Chromium with a fake
// accelerometer, and saves screenshots.
//
//   npm run build && npx vite preview --port 4173 &
//   node e2e/smoke.mjs http://localhost:4173/ screenshots/tmp
//
// Exits non-zero on any failed check or page error.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = process.argv[3] ?? 'screenshots/tmp';
mkdirSync(OUT, { recursive: true });

const G = 9.81;
const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};

// Fake accelerometer: dispatches devicemotion at 60 Hz for whatever pose the
// test sets with window.__tilt(degrees). Positive = screen toward ceiling.
const fakeMotion = () => {
  let pose = { x: 0, y: 0, z: 9.81 };
  window.__tilt = (deg) => {
    const r = (deg * Math.PI) / 180;
    pose = { x: 9.81 * Math.cos(r), y: 0, z: 9.81 * Math.sin(r) };
  };
  window.__tilt(45); // held in front of you while tapping Start
  setInterval(() => {
    window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: pose, interval: 16 }));
  }, 16);
};

const browser = await chromium.launch();
const pageErrors = [];

async function newPage({ landscape = true, motion = true } = {}) {
  const ctx = await browser.newContext({
    viewport: landscape ? { width: 844, height: 390 } : { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  if (motion) {
    await ctx.grantPermissions(['accelerometer', 'gyroscope']);
    await ctx.addInitScript(fakeMotion);
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
  return page;
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const tilt = (page, deg) => page.evaluate((d) => window.__tilt(d), deg);
const score = async (page) => Number(await page.locator('.hud-score').textContent());

// ---- home in portrait -------------------------------------------------------
{
  const page = await newPage({ landscape: false, motion: false });
  await page.goto(BASE);
  const cards = await page.locator('.deck-card:not(.ghost)').count();
  check(cards >= 21, `home shows the Everything card + built-in decks (${cards})`);
  await shot(page, '01-home-portrait');
  await page.close();
}

// ---- a full tilt round ------------------------------------------------------
{
  const page = await newPage();
  await page.goto(`${BASE}?seconds=14`);
  await shot(page, '02-home-landscape');
  await page.getByRole('button', { name: /Animals/ }).click();
  await page.waitForSelector('.ready');
  await shot(page, '03-ready');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForSelector('.overlay.position');
  await shot(page, '04-hold-to-forehead');

  await page.waitForTimeout(500); // sign detection window, phone still tipped back
  await tilt(page, 2); // upright on the forehead
  await page.waitForSelector('.overlay.countdown', { timeout: 3000 });
  await page.waitForSelector('.overlay.countdown', { state: 'detached', timeout: 5000 });
  const first = await page.locator('.card-word').textContent();
  check(Boolean(first), `round started with a word: "${first}"`);
  await shot(page, '05-word');

  // got it (tilt up), pass (tilt down), got it
  const words = [first];
  for (const [deg, label] of [[70, 'Got it!'], [-70, 'Pass'], [65, 'Got it!']]) {
    await tilt(page, deg);
    await page.waitForSelector(`.flash:has-text("${label}")`, { timeout: 2000 });
    await page.waitForTimeout(200); // let the flash finish fading in
    if (words.length === 1) await shot(page, '06-flash-correct');
    if (words.length === 2) await shot(page, '07-flash-pass');
    await page.waitForTimeout(100);
    // holding the tilt must not score again
    await tilt(page, 2);
    await page.waitForSelector('.flash', { state: 'detached', timeout: 2500 });
    words.push(await page.locator('.card-word').textContent());
  }
  check((await score(page)) === 2, `score is 2 after up/down/up (got ${await score(page)})`);
  check(new Set(words).size === words.length, 'no word repeated within the round');

  // a small wobble shouldn't count
  await tilt(page, 25);
  await page.waitForTimeout(400);
  await tilt(page, 0);
  check((await page.locator('.flash').count()) === 0, '25° wobble ignored at medium sensitivity');

  // pause via the back button, then resume
  await page.goBack();
  await page.waitForSelector('.overlay.paused');
  check(await page.locator('.play').isVisible(), 'back button pauses instead of leaving');
  await shot(page, '08-paused');
  await page.getByRole('button', { name: 'Resume' }).click();

  await page.waitForSelector('.results', { timeout: 20000 });
  await shot(page, '09-results');
  const correct = await page.locator('.results-list li.correct').count();
  const passed = await page.locator('.results-list li.pass').count();
  check(correct === 2 && passed === 1, `results list 2 correct + 1 pass (got ${correct} + ${passed})`);
  check((await page.locator('.results-score').textContent()) === '2', 'results score is 2');

  // back from results goes home, not into the finished round
  await page.goBack();
  await page.waitForSelector('.home');
  check(true, 'back from results lands on home');
  await page.close();
}

// ---- no motion sensor: buttons ----------------------------------------------
{
  const page = await newPage({ motion: false });
  await page.goto(`${BASE}?seconds=6`);
  await page.getByRole('button', { name: /Sing It/ }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForSelector('.tap-mode', { timeout: 4000 });
  check(true, 'falls back to buttons when no motion readings arrive');
  await shot(page, '10-no-sensor');
  await page.locator('.overlay.position').click();
  await page.waitForSelector('.overlay.countdown', { state: 'detached', timeout: 5000 });
  check((await page.locator('.card-hint').textContent())?.includes('Hum'), 'Sing It shows its hint under the word');
  await page.getByRole('button', { name: '✓ Got it' }).click();
  await page.waitForSelector('.flash', { state: 'detached' });
  await page.keyboard.press('ArrowDown');
  await page.waitForSelector('.flash.pass');
  await shot(page, '11-tap-mode');
  await page.waitForSelector('.results', { timeout: 12000 });
  check((await page.locator('.results-score').textContent()) === '1', 'button + arrow-key answers score');
  await page.close();
}

// ---- custom deck --------------------------------------------------------------
{
  const page = await newPage({ landscape: false, motion: false });
  await page.goto(BASE);
  await page.getByRole('button', { name: /New deck/ }).click();
  await page.locator('.name-input').fill('Family Names');
  await page.locator('.words-input').fill('# easy\nGrandma\nUncle Bob\n# hard\nCousin Steve');
  await shot(page, '12-editor');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('.home');
  check(await page.getByRole('button', { name: /Family Names\s*3 words/ }).isVisible(), 'custom deck saved and listed with 3 words');
  await page.getByRole('button', { name: /Family Names/ }).click();
  await page.waitForSelector('.ready');
  check(await page.getByText('Only 2 words at that level').isVisible(), 'small deck explains every level is in play');
  await page.goBack();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForSelector('.settings');
  await shot(page, '13-settings');
  await page.close();
}

check(pageErrors.length === 0, `no page errors${pageErrors.length ? `: ${pageErrors.join(' | ')}` : ''}`);
await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll e2e checks passed');
