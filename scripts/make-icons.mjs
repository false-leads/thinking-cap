// Renders the app icon (SVG below) to the PNGs the web app and the Android
// icon generator need. Run: node scripts/make-icons.mjs
// Then for Android: npx @capacitor/assets generate --android
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const font = readFileSync(new URL('../node_modules/@fontsource/fredoka/files/fredoka-latin-700-normal.woff2', import.meta.url)).toString('base64');

// `bg` false = transparent background (Android adaptive icon foreground).
// Everything important sits inside the central 66% (adaptive icon safe zone).
const svg = (bg = true) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5b3df5"/><stop offset="1" stop-color="#d6246e"/>
    </linearGradient>
  </defs>
  ${bg ? '<rect width="1024" height="1024" fill="url(#g)"/>' : ''}
  <g transform="rotate(-12 512 512)">
    <path d="M290 318 Q512 236 734 318" stroke="#fff" stroke-opacity=".55" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="M290 706 Q512 788 734 706" stroke="#fff" stroke-opacity=".55" stroke-width="22" fill="none" stroke-linecap="round"/>
    <rect x="242" y="362" width="540" height="300" rx="56" fill="#fff"/>
    <rect x="272" y="392" width="480" height="240" rx="32" fill="#ffd23f"/>
    <text x="512" y="597" font-family="F" font-weight="700" font-size="236" text-anchor="middle" fill="#2b1d00">?</text>
  </g>
</svg>`;

const fontCss = `<style>@font-face{font-family:F;font-weight:700;src:url(data:font/woff2;base64,${font})}</style>`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(file, size, bg = true) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><head>${fontCss}</head><body style="margin:0;background:transparent">${svg(bg).replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.evaluate(() => document.fonts.load('700 100px F'));
  writeFileSync(file, await page.screenshot({ omitBackground: !bg }));
  console.log('wrote', file);
}
await render('public/icon-512.png', 512);
await render('public/icon-192.png', 192);
await render('assets/icon-only.png', 1024);
await render('assets/icon-foreground.png', 1024, false);
await page.setViewportSize({ width: 1024, height: 1024 });
await page.setContent('<html><body style="margin:0;background:linear-gradient(135deg,#5b3df5,#d6246e)"></body></html>');
writeFileSync('assets/icon-background.png', await page.screenshot());
// splash: plain brand color with the icon in the middle
await page.setViewportSize({ width: 2732, height: 2732 });
await page.setContent(`<html><head>${fontCss}</head><body style="margin:0;background:#16133a;display:grid;place-items:center;height:100vh"><div style="width:640px;height:640px;border-radius:140px;overflow:hidden">${svg(true).replace('width="1024" height="1024"', 'width="640" height="640"')}</div></body></html>`);
await page.evaluate(() => document.fonts.load('700 100px F'));
writeFileSync('assets/splash.png', await page.screenshot());
writeFileSync('assets/splash-dark.png', await page.screenshot());
await browser.close();
