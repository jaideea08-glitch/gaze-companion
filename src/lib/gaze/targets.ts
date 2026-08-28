import type { Vec2 } from "./types";

export interface GazeTarget {
  el: HTMLElement;
  rect: DOMRect;
  center: Vec2;
}

/**
 * Target discovery uses the DOM accessibility surface (roles + focusable
 * elements) rather than pixel/OCR guessing: semantics are exact, free, and
 * always in sync with what is rendered.
 */
export function collectTargets(root: ParentNode = document): GazeTarget[] {
  const nodes = root.querySelectorAll<HTMLElement>("[data-gaze-target]");
  const out: GazeTarget[] = [];
  nodes.forEach((el) => {
    if (el.getAttribute("aria-disabled") === "true") return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    out.push({ el, rect, center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } });
  });
  return out;
}

export function hitTest(p: Vec2, targets: GazeTarget[]): GazeTarget | null {
  for (const t of targets) {
    if (p.x >= t.rect.left && p.x <= t.rect.right && p.y >= t.rect.top && p.y <= t.rect.bottom) return t;
  }
  return null;
}

/** Nearest target within radius, with a hysteresis bonus for the current one. */
export function nearest(p: Vec2, targets: GazeTarget[], radius: number, sticky?: HTMLElement | null) {
  let best: GazeTarget | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const dx = Math.max(t.rect.left - p.x, 0, p.x - t.rect.right);
    const dy = Math.max(t.rect.top - p.y, 0, p.y - t.rect.bottom);
    let d = Math.hypot(dx, dy);
    if (sticky && t.el === sticky) d *= 0.6;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return bestD <= radius ? best : null;
}

/**
 * Gentle magnetic pull toward the target center. Never a jump: the cursor is
 * interpolated so movement stays predictable, which matters more than raw
 * accuracy for users who rely on visual tracking of the pointer.
 */
export function snap(p: Vec2, target: GazeTarget | null, strength: number): Vec2 {
  if (!target || strength <= 0) return p;
  const dx = Math.max(target.rect.left - p.x, 0, p.x - target.rect.right);
  const dy = Math.max(target.rect.top - p.y, 0, p.y - target.rect.bottom);
  const dist = Math.hypot(dx, dy);
  const inside = dist === 0;
  const k = inside ? strength * 0.35 : strength * 0.6;
  return { x: p.x + (target.center.x - p.x) * k, y: p.y + (target.center.y - p.y) * k };
}
