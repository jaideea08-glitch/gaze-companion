import type { CalibrationModel, Vec2 } from "./types";

const n = (v: number | undefined) => v ?? 0;

/**
 * Ridge regression over a quadratic/cubic basis.
 * Chosen over homography/affine (too rigid for camera + eye nonlinearity) and
 * over neural models (too much data/compute for a 30-second calibration).
 * Ridge stays stable with only ~10-20 samples per calibration point.
 */
export function basis(v: number[]): number[] {
  const gx = n(v[0]);
  const gy = n(v[1]);
  const yaw = n(v[6]);
  const pitch = n(v[7]);
  return [
    1,
    ...v.map(n),
    gx * gx,
    gy * gy,
    gx * gy,
    gx * yaw,
    gy * pitch,
    gx * gx * gx,
    gy * gy * gy,
  ];
}

function solve(A: number[][], b: number[]): number[] {
  const size = A.length;
  const M: number[][] = A.map((row, i) => [...row, n(b[i])]);
  for (let c = 0; c < size; c++) {
    let p = c;
    for (let r = c + 1; r < size; r++) {
      if (Math.abs(n(M[r]?.[c])) > Math.abs(n(M[p]?.[c]))) p = r;
    }
    const rowC = M[c] as number[];
    const rowP = M[p] as number[];
    M[c] = rowP;
    M[p] = rowC;
    const cur = M[c] as number[];
    const pivot = n(cur[c]) || 1e-9;
    for (let r = 0; r < size; r++) {
      if (r === c) continue;
      const row = M[r] as number[];
      const f = n(row[c]) / pivot;
      for (let k = c; k <= size; k++) row[k] = n(row[k]) - f * n(cur[k]);
    }
  }
  return M.map((row, i) => n(row[size]) / (n(row[i]) || 1e-9));
}

function ridge(X: number[][], y: number[], lambda = 1e-3): number[] {
  const d = (X[0] as number[]).length;
  const A: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  const b = new Array<number>(d).fill(0);
  for (let i = 0; i < X.length; i++) {
    const xi = X[i] as number[];
    const yi = n(y[i]);
    for (let j = 0; j < d; j++) {
      b[j] = n(b[j]) + n(xi[j]) * yi;
      const Aj = A[j] as number[];
      for (let k = 0; k < d; k++) Aj[k] = n(Aj[k]) + n(xi[j]) * n(xi[k]);
    }
  }
  for (let j = 0; j < d; j++) {
    const Aj = A[j] as number[];
    Aj[j] = n(Aj[j]) + lambda * X.length;
  }
  return solve(A, b);
}

export interface CalibSample {
  features: number[];
  target: Vec2;
}

/** Median-absolute-deviation outlier rejection, per calibration point. */
export function rejectOutliers(groups: CalibSample[][]): CalibSample[] {
  const out: CalibSample[] = [];
  for (const group of groups) {
    const first = group[0];
    if (!first) continue;
    const dims = first.features.length;
    const med = Array.from({ length: dims }, (_, d) => median(group.map((s) => n(s.features[d]))));
    const dist = group.map((s) =>
      Math.hypot(...s.features.map((f, d) => f - n(med[d]))),
    );
    const mad = median(dist) || 1e-6;
    group.forEach((s, i) => {
      if (n(dist[i]) <= mad * 2.5) out.push(s);
    });
  }
  return out;
}

function median(a: number[]) {
  const s = [...a].sort((p, q) => p - q);
  return n(s[Math.floor(s.length / 2)]);
}

export function regionOf(p: Vec2, w: number, h: number) {
  const c = Math.min(2, Math.max(0, Math.floor((p.x / w) * 3)));
  const r = Math.min(2, Math.max(0, Math.floor((p.y / h) * 3)));
  return r * 3 + c;
}

export function fitModel(
  samples: CalibSample[],
  w: number,
  h: number,
  previous?: CalibrationModel | null,
): CalibrationModel {
  const X = samples.map((s) => basis(s.features));
  const wx = ridge(X, samples.map((s) => s.target.x));
  const wy = ridge(X, samples.map((s) => s.target.y));

  const regionError: Record<number, number> = { ...(previous?.regionError ?? {}) };
  const acc: Record<number, number[]> = {};
  samples.forEach((s, i) => {
    const bx = X[i] as number[];
    const px = dot(bx, wx);
    const py = dot(bx, wy);
    const reg = regionOf(s.target, w, h);
    (acc[reg] ??= []).push(Math.hypot(px - s.target.x, py - s.target.y));
  });
  for (const key of Object.keys(acc)) {
    const arr = acc[Number(key)] ?? [];
    regionError[Number(key)] = arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  }

  return { wx, wy, createdAt: Date.now(), regionError, pointCount: samples.length };
}

function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += n(a[i]) * n(b[i]);
  return s;
}

export function predict(model: CalibrationModel, features: number[]): Vec2 {
  const b = basis(features);
  return { x: dot(b, model.wx), y: dot(b, model.wy) };
}
