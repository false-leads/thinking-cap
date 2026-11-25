// Tiny DOM helpers; the app is small enough not to need a framework.

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** h('button', { class: 'x', onclick: fn }, 'Label') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'style') el.setAttribute('style', String(value));
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value as EventListener);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(typeof c === 'number' ? String(c) : c);
  return el;
}

/**
 * Largest font size (px) at which `el`'s text fits inside `box` without
 * breaking words. Words are what everyone across the room has to read, so
 * they should be as big as possible.
 */
export function fitText(el: HTMLElement, box: HTMLElement, max: number, min = 16): void {
  const w = box.clientWidth;
  const hgt = box.clientHeight;
  if (!w || !hgt) return;
  const fits = () => el.scrollWidth <= w && el.offsetHeight <= hgt;
  let lo = min;
  let hi = Math.max(min, Math.floor(max));
  el.style.fontSize = `${hi}px`;
  if (fits()) return;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    el.style.fontSize = `${mid}px`;
    if (fits()) lo = mid;
    else hi = mid;
  }
  el.style.fontSize = `${lo}px`;
}

let toastTimer = 0;

export function toast(message: string, ms = 2600): void {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), ms);
}
