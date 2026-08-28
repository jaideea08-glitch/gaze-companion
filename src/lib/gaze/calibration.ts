import type { CalibrationModel, Vec2 } from "./types";

/**
 * Ridge regression over a quadratic-ish basis.
 * Chosen over homography/affine (too rigid for camera+eye nonlinearity) and
 * over neural models (too much data / compute for a 30-second calibration).
 * Ridge keeps it stable with only ~10-20 samples per point.
 */
export function basis(v: number[]): number[] {
  const [gx, gy] = v;
  return [
    1,
    ...v,
    gx * gx,
    gy * gy,
    gx * gy,
    gx * v[6],
    gy * v[7],
    gx * gx * gx,
    gy * gy * gy,
  ];
}

function solve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const pivot = M[c][c] || 1e-9;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / pivot;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i][i] === undefined ? 1 : M[i][i] || 1e-9));
}

function ridge(X: number[][], y: number[], lambda = 1e-3): number[] {
  const d = X[0].length;
  const A: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  const b = new Array(d).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let j = 0; j < d; j++) {
      b[j] += X[i][j] * y[i];
      for (let k = 0; k < d; k++) A[j][k] += X[i][j] * X[i][k];
    }
  }
  for (let j = 0; j < d; j++) A[j][j] += lambda * X.length;
  return solve(A, b);
}

export interface CalibSample {
  features: number[];
  target: Vec2;
}

/** Median-absolute-deviation outlier rejection per calibration point. */
export function rejectOutliers(samples: CalibSample[][]): CalibSample[] {
  const out: CalibSample[] = [];
  for (const group of samples) {
    if (group.length === 0) continue;
    const dims = group[0].features.length;
    const med = new Array(dims).fill(0).map((_, d) => median(group.map((s) => s.features[d])));
    const dist = group.map((s) => Math.hypot(...s.features.map((f, d) => f - med[d])));
    const mad = median(dist) || 1e-6;
    group.forEach((s, i) => {
      if (dist[i] <= mad * 2.5) out.push(s);
    });
  }
  return out;
}

function median(a: number[]) {
  const s = [...a].sort((p, q) => p - q);
  return s[Math.floor(s.length / 2)] ?? 0;
}

export function regionOf(p: Vec2, w: number, h: number) {
  const c = Math.min(2, Math.floor((p.x / w) * 3));
  const r = Math.min(2, Math.floor((p.y / h) * 3));
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
    const px = dot(X[i], wx);
    const py = dot(X[i], wy);
    const reg = regionOf(s.target, w, h);
    (acc[reg] ??= []).push(Math.hypot(px - s.target.x, py - s.target.y));
  });
  for (const k of Object.keys(acc)) {
    const arr = acc[Number(k)];
    regionError[Number(k)] = arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  return { wx, wy, createdAt: Date.now(), regionError, pointCount: samples.length };
}

function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function predict(model: CalibrationModel, features: number[]): Vec2 {
  const b = basis(features);
  return { x: dot(b, model.wx), y: dot(b, model.wy) };
}
