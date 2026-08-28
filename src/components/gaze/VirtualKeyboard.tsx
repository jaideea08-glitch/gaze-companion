import { useMemo } from "react";
import { GazeButton } from "./GazeButton";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "'"],
  ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "?"],
];

const DICT = [
  "hello","help","please","thank","thanks","yes","no","water","food","hungry","thirsty","tired",
  "pain","doctor","nurse","bathroom","later","now","more","stop","start","good","bad","today",
  "tomorrow","family","music","television","cold","hot","comfortable","uncomfortable","message",
];

interface Props {
  text: string;
  onChange: (t: string) => void;
  onSpeak: () => void;
}

export function VirtualKeyboard({ text, onChange, onSpeak }: Props) {
  const suggestions = useMemo(() => {
    const parts = text.split(/\s+/);
    const frag = (parts[parts.length - 1] ?? "").toLowerCase();
    if (!frag) return [];
    return DICT.filter((w) => w.startsWith(frag) && w !== frag).slice(0, 4);
  }, [text]);

  const type = (ch: string) => onChange(text + ch);
  const complete = (word: string) => {
    const parts = text.split(/(\s+)/);
    parts[parts.length - 1] = word + " ";
    onChange(parts.join(""));
  };

  return (
    <section aria-label="Gaze keyboard" className="rounded-2xl border-2 border-border bg-card p-4">
      <output
        aria-live="polite"
        className="mb-3 block min-h-16 w-full rounded-xl bg-muted p-3 text-left text-2xl text-foreground"
      >
        {text || <span className="text-muted-foreground">Look at keys to type…</span>}
      </output>

      <div className="mb-3 flex min-h-14 flex-wrap gap-2">
        {suggestions.map((w) => (
          <GazeButton key={w} variant="solid" onClick={() => complete(w)}>
            {w}
          </GazeButton>
        ))}
      </div>

      <div className="space-y-2">
        {ROWS.map((row, i) => (
          <div key={i} className="flex justify-center gap-2">
            {row.map((k) => (
              <GazeButton key={k} variant="key" className="flex-1" onClick={() => type(k.toLowerCase())}>
                {k}
              </GazeButton>
            ))}
          </div>
        ))}
        <div className="flex justify-center gap-2">
          <GazeButton variant="key" className="flex-[4]" onClick={() => type(" ")} aria-label="Space">
            space
          </GazeButton>
          <GazeButton
            variant="key"
            className="flex-1"
            aria-label="Backspace"
            onClick={() => onChange(text.slice(0, -1))}
          >
            ⌫
          </GazeButton>
          <GazeButton variant="key" className="flex-1" aria-label="Clear all" onClick={() => onChange("")}>
            clear
          </GazeButton>
          <GazeButton variant="solid" className="flex-[2]" aria-label="Speak this text" onClick={onSpeak}>
            speak
          </GazeButton>
        </div>
      </div>
    </section>
  );
}
