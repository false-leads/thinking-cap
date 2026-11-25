// Everything that differs between the Android app, phone browsers and desktop.
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { getSettings } from './settings';

/** Running inside the Android app (as opposed to a browser). */
export const isNative = Capacitor.isNativePlatform();

export const isTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export type MotionAccess = 'granted' | 'denied' | 'unsupported';

type PermissionFn = () => Promise<'granted' | 'denied'>;

/**
 * Ask to read the accelerometer. Only iPhones/iPads actually show a prompt,
 * and only when this is called directly from a tap, so call it first thing
 * in the click handler (before any await).
 */
export function requestMotionAccess(): Promise<MotionAccess> {
  if (typeof DeviceMotionEvent === 'undefined') return Promise.resolve('unsupported');
  const request = (DeviceMotionEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
  if (typeof request !== 'function') return Promise.resolve('granted');
  return request.call(DeviceMotionEvent).then(
    (r) => (r === 'granted' ? 'granted' : 'denied'),
    () => 'denied',
  );
}

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

/** Landscape + full screen for a round. Call from a tap. Never throws. */
export async function enterGameMode(): Promise<void> {
  if (isNative) {
    await ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
    return;
  }
  if (!isTouch) return; // don't hijack a desktop browser window
  // Android browsers only allow an orientation lock while full screen.
  // iPhone Safari supports neither; the game shows a "turn sideways" hint.
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
  } catch {
    /* not allowed or not supported */
  }
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape');
  } catch {
    /* not supported */
  }
}

export async function exitGameMode(): Promise<void> {
  if (isNative) {
    await ScreenOrientation.unlock().catch(() => {});
    return;
  }
  try {
    (screen.orientation as LockableOrientation | undefined)?.unlock?.();
  } catch {
    /* ignore */
  }
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
}

// --- keep the screen on ------------------------------------------------------
// The Android app keeps the screen on by itself (MainActivity); browsers need
// the Screen Wake Lock API, which also has to be re-requested after the page
// is hidden and shown again.

let wakeLock: WakeLockSentinel | null = null;
let wantAwake = false;

export async function keepAwake(on: boolean): Promise<void> {
  wantAwake = on;
  if (isNative) return;
  if (!on) {
    const lock = wakeLock;
    wakeLock = null;
    await lock?.release().catch(() => {});
    return;
  }
  if (wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    /* denied (low battery, not visible) */
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (wantAwake && document.visibilityState === 'visible') void keepAwake(true);
  });
}

// --- vibration (Android only; iPhones ignore it) ----------------------------

export const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function buzz(pattern: number | number[]): void {
  if (canVibrate && getSettings().vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}
