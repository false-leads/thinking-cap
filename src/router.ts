// Screen switching on top of the browser history, so the Android back button
// and the browser back button both work without a native plugin.
//
// home -> ready, settings, editor, help are pushed; ready -> play -> results
// replace each other, so "back" from results goes straight home.

export interface Screen {
  el: HTMLElement;
  /** Called after the element is on the page. */
  enter?(): void;
  /** Called before the screen is removed. */
  leave?(): void;
  /** Back button pressed. Return true to stay on this screen (e.g. pause instead). */
  back?(): boolean;
}

export type Params = Record<string, string>;
export type ScreenFactory = (params: Params) => Screen;

interface NavState {
  name: string;
  params: Params;
}

const factories = new Map<string, ScreenFactory>();
let root: HTMLElement;
let current: Screen | null = null;
let currentState: NavState = { name: 'home', params: {} };

export function registerScreen(name: string, factory: ScreenFactory): void {
  factories.set(name, factory);
}

export function navigate(name: string, params: Params = {}, opts: { replace?: boolean } = {}): void {
  const state: NavState = { name, params };
  if (opts.replace) history.replaceState(state, '');
  else history.pushState(state, '');
  render(state);
}

export function goBack(): void {
  history.back();
}

function render(state: NavState): void {
  const factory = factories.get(state.name) ?? factories.get('home')!;
  current?.leave?.();
  currentState = state;
  const screen = factory(state.params);
  current = screen;
  root.replaceChildren(screen.el);
  window.scrollTo(0, 0);
  screen.enter?.();
}

export function startRouter(el: HTMLElement, initial: NavState): void {
  root = el;
  window.addEventListener('popstate', (e) => {
    if (current?.back?.()) {
      history.pushState(currentState, '');
      return;
    }
    render((e.state as NavState | null) ?? { name: 'home', params: {} });
  });
  if (initial.name !== 'home') {
    history.replaceState({ name: 'home', params: {} }, '');
    navigate(initial.name, initial.params);
  } else {
    history.replaceState(initial, '');
    render(initial);
  }
}
