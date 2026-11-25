import { describe, expect, it } from 'vitest';
import { guessSign, optionsFor, TiltDetector, type Tilt } from '../src/tilt';

const G = 9.81;

/** Gravity reading for a phone held sideways, screen tipped `deg` toward the ceiling. */
function pose(deg: number, axis: 'x' | 'y' | '-x' = 'x'): [number, number, number] {
  const r = (deg * Math.PI) / 180;
  const across = G * Math.cos(r);
  const z = G * Math.sin(r);
  if (axis === 'y') return [0, across, z];
  if (axis === '-x') return [-across, 0, z];
  return [across, 0, z];
}

/** Feed `ms` worth of 60 Hz samples at a fixed pose; returns the tilts detected. */
function hold(d: TiltDetector, clock: { t: number }, deg: number, ms: number, axis?: 'x' | 'y' | '-x'): Tilt[] {
  const out: Tilt[] = [];
  for (let end = clock.t + ms; clock.t < end; clock.t += 16) {
    const tilt = d.sample(...pose(deg, axis), clock.t);
    if (tilt) out.push(tilt);
  }
  return out;
}

function setup(trigger = 40) {
  return { d: new TiltDetector(optionsFor(trigger)), clock: { t: 0 } };
}

describe('TiltDetector', () => {
  it('stays quiet while upright, then arms', () => {
    const { d, clock } = setup();
    expect(hold(d, clock, 0, 1000)).toEqual([]);
    expect(d.isArmed).toBe(true);
    expect(Math.abs(d.pitch)).toBeLessThan(1);
  });

  it('reports up and down once each, needing a return to upright in between', () => {
    const { d, clock } = setup();
    hold(d, clock, 0, 400);
    expect(hold(d, clock, 70, 600)).toEqual(['up']);
    // still tipped: nothing more, and tipping the other way without passing
    // through upright long enough doesn't count either
    expect(hold(d, clock, 70, 600)).toEqual([]);
    hold(d, clock, 0, 400);
    expect(hold(d, clock, -65, 600)).toEqual(['down']);
  });

  it('ignores tilts that start before the phone was ever upright', () => {
    const { d, clock } = setup();
    expect(hold(d, clock, -80, 1000)).toEqual([]);
    hold(d, clock, 0, 400);
    expect(hold(d, clock, -80, 400)).toEqual(['down']);
  });

  it('ignores wobble below the trigger angle', () => {
    const { d, clock } = setup(40);
    hold(d, clock, 0, 400);
    const out: Tilt[] = [];
    for (let i = 0; i < 20; i++) out.push(...hold(d, clock, i % 2 ? 30 : -30, 150));
    expect(out).toEqual([]);
  });

  it('ignores a single spike shorter than the smoothing window', () => {
    const { d, clock } = setup(40);
    hold(d, clock, 0, 400);
    expect(d.sample(...pose(85), clock.t)).toBeNull();
    clock.t += 16;
    expect(hold(d, clock, 0, 300)).toEqual([]);
  });

  it('works whichever way round the phone is held', () => {
    for (const axis of ['x', '-x', 'y'] as const) {
      const { d, clock } = setup();
      hold(d, clock, 0, 400, axis);
      expect(hold(d, clock, 60, 400, axis)).toEqual(['up']);
    }
  });

  it('flips directions when sign is -1', () => {
    const { d, clock } = setup();
    d.sign = -1;
    hold(d, clock, 0, 400);
    expect(hold(d, clock, 60, 400)).toEqual(['down']);
  });

  it('can be disarmed so the next tilt needs upright first', () => {
    const { d, clock } = setup();
    hold(d, clock, 0, 400);
    d.disarm();
    expect(d.sample(...pose(80), clock.t)).toBeNull();
    expect(hold(d, clock, 80, 400)).toEqual([]);
  });

  it('higher sensitivity triggers on a smaller tilt', () => {
    const lo = setup(52);
    const hi = setup(28);
    hold(lo.d, lo.clock, 0, 400);
    hold(hi.d, hi.clock, 0, 400);
    expect(hold(lo.d, lo.clock, 35, 500)).toEqual([]);
    expect(hold(hi.d, hi.clock, 35, 500)).toEqual(['up']);
  });
});

describe('guessSign', () => {
  it('reads the sign from how the phone is held while tapping Start', () => {
    expect(guessSign([7, 7.5, 8])).toBe(1);
    expect(guessSign([-7, -7.5, -8])).toBe(-1);
    expect(guessSign([0.5, -1, 1])).toBeNull();
    expect(guessSign([9])).toBeNull();
  });
});
