import { load, save } from './storage';
import { LEVELS, type Level } from './types';

export type Sensitivity = 'low' | 'medium' | 'high';

export interface Settings {
  roundSeconds: number;
  levels: Level[];
  sound: boolean;
  vibrate: boolean;
  /** false: tilt UP = got it, DOWN = pass. true: the other way round. */
  swapTilt: boolean;
  sensitivity: Sensitivity;
  /** Always show on-screen Got it / Pass buttons instead of using tilt. */
  tapControls: boolean;
  /**
   * +1 or -1. Some browsers report the gravity axis with the opposite sign;
   * the game detects it each round from how the phone is held when Start is
   * tapped, and remembers the last answer here.
   */
  motionSign: 1 | -1;
}

export const ROUND_LENGTHS = [30, 60, 90, 120] as const;

export const DEFAULTS: Settings = {
  roundSeconds: 60,
  levels: ['easy', 'medium'],
  sound: true,
  vibrate: true,
  swapTilt: false,
  sensitivity: 'medium',
  tapControls: false,
  motionSign: 1,
};

/** Tilt angle (degrees from upright) that counts as an answer. */
export const TRIGGER_DEGREES: Record<Sensitivity, number> = { high: 28, medium: 40, low: 52 };

let current: Settings = sanitize(load<Partial<Settings>>('settings', {}));

function sanitize(s: Partial<Settings>): Settings {
  const out = { ...DEFAULTS, ...s };
  out.levels = LEVELS.filter((l) => out.levels?.includes(l));
  if (out.levels.length === 0) out.levels = [...DEFAULTS.levels];
  if (!Number.isFinite(out.roundSeconds) || out.roundSeconds < 5) out.roundSeconds = DEFAULTS.roundSeconds;
  if (!(out.sensitivity in TRIGGER_DEGREES)) out.sensitivity = DEFAULTS.sensitivity;
  if (out.motionSign !== 1 && out.motionSign !== -1) out.motionSign = 1;
  return out;
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  current = sanitize({ ...current, ...patch });
  save('settings', current);
  return current;
}
