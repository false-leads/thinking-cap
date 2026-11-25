// Tilt detection from the accelerometer.
//
// With the phone held sideways on someone's forehead, the screen faces the
// room and gravity runs along the screen. We only care about the angle
// between the screen and vertical ("pitch"):
//
//    pitch ~   0°  upright on the forehead (neutral)
//    pitch > +T    screen tipped toward the ceiling  -> 'up'
//    pitch < -T    screen tipped toward the floor    -> 'down'
//
// pitch = atan2(z, |(x, y)|) on the gravity vector. Unlike the
// DeviceOrientation angles (beta/gamma), this has no wrap-around at the
// upright position, and it doesn't care which way round the phone is held.
//
// After a tilt fires, the phone must come back to upright (and stay there
// briefly) before the next tilt can count, so one nod can't score three words.

export type Tilt = 'up' | 'down';

export interface TiltOptions {
  /** |pitch| at or beyond this counts as an answer. */
  triggerDeg: number;
  /** |pitch| below this counts as back to upright. */
  neutralDeg: number;
  /** How long the phone must stay upright before the next tilt can count. */
  settleMs: number;
  /** Low-pass filter time constant; smooths out head wobble. */
  smoothingMs: number;
}

export function optionsFor(triggerDeg: number): TiltOptions {
  return { triggerDeg, neutralDeg: Math.min(20, triggerDeg / 2), settleMs: 150, smoothingMs: 60 };
}

const RAD_TO_DEG = 180 / Math.PI;

export class TiltDetector {
  /** Smoothed pitch in degrees; + means the screen faces up. */
  pitch = 0;
  /** Flip if this platform reports the z axis inverted. */
  sign: 1 | -1 = 1;

  private gx = 0;
  private gy = 0;
  private gz = 0;
  private lastT: number | null = null;
  private armed = false;
  private uprightSince: number | null = null;

  constructor(public opts: TiltOptions) {}

  /**
   * Feed one accelerometer reading (m/s², gravity included) taken at time
   * `t` (ms). Returns 'up' or 'down' on the sample where a tilt is detected.
   */
  sample(x: number, y: number, z: number, t: number): Tilt | null {
    if (this.lastT === null) {
      this.gx = x;
      this.gy = y;
      this.gz = z;
    } else {
      const dt = Math.max(0, t - this.lastT);
      const a = 1 - Math.exp(-dt / this.opts.smoothingMs);
      this.gx += a * (x - this.gx);
      this.gy += a * (y - this.gy);
      this.gz += a * (z - this.gz);
    }
    this.lastT = t;

    const across = Math.hypot(this.gx, this.gy);
    if (across + Math.abs(this.gz) < 1) return null; // no usable gravity reading
    this.pitch = this.sign * Math.atan2(this.gz, across) * RAD_TO_DEG;
    const tilt = Math.abs(this.pitch);

    if (!this.armed) {
      if (tilt < this.opts.neutralDeg) {
        this.uprightSince ??= t;
        if (t - this.uprightSince >= this.opts.settleMs) this.armed = true;
      } else {
        this.uprightSince = null;
      }
      return null;
    }
    if (tilt >= this.opts.triggerDeg) {
      this.disarm();
      return this.pitch > 0 ? 'up' : 'down';
    }
    return null;
  }

  /** True once the phone has been upright long enough for a tilt to count. */
  get isArmed(): boolean {
    return this.armed;
  }

  get isUpright(): boolean {
    return Math.abs(this.pitch) < this.opts.neutralDeg;
  }

  /** Ignore tilts until the phone has been upright again. */
  disarm(): void {
    this.armed = false;
    this.uprightSince = null;
  }
}

/**
 * Guess whether this device reports z with the standard sign, from readings
 * taken right after the player taps Start. While tapping, the screen faces
 * the player and is tipped back, so z should be clearly positive (W3C
 * convention: face-up on a table reads about +9.8). Returns null if the
 * readings are ambiguous (phone held exactly upright).
 */
export function guessSign(zs: readonly number[]): 1 | -1 | null {
  if (zs.length < 3) return null;
  const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
  if (mean > 4) return 1;
  if (mean < -4) return -1;
  return null;
}

export type MotionListener = (x: number, y: number, z: number, t: number) => void;

/** Subscribe to accelerometer readings. Returns an unsubscribe function. */
export function listenMotion(fn: MotionListener): () => void {
  const handler = (e: DeviceMotionEvent) => {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x === null || g.y === null || g.z === null) return;
    fn(g.x, g.y, g.z, performance.now());
  };
  window.addEventListener('devicemotion', handler);
  return () => window.removeEventListener('devicemotion', handler);
}
