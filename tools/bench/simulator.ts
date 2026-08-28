/**
 * Synthetic gaze simulator.
 *
 * Produces the same feature vector layout that `extractFeatures` emits from
 * MediaPipe landmarks, so the calibration/filtering/intent code can be
 * benchmarked deterministically without a camera. The forward model is
 * intentionally *not* the model calibration fits: it is mildly non-linear plus
 * per-frame noise, which is what a real webcam pipeline looks like.
 */

export interface SimConfig {
  width: number;
  height: number;
  /** Std-dev of per-frame iris landmark noise, in eye-local units. */
  irisNoise: number;
  /** Amplitude of slow head drift, radians. */
  headDrift: number;
  /** Quantisation step of the iris centroid (camera resolution limit). */
  quantum: number;
  seed: number;
}

export const DEFAULT_SIM: SimConfig = {
  width: 1920,
  height: 1080,
  // ~0.006 eye-widths ≈ 0.35 px of iris centroid movement on a 640x480 webcam.
  irisNoise: 0.006,
  headDrift: 0.05,
  quantum: 0.0015,
  seed: 1,
};

/** Deterministic PRNG so benchmark runs are comparable across commits. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 1;
  }
  next(): number {
    this.s ^= this.s << 13;
    this.s ^= this.s >>> 17;
    this.s ^= this.s << 5;
    this.s >>>= 0;
    return this.s / 0x100000000;
  }
  normal(): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

export class GazeSimulator {
  private rng: Rng;
  private t0 = 0;

  constructor(private cfg: SimConfig = DEFAULT_SIM) {
    this.rng = new Rng(cfg.seed);
  }

  /** Ground-truth screen point -> noisy feature vector, as the tracker would emit. */
  features(
    screen: { x: number; y: number },
    tMs: number,
  ): { vector: number[]; confidence: number } {
    const { width, height, irisNoise, headDrift, quantum } = this.cfg;
    if (!this.t0) this.t0 = tMs;
    const t = (tMs - this.t0) / 1000;

    // Normalised gaze angle, -1..1 across the screen.
    const nx = (screen.x / width) * 2 - 1;
    const ny = (screen.y / height) * 2 - 1;

    // Slow head drift, the dominant source of calibration decay in practice.
    const yaw = headDrift * Math.sin(t * 0.23);
    const pitch = headDrift * 0.6 * Math.sin(t * 0.17 + 1.1);
    const roll = headDrift * 0.2 * Math.sin(t * 0.11);

    // Eyeball rotation is roughly tangent-shaped in the iris-offset domain, and
    // the two eyes disagree slightly (vergence).
    const base = (v: number) => 0.16 * Math.tan(v * 0.55) + 0.01 * v * v * Math.sign(v);
    const gx = base(nx) - 0.25 * yaw;
    const gy = base(ny) * 0.75 - 0.25 * pitch;

    const q = (v: number) => Math.round(v / quantum) * quantum;
    const n = () => this.rng.normal() * irisNoise;

    const lx = q(gx + 0.012 + n());
    const ly = q(gy + n());
    const rx = q(gx - 0.012 + n());
    const ry = q(gy + n());

    return {
      vector: [
        (lx + rx) / 2,
        (ly + ry) / 2,
        lx,
        ly,
        rx,
        ry,
        yaw,
        pitch,
        roll,
        0.02 * Math.sin(t * 0.19),
        0.02 * Math.cos(t * 0.13),
      ],
      confidence: 0.85 - 0.2 * Math.min(1, Math.abs(yaw) + Math.abs(pitch)),
    };
  }
}

/** Standard N-point calibration layouts, in normalised screen coordinates. */
export function layout(points: 5 | 9 | 13 | 17): { x: number; y: number }[] {
  const g = (cols: number[], rows: number[]) => rows.flatMap((y) => cols.map((x) => ({ x, y })));
  const m = 0.1;
  switch (points) {
    case 5:
      return [
        { x: m, y: m },
        { x: 1 - m, y: m },
        { x: 0.5, y: 0.5 },
        { x: m, y: 1 - m },
        { x: 1 - m, y: 1 - m },
      ];
    case 9:
      return g([m, 0.5, 1 - m], [m, 0.5, 1 - m]);
    case 13:
      return [...g([m, 0.5, 1 - m], [m, 0.5, 1 - m]), ...g([0.3, 0.7], [0.3, 0.7])];
    case 17:
      return [...g([m, 0.35, 0.65, 1 - m], [m, 0.35, 0.65, 1 - m]), { x: 0.5, y: 0.5 }];
  }
}

/** A fixation/saccade gaze path: hold a point, jump, hold the next one. */
export function* scanPath(
  targets: { x: number; y: number }[],
  fixationMs: number,
  saccadeMs: number,
  frameMs: number,
): Generator<{ t: number; point: { x: number; y: number }; fixating: boolean }> {
  let t = 0;
  for (let i = 0; i < targets.length; i++) {
    const from = targets[Math.max(0, i - 1)] as { x: number; y: number };
    const to = targets[i] as { x: number; y: number };
    for (let e = 0; e < saccadeMs; e += frameMs) {
      const k = e / saccadeMs;
      yield {
        t,
        point: { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k },
        fixating: false,
      };
      t += frameMs;
    }
    for (let e = 0; e < fixationMs; e += frameMs) {
      yield { t, point: to, fixating: true };
      t += frameMs;
    }
  }
}
