import type { Vec2 } from "./types";

/**
 * One-euro filter: adaptive low-pass that smooths hard when the gaze is still
 * (kills jitter during fixation) and loosens when the gaze moves fast (keeps
 * latency low during saccades). Preferred over Kalman here because it needs no
 * motion model and exposes two intuitive, per-user tunable parameters.
 */
class LowPass {
  private y: number | null = null;
  filter(x: number, a: number) {
    this.y = this.y === null ? x : a * x + (1 - a) * this.y;
    return this.y;
  }
  get value() {
    return this.y;
  }
  reset() {
    this.y = null;
  }
}

export class OneEuro {
  private xf = new LowPass();
  private dxf = new LowPass();
  private prev: number | null = null;
  private last = 0;
  constructor(
    public minCutoff = 0.8,
    public beta = 0.01,
    public dCutoff = 1,
  ) {}

  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: number, t: number) {
    const dt = this.last ? Math.max(1e-3, (t - this.last) / 1000) : 1 / 30;
    this.last = t;
    const dx = this.prev === null ? 0 : (x - this.prev) / dt;
    this.prev = x;
    const edx = this.dxf.filter(dx, this.alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xf.filter(x, this.alpha(cutoff, dt));
  }

  reset() {
    this.xf.reset();
    this.dxf.reset();
    this.prev = null;
    this.last = 0;
  }
}

export class GazeStabilizer {
  private fx = new OneEuro();
  private fy = new OneEuro();
  /** smoothing 0..1 -> parameter mapping, personalized per profile/preset. */
  setSmoothing(s: number) {
    const minCutoff = 2.5 - 2.3 * s; // 2.5 (responsive) .. 0.2 (very smooth)
    const beta = 0.02 + 0.05 * (1 - s);
    for (const f of [this.fx, this.fy]) {
      f.minCutoff = minCutoff;
      f.beta = beta;
    }
  }
  apply(p: Vec2, t: number): Vec2 {
    return { x: this.fx.filter(p.x, t), y: this.fy.filter(p.y, t) };
  }
  reset() {
    this.fx.reset();
    this.fy.reset();
  }
}

/** Running jitter estimate used to personalize smoothing over time. */
export class JitterMeter {
  private buf: Vec2[] = [];
  push(p: Vec2) {
    this.buf.push(p);
    if (this.buf.length > 45) this.buf.shift();
  }
  value() {
    if (this.buf.length < 8) return 0;
    const mx = this.buf.reduce((a, b) => a + b.x, 0) / this.buf.length;
    const my = this.buf.reduce((a, b) => a + b.y, 0) / this.buf.length;
    return Math.sqrt(
      this.buf.reduce((a, b) => a + (b.x - mx) ** 2 + (b.y - my) ** 2, 0) / this.buf.length,
    );
  }
}
