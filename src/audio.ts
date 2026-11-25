// Sound effects, synthesized with Web Audio so there are no audio files to
// license or download.
import { getSettings } from './settings';

let ctx: AudioContext | null = null;

/** Browsers only allow sound after a tap; call this from one. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, volume: number, toFreq?: number): void {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function play(fn: () => void): void {
  if (!getSettings().sound || !ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  fn();
}

export const sfx = {
  correct: () =>
    play(() => {
      tone(784, 0, 0.12, 'triangle', 0.35);
      tone(988, 0.08, 0.12, 'triangle', 0.35);
      tone(1319, 0.16, 0.22, 'triangle', 0.35);
    }),
  pass: () => play(() => tone(360, 0, 0.28, 'square', 0.12, 150)),
  tick: () => play(() => tone(1400, 0, 0.05, 'sine', 0.2)),
  countdown: () => play(() => tone(660, 0, 0.14, 'sine', 0.3)),
  go: () => play(() => tone(990, 0, 0.3, 'sine', 0.35)),
  timeUp: () =>
    play(() => {
      tone(220, 0, 0.8, 'sawtooth', 0.12);
      tone(233, 0, 0.8, 'sawtooth', 0.12);
    }),
};
