/**
 * Baseline benchmark for the existing gaze core.
 *
 * Run: `bun tools/bench/gaze-bench.ts`
 *
 * Measures, on a deterministic synthetic signal (see simulator.ts):
 *   - calibration error per layout (5/9/13/17 point)
 *   - fixation jitter and saccade latency across the smoothing range
 *   - per-frame cost of predict + stabilize
 *
 * These numbers are the reference point for the Phase 2 stabilization work;
 * they are relative, not a claim about real-world accuracy.
 */
import {
  fitModel,
  predict,
  rejectOutliers,
  type CalibSample,
} from "../../src/lib/gaze/calibration";
import { GazeStabilizer, OneEuro } from "../../src/lib/gaze/filter";
import { DEFAULT_SIM, GazeSimulator, layout, scanPath } from "./simulator";

const W = DEFAULT_SIM.width;
const H = DEFAULT_SIM.height;
const FRAME_MS = 1000 / 35; // engine caps the loop at ~35 fps

function calibrate(points: 5 | 9 | 13 | 17, sim: GazeSimulator, startT = 0) {
  const groups: CalibSample[][] = [];
  let t = startT;
  for (const p of layout(points)) {
    const target = { x: p.x * W, y: p.y * H };
    t += 900; // settle time, matches useGazeEngine.runCalibration
    const group: CalibSample[] = [];
    for (let e = 0; e < 1100; e += FRAME_MS) {
      group.push({ features: sim.features(target, t).vector, target });
      t += FRAME_MS;
    }
    groups.push(group);
  }
  const clean = rejectOutliers(groups);
  return { model: fitModel(clean, W, H, null), samples: clean.length, endT: t };
}

function accuracy(model: ReturnType<typeof fitModel>, sim: GazeSimulator, startT: number) {
  // Validate on a grid offset from the calibration points, so we measure
  // generalisation rather than fit residual.
  const errs: number[] = [];
  let t = startT;
  for (let gx = 0; gx < 5; gx++) {
    for (let gy = 0; gy < 5; gy++) {
      const target = { x: (0.15 + 0.175 * gx) * W, y: (0.15 + 0.175 * gy) * H };
      t += 300;
      for (let e = 0; e < 500; e += FRAME_MS) {
        const p = predict(model, sim.features(target, t).vector);
        errs.push(Math.hypot(p.x - target.x, p.y - target.y));
        t += FRAME_MS;
      }
    }
  }
  errs.sort((a, b) => a - b);
  return {
    meanPx: errs.reduce((a, b) => a + b, 0) / errs.length,
    p95Px: errs[Math.floor(errs.length * 0.95)] as number,
    endT: t,
  };
}

type Filter2D = { apply(p: { x: number; y: number }, t: number): { x: number; y: number } };

function oneEuro2D(minCutoff: number, beta: number): Filter2D {
  const fx = new OneEuro(minCutoff, beta);
  const fy = new OneEuro(minCutoff, beta);
  return { apply: (p, t) => ({ x: fx.filter(p.x, t), y: fy.filter(p.y, t) }) };
}

function stability(
  model: ReturnType<typeof fitModel>,
  sim: GazeSimulator,
  smoothing: number,
  startT: number,
  filter?: Filter2D,
) {
  const gs = new GazeStabilizer();
  gs.setSmoothing(smoothing);
  const stab: Filter2D = filter ?? gs;
  const targets = [
    { x: 0.25, y: 0.3 },
    { x: 0.75, y: 0.3 },
    { x: 0.5, y: 0.7 },
    { x: 0.2, y: 0.8 },
    { x: 0.8, y: 0.75 },
  ].map((p) => ({ x: p.x * W, y: p.y * H }));

  const truth: { x: number; y: number }[] = [];
  const out: { x: number; y: number }[] = [];
  const raw: { x: number; y: number }[] = [];
  const fixating: boolean[] = [];
  const fixIndex: number[] = [];
  let fix = -1;
  let prevFixating = false;

  for (const step of scanPath(targets, 1200, 200, FRAME_MS)) {
    const t = startT + step.t;
    const f = sim.features(step.point, t);
    const r = predict(model, f.vector);
    const s = stab.apply(r, t);
    truth.push(step.point);
    raw.push(r);
    out.push(s);
    if (step.fixating && !prevFixating) fix++;
    prevFixating = step.fixating;
    fixating.push(step.fixating);
    fixIndex.push(step.fixating ? fix : -1);
  }

  // Jitter: RMS deviation from the per-fixation mean, ignoring the first 300ms
  // of each fixation (settling), for raw vs filtered.
  const jitterOf = (series: { x: number; y: number }[]) => {
    const buckets = new Map<number, { x: number; y: number }[]>();
    let sinceStart = 0;
    for (let i = 0; i < series.length; i++) {
      const idx = fixIndex[i] as number;
      if (idx < 0) {
        sinceStart = 0;
        continue;
      }
      sinceStart += FRAME_MS;
      if (sinceStart < 300) continue;
      const arr = buckets.get(idx) ?? [];
      arr.push(series[i] as { x: number; y: number });
      buckets.set(idx, arr);
    }
    let acc = 0;
    let n = 0;
    for (const arr of buckets.values()) {
      const mx = arr.reduce((a, b) => a + b.x, 0) / arr.length;
      const my = arr.reduce((a, b) => a + b.y, 0) / arr.length;
      for (const p of arr) {
        acc += (p.x - mx) ** 2 + (p.y - my) ** 2;
        n++;
      }
    }
    return Math.sqrt(acc / Math.max(1, n));
  };

  // Filter-induced latency: frame shift that best aligns the filtered series
  // with its own input. Measured against `raw`, not truth, so calibration bias
  // (which is large and constant per region) does not swamp the estimate.
  let bestLag = 0;
  let bestErr = Infinity;
  for (let lag = 0; lag <= 25; lag++) {
    let err = 0;
    let n = 0;
    for (let i = 0; i + lag < out.length; i++) {
      const o = out[i + lag] as { x: number; y: number };
      const g = raw[i] as { x: number; y: number };
      err += Math.hypot(o.x - g.x, o.y - g.y);
      n++;
    }
    err /= n;
    if (err < bestErr) {
      bestErr = err;
      bestLag = lag;
    }
  }

  // Mean absolute tracking error against ground truth (calibration bias + noise).
  let terr = 0;
  for (let i = 0; i < out.length; i++) {
    const o = out[i] as { x: number; y: number };
    const g = truth[i] as { x: number; y: number };
    terr += Math.hypot(o.x - g.x, o.y - g.y);
  }
  terr /= out.length;

  // Settle time: ms from saccade end until the cursor stays within 40px of the
  // steady-state position it eventually holds for that fixation — the practical
  // precondition for a dwell click, independent of calibration bias.
  const steady = new Map<number, { x: number; y: number }>();
  {
    const acc = new Map<number, { x: number; y: number; n: number }>();
    for (let i = 0; i < out.length; i++) {
      const idx = fixIndex[i] as number;
      if (idx < 0) continue;
      const o = out[i] as { x: number; y: number };
      const a = acc.get(idx) ?? { x: 0, y: 0, n: 0 };
      a.x += o.x;
      a.y += o.y;
      a.n++;
      acc.set(idx, a);
    }
    for (const [k, a] of acc) steady.set(k, { x: a.x / a.n, y: a.y / a.n });
  }
  const settle: number[] = [];
  let since: number | null = null;
  let stableFor = 0;
  for (let i = 0; i < out.length; i++) {
    const idx = fixIndex[i] as number;
    if (idx < 0) {
      since = 0;
      stableFor = 0;
      continue;
    }
    if (since === null) continue;
    since += FRAME_MS;
    const o = out[i] as { x: number; y: number };
    const g = steady.get(idx) as { x: number; y: number };
    if (Math.hypot(o.x - g.x, o.y - g.y) < 40) {
      stableFor += FRAME_MS;
      if (stableFor >= 100) {
        settle.push(since - stableFor);
        since = null;
      }
    } else {
      stableFor = 0;
    }
  }

  return {
    rawJitterPx: jitterOf(raw),
    filteredJitterPx: jitterOf(out),
    latencyMs: bestLag * FRAME_MS,
    trackingErrorPx: terr,
    settleMs: settle.length ? settle.reduce((a, b) => a + b, 0) / settle.length : NaN,
  };
}

function cost(model: ReturnType<typeof fitModel>, sim: GazeSimulator) {
  const stab = new GazeStabilizer();
  stab.setSmoothing(0.55);
  const frames = 20000;
  const feats = Array.from(
    { length: 200 },
    (_, i) => sim.features({ x: (i % 20) * 90, y: (i % 10) * 100 }, i * FRAME_MS).vector,
  );
  const t0 = performance.now();
  for (let i = 0; i < frames; i++) {
    const p = predict(model, feats[i % feats.length] as number[]);
    stab.apply(p, i * FRAME_MS);
  }
  return ((performance.now() - t0) / frames) * 1000; // microseconds/frame
}

/**
 * Basis ablation. `src/lib/gaze/calibration.ts` expands features to a cubic
 * basis; this fits the same ridge on reduced bases to separate "expressive
 * enough" from "amplifies input noise".
 */
type Basis = (v: number[]) => number[];
const BASES: Record<string, Basis> = {
  linear: (v) => [1, ...v],
  quadratic: (v) => {
    const gx = v[0] ?? 0;
    const gy = v[1] ?? 0;
    return [1, ...v, gx * gx, gy * gy, gx * gy];
  },
  "cubic (current)": (v) => {
    const gx = v[0] ?? 0;
    const gy = v[1] ?? 0;
    const yaw = v[6] ?? 0;
    const pitch = v[7] ?? 0;
    return [1, ...v, gx * gx, gy * gy, gx * gy, gx * yaw, gy * pitch, gx ** 3, gy ** 3];
  },
};

function ridgeFit(X: number[][], y: number[], lambda: number): number[] {
  const d = (X[0] as number[]).length;
  const A = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  const b = new Array<number>(d).fill(0);
  for (let i = 0; i < X.length; i++) {
    const xi = X[i] as number[];
    for (let j = 0; j < d; j++) {
      b[j] = (b[j] as number) + (xi[j] as number) * (y[i] as number);
      const Aj = A[j] as number[];
      for (let k = 0; k < d; k++) Aj[k] = (Aj[k] as number) + (xi[j] as number) * (xi[k] as number);
    }
  }
  for (let j = 0; j < d; j++)
    (A[j] as number[])[j] = ((A[j] as number[])[j] as number) + lambda * X.length;
  // Gauss-Jordan, same as the shipped solver.
  const M = A.map((row, i) => [...row, b[i] as number]);
  for (let c = 0; c < d; c++) {
    let p = c;
    for (let r = c + 1; r < d; r++)
      if (Math.abs((M[r] as number[])[c] as number) > Math.abs((M[p] as number[])[c] as number))
        p = r;
    [M[c], M[p]] = [M[p] as number[], M[c] as number[]];
    const cur = M[c] as number[];
    const pivot = (cur[c] as number) || 1e-9;
    for (let r = 0; r < d; r++) {
      if (r === c) continue;
      const row = M[r] as number[];
      const f = (row[c] as number) / pivot;
      for (let k = c; k <= d; k++) row[k] = (row[k] as number) - f * (cur[k] as number);
    }
  }
  return M.map((row, i) => (row[d] as number) / ((row[i] as number) || 1e-9));
}

/**
 * @param standardize z-score features against the calibration set before
 * expanding the basis. The shipped pipeline does not do this, and because raw
 * features are O(0.1) the squared/cubic columns are O(1e-2)..O(1e-3) — ridge's
 * uniform penalty then annihilates exactly the terms that were added for
 * expressiveness.
 */
function ablation(
  name: string,
  basisFn: Basis,
  lambda: number,
  drift: number,
  standardize = false,
) {
  const sim = new GazeSimulator({ ...DEFAULT_SIM, seed: 21, headDrift: drift });
  const groups: CalibSample[][] = [];
  let t = 0;
  for (const p of layout(9)) {
    const target = { x: p.x * W, y: p.y * H };
    t += 900;
    const group: CalibSample[] = [];
    for (let e = 0; e < 1100; e += FRAME_MS) {
      group.push({ features: sim.features(target, t).vector, target });
      t += FRAME_MS;
    }
    groups.push(group);
  }
  const clean = rejectOutliers(groups);

  const dims = (clean[0] as CalibSample).features.length;
  const mean = new Array<number>(dims).fill(0);
  const std = new Array<number>(dims).fill(1);
  if (standardize) {
    for (const s of clean)
      for (let d = 0; d < dims; d++) mean[d] = (mean[d] as number) + (s.features[d] as number);
    for (let d = 0; d < dims; d++) mean[d] = (mean[d] as number) / clean.length;
    const v = new Array<number>(dims).fill(0);
    for (const s of clean)
      for (let d = 0; d < dims; d++)
        v[d] = (v[d] as number) + ((s.features[d] as number) - (mean[d] as number)) ** 2;
    for (let d = 0; d < dims; d++) std[d] = Math.sqrt((v[d] as number) / clean.length) || 1;
  }
  const z = (f: number[]) => f.map((v, d) => (v - (mean[d] as number)) / (std[d] as number));

  const X = clean.map((s) => basisFn(z(s.features)));
  const wx = ridgeFit(
    X,
    clean.map((s) => s.target.x),
    lambda,
  );
  const wy = ridgeFit(
    X,
    clean.map((s) => s.target.y),
    lambda,
  );
  const pred = (f: number[]) => {
    const b = basisFn(z(f));
    let x = 0;
    let y = 0;
    for (let i = 0; i < b.length; i++) {
      x += (b[i] as number) * (wx[i] as number);
      y += (b[i] as number) * (wy[i] as number);
    }
    return { x, y };
  };

  const errs: number[] = [];
  const jit: number[] = [];
  for (let gx = 0; gx < 5; gx++) {
    for (let gy = 0; gy < 5; gy++) {
      const target = { x: (0.15 + 0.175 * gx) * W, y: (0.15 + 0.175 * gy) * H };
      t += 300;
      const pts: { x: number; y: number }[] = [];
      for (let e = 0; e < 600; e += FRAME_MS) {
        const p = pred(sim.features(target, t).vector);
        errs.push(Math.hypot(p.x - target.x, p.y - target.y));
        pts.push(p);
        t += FRAME_MS;
      }
      const mx = pts.reduce((a, b) => a + b.x, 0) / pts.length;
      const my = pts.reduce((a, b) => a + b.y, 0) / pts.length;
      jit.push(
        Math.sqrt(pts.reduce((a, b) => a + (b.x - mx) ** 2 + (b.y - my) ** 2, 0) / pts.length),
      );
    }
  }
  return {
    name: standardize ? `${name} + z-score` : name,
    lambda,
    meanPx: errs.reduce((a, b) => a + b, 0) / errs.length,
    jitterPx: jit.reduce((a, b) => a + b, 0) / jit.length,
  };
}

const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "n/a");

function main() {
  console.log(`# Gaze core baseline (synthetic, ${W}x${H}, ${(1000 / FRAME_MS).toFixed(0)} fps)\n`);

  console.log("## Calibration layouts");
  console.log("| layout | samples kept | calib duration | mean error px | p95 error px |");
  console.log("|---|---|---|---|---|");
  let ref: ReturnType<typeof fitModel> | null = null;
  for (const n of [5, 9, 13, 17] as const) {
    const sim = new GazeSimulator({ ...DEFAULT_SIM, seed: 7 });
    const c = calibrate(n, sim);
    const a = accuracy(c.model, sim, c.endT);
    if (n === 9) ref = c.model;
    console.log(
      `| ${n}-point | ${c.samples} | ${fmt(c.endT / 1000)}s | ${fmt(a.meanPx)} | ${fmt(a.p95Px)} |`,
    );
  }

  const model = ref as ReturnType<typeof fitModel>;
  console.log("\n## Stabilizer sweep (9-point model)");
  console.log(
    "| smoothing | raw jitter px | filtered jitter px | latency ms | settle ms | tracking err px |",
  );
  console.log("|---|---|---|---|---|---|");
  for (const s of [0, 0.25, 0.55, 0.75, 0.85, 0.9, 1]) {
    const sim = new GazeSimulator({ ...DEFAULT_SIM, seed: 11 });
    const r = stability(model, sim, s, 0);
    console.log(
      `| ${s} | ${fmt(r.rawJitterPx)} | ${fmt(r.filteredJitterPx)} | ${fmt(r.latencyMs)} | ${fmt(r.settleMs)} | ${fmt(r.trackingErrorPx)} |`,
    );
  }

  console.log("\n## Head-drift sensitivity (9-point model, smoothing 0.55)");
  console.log("| head drift rad | mean error px | p95 error px |");
  console.log("|---|---|---|");
  for (const d of [0, 0.05, 0.12, 0.25]) {
    const sim = new GazeSimulator({ ...DEFAULT_SIM, seed: 13, headDrift: d });
    const c = calibrate(9, sim);
    const a = accuracy(c.model, sim, c.endT);
    console.log(`| ${d} | ${fmt(a.meanPx)} | ${fmt(a.p95Px)} |`);
  }

  console.log("\n## One-euro parameter sweep (9-point model)");
  console.log("`setSmoothing` maps 0..1 to minCutoff 2.5..0.2 with beta 0.02..0.07.");
  console.log("| minCutoff | beta | filtered jitter px | latency ms |");
  console.log("|---|---|---|---|");
  for (const mc of [2.5, 1.2, 0.5, 0.2]) {
    for (const beta of [0.0425, 1e-3, 1e-4, 0]) {
      const sim = new GazeSimulator({ ...DEFAULT_SIM, seed: 11 });
      const r = stability(model, sim, 0.55, 0, oneEuro2D(mc, beta));
      console.log(`| ${mc} | ${beta} | ${fmt(r.filteredJitterPx)} | ${fmt(r.latencyMs)} |`);
    }
  }

  console.log("\n## Basis / regularisation ablation (9-point, no head drift)");
  console.log("| basis | lambda | mean error px | fixation jitter px |");
  console.log("|---|---|---|---|");
  for (const [name, fn] of Object.entries(BASES)) {
    for (const lambda of [1e-3, 1e-2, 1e-1]) {
      for (const zs of [false, true]) {
        const r = ablation(name, fn, lambda, 0, zs);
        console.log(`| ${r.name} | ${lambda} | ${fmt(r.meanPx)} | ${fmt(r.jitterPx)} |`);
      }
    }
  }

  console.log("\n## Basis ablation with head drift (0.05 rad)");
  console.log("| basis | lambda | mean error px | fixation jitter px |");
  console.log("|---|---|---|---|");
  for (const [name, fn] of Object.entries(BASES)) {
    for (const zs of [false, true]) {
      const r = ablation(name, fn, 1e-3, 0.05, zs);
      console.log(`| ${r.name} | ${r.lambda} | ${fmt(r.meanPx)} | ${fmt(r.jitterPx)} |`);
    }
  }

  console.log("\n## Per-frame cost");
  const sim = new GazeSimulator({ ...DEFAULT_SIM, seed: 3 });
  console.log(`predict + stabilize: ${fmt(cost(model, sim), 2)} µs/frame`);
}

main();
