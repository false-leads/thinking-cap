// Starting rounds and handing the last round's results to the results screen.
import { unlockAudio } from './audio';
import { enterGameMode, keepAwake, requestMotionAccess, type MotionAccess } from './platform';
import { navigate } from './router';
import { getSettings } from './settings';
import type { RoundResult } from './types';

let lastRound: RoundResult | null = null;
let starting = false;

export function setLastRound(r: RoundResult): void {
  lastRound = r;
}

export function getLastRound(): RoundResult | null {
  return lastRound;
}

/** Start a round on `deckId`. Must be called from a tap (permissions, sound, full screen). */
export function startRound(deckId: string): void {
  if (starting) return; // double tap
  starting = true;
  const access: Promise<MotionAccess> = getSettings().tapControls ? Promise.resolve('unsupported') : requestMotionAccess();
  unlockAudio();
  void enterGameMode();
  void keepAwake(true);
  void access.then((motion) => {
    starting = false;
    navigate('play', { deckId, motion }, { replace: true });
  });
}
