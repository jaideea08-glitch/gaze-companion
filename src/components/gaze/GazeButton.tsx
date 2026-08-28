import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "solid" | "outline" | "danger" | "key";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
}

const styles: Record<Variant, string> = {
  solid: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline: "border-2 border-border bg-card text-card-foreground hover:bg-muted",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  key: "bg-card text-card-foreground border-2 border-border hover:bg-muted font-semibold",
};

/**
 * Every interactive control is registered as a gaze target and sized to a
 * generous minimum so gaze error (~2-4 cm) still lands inside it.
 */
export const GazeButton = forwardRef<HTMLButtonElement, Props>(function GazeButton(
  { variant = "outline", active, className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      data-gaze-target=""
      className={cn(
        "inline-flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-xl px-4 text-base transition-colors",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
        "data-[gaze-hover=true]:ring-4 data-[gaze-hover=true]:ring-accent",
        styles[variant],
        active && "ring-4 ring-accent",
        className,
      )}
      {...props}
    />
  );
});
