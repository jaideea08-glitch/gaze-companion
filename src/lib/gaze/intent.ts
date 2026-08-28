import type { Vec2 } from "./types";

/**
 * Intent scoring separates "reading/looking" from "trying to activate".
 * No single signal is trusted: a long look at a large element during scanning
 * should not fire, while a settled, stable, re-visited fixation on a control
 * should. Weights were chosen to bias heavily against false activation.
 */
export interface IntentInput {
  stability: number; // px std-dev during current fixation (lower = better)
  dwellFraction: number; // 0..1 progress through required dwell
  confidence: number; // tracker confidence
  targetArea: number; // px^2
  revisits: number; // times gaze returned to this target recently
  approachSpeed: number; // px/s at entry (slower = more deliberate)
}

export function intentScore(i: IntentInput): number {
  const stab = clamp01(1 - i.stability / 90);
  const dwell = clamp01(i.dwellFraction);
  const conf = clamp01(i.confidence);
  const size = clamp01(1 - Math.min(1, i.targetArea / 160000)) * 0.5 + 0.5;
  const revisit = clamp01(i.revisits / 3) * 0.5 + 0.5;
  const deliberate = clamp01(1 - i.approachSpeed / 2500);

  return clamp01(
    0.3 * stab + 0.3 * dwell + 0.15 * conf + 0.1 * size + 0.08 * deliberate + 0.07 * revisit,
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export class FixationTracker {
  private pts: { p: Vec2; t: number }[] = [];
  push(p: Vec2, t: number) {
    this.pts.push({ p, t });
    let head = this.pts[0];
    while (head && t - head.t > 600) {
      this.pts.shift();
      head = this.pts[0];
    }
  }
  reset() {
    this.pts = [];
  }
  stability() {
    if (this.pts.length < 5) return 999;
    const mx = this.pts.reduce((a, b) => a + b.p.x, 0) / this.pts.length;
    const my = this.pts.reduce((a, b) => a + b.p.y, 0) / this.pts.length;
    return Math.sqrt(
      this.pts.reduce((a, b) => a + (b.p.x - mx) ** 2 + (b.p.y - my) ** 2, 0) / this.pts.length,
    );
  }
  speed() {
    const a = this.pts[0];
    const b = this.pts[this.pts.length - 1];
    if (!a || !b || this.pts.length < 3) return 0;
    const dt = Math.max(0.05, (b.t - a.t) / 1000);
    return Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y) / dt;
  }
}
