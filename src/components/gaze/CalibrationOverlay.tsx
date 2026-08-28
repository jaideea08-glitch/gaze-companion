import type { Vec2 } from "@/lib/gaze/types";

interface Props {
  point: Vec2 | null;
  index: number;
  total: number;
}

export function CalibrationOverlay({ point, index, total }: Props) {
  if (!point) return null;
  return (
    <div className="fixed inset-0 z-[9998] bg-background">
      <p className="absolute inset-x-0 top-10 text-center text-lg font-medium text-muted-foreground">
        Look at the glowing dot and keep looking until it disappears — point {index + 1} of {total}
      </p>
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: point.x, top: point.y }}
      >
        <span className="absolute inset-0 -m-8 animate-ping rounded-full bg-accent/25" />
        <span className="relative block size-10 rounded-full bg-accent shadow-glow" />
        <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
      </div>
    </div>
  );
}
