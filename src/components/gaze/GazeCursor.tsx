import type { Vec2 } from "@/lib/gaze/types";

interface Props {
  pos: Vec2;
  progress: number;
  intent: number;
  visible: boolean;
  held: boolean;
}

export function GazeCursor({ pos, progress, intent, visible, held }: Props) {
  if (!visible) return null;
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2 transition-opacity"
      style={{ left: pos.x, top: pos.y, opacity: held ? 0.4 : 1 }}
    >
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} className="fill-none stroke-gaze-ring" strokeWidth="4" />
        <circle
          cx="32"
          cy="32"
          r={r}
          className="fill-none stroke-gaze-progress"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          transform="rotate(-90 32 32)"
          opacity={intent > 0.4 ? 1 : 0.45}
        />
        <circle cx="32" cy="32" r="6" className="fill-gaze-dot" />
      </svg>
    </div>
  );
}
