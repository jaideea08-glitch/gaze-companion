import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGazeEngine } from "@/hooks/useGazeEngine";
import { GazeCursor } from "@/components/gaze/GazeCursor";
import { GazeButton } from "@/components/gaze/GazeButton";
import { CalibrationOverlay } from "@/components/gaze/CalibrationOverlay";
import { VirtualKeyboard } from "@/components/gaze/VirtualKeyboard";
import { PRESETS } from "@/lib/gaze/presets";
import { emptyProfile, getActiveId, loadProfiles, saveProfiles, setActiveId, wipeAll } from "@/lib/gaze/profiles";
import type { CalibrationModel, InteractionMode, PresetName, Profile, Settings, Vec2 } from "@/lib/gaze/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GazeBridge — Eye-Controlled Assistive Interface" },
      {
        name: "description",
        content:
          "Webcam eye tracking with personalized calibration, adaptive dwell clicking, safe mode and a gaze keyboard for people with motor impairments.",
      },
      { property: "og:title", content: "GazeBridge — Eye-Controlled Assistive Interface" },
      {
        property: "og:description",
        content:
          "Control a computer with your eyes: local webcam gaze tracking, adaptive dwell clicking and gaze typing built for accessibility.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});

type Panel = "keyboard" | "settings" | "profiles" | "about";

function Workspace() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("keyboard");
  const [text, setText] = useState("");
  const [paused, setPaused] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [emergency, setEmergency] = useState(false);
  const clickTimes = useRef<number[]>([]);

  const profile = useMemo(() => profiles.find((p) => p.id === activeId) ?? null, [profiles, activeId]);

  useEffect(() => {
    let list = loadProfiles();
    if (list.length === 0) list = [emptyProfile("Primary user")];
    const id = getActiveId() ?? (list[0] as Profile).id;
    setProfiles(list);
    setActive(id);
    saveProfiles(list);
    setActiveId(id);
  }, []);

  const update = useCallback((patch: Partial<Profile>) => {
    setProfiles((prev) => {
      const next = prev.map((p) => (p.id === getActiveId() ? { ...p, ...patch } : p));
      saveProfiles(next);
      return next;
    });
  }, []);

  const patchSettings = useCallback(
    (patch: Partial<Settings>) => {
      if (!profile) return;
      update({ settings: { ...profile.settings, ...patch } });
    },
    [profile, update],
  );

  const say = useCallback((msg: string) => {
    setLog((l) => [msg, ...l].slice(0, 6));
  }, []);

  /**
   * Activation from dwell. Adaptive dwell: bursts of very fast repeated
   * activations look like accidental clicks, so dwell time is raised; long
   * stretches of clean, spaced activations shorten it — always inside the
   * user's min/max bounds so behavior never becomes surprising.
   */
  const onActivate = useCallback(
    (el: HTMLElement) => {
      if (emergency) return;
      el.click();
      const now = performance.now();
      clickTimes.current.push(now);
      clickTimes.current = clickTimes.current.filter((t) => now - t < 20000);
      const s = profile?.settings;
      if (s?.adaptiveDwell) {
        const rapid = clickTimes.current.filter((t, i, a) => i > 0 && t - (a[i - 1] as number) < 900).length;
        let dwell = s.dwellMs;
        if (rapid >= 2) dwell = Math.min(s.maxDwellMs, s.dwellMs + 150);
        else if (clickTimes.current.length >= 6) dwell = Math.max(s.minDwellMs, s.dwellMs - 40);
        if (dwell !== s.dwellMs) patchSettings({ dwellMs: dwell });
      }
      if (profile) update({ stats: { ...profile.stats, clicks: profile.stats.clicks + 1 } });
    },
    [emergency, patchSettings, profile, update],
  );

  const onCalibrated = useCallback(
    (m: CalibrationModel) => {
      update({ calibration: m });
      const errs = Object.values(m.regionError);
      const avg = errs.reduce((a, b) => a + b, 0) / Math.max(1, errs.length);
      say(`Calibration saved — average error ${Math.round(avg)} px across ${errs.length} regions.`);
    },
    [say, update],
  );

  const engine = useGazeEngine(profile, onActivate, onCalibrated);
  const { state } = engine;

  useEffect(() => {
    engine.setPaused(paused || emergency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, emergency]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmergency((v) => !v);
      if (e.key === " " && e.ctrlKey) setPaused((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const calibrate = useCallback(
    async (regions?: number[]) => {
      const pts = calibrationPoints(regions);
      const m = await engine.runCalibration(pts, profile?.calibration ?? null);
      if (!m) say("Not enough clean samples — try again with steadier lighting.");
    },
    [engine, profile, say],
  );

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  }, [text]);

  const settings = profile?.settings;
  const running = state.status === "running" || state.status === "paused";
  const worstRegions = useMemo(() => {
    const re = profile?.calibration?.regionError ?? {};
    return Object.entries(re)
      .filter(([, v]) => v > 90)
      .map(([k]) => Number(k));
  }, [profile]);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <video ref={engine.videoRef} className="sr-only" playsInline muted />

      <CalibrationOverlay point={engine.calibPoint} index={engine.calibIndex} total={engine.calibTotal} />
      <GazeCursor
        pos={state.cursor}
        progress={state.dwellProgress}
        intent={state.intent}
        visible={Boolean(settings?.showGazeDot) && running && !engine.calibrating}
        held={paused || emergency || state.confidence < (settings?.minConfidence ?? 0.35)}
      />

      <header className="border-b-2 border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="mr-auto text-2xl font-bold tracking-tight">
            Gaze<span className="text-primary">Bridge</span>
          </h1>
          <ModeBadge mode={emergency ? "stopped" : paused ? "paused" : (settings?.mode ?? "normal")} />
          <StatusChip label="Camera" value={running ? "on" : "off"} ok={running} />
          <StatusChip label="Confidence" value={`${Math.round(state.confidence * 100)}%`} ok={state.confidence > (settings?.minConfidence ?? 0.35)} />
          <StatusChip label="FPS" value={String(state.fps)} ok={state.fps >= 18} />
        </div>
      </header>

      {/* Accessibility toolbar — itself fully gaze-operable */}
      <nav aria-label="Accessibility toolbar" className="border-b-2 border-border bg-sidebar">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-3">
          {!running ? (
            <GazeButton variant="solid" onClick={() => void engine.start()}>
              Start camera
            </GazeButton>
          ) : (
            <GazeButton onClick={engine.stop}>Stop camera</GazeButton>
          )}
          <GazeButton variant="solid" onClick={() => void calibrate()} aria-label="Run full calibration">
            Calibrate
          </GazeButton>
          {worstRegions.length > 0 && (
            <GazeButton onClick={() => void calibrate(worstRegions)}>
              Fix {worstRegions.length} weak {worstRegions.length === 1 ? "area" : "areas"}
            </GazeButton>
          )}
          <GazeButton active={paused} onClick={() => setPaused((v) => !v)}>
            {paused ? "Resume" : "Pause"}
          </GazeButton>
          <GazeButton
            active={settings?.mode === "safe"}
            onClick={() => patchSettings({ mode: cycleMode(settings?.mode ?? "normal") })}
          >
            Mode: {settings?.mode ?? "normal"}
          </GazeButton>
          <span className="grow" />
          <GazeButton active={panel === "keyboard"} onClick={() => setPanel("keyboard")}>
            Keyboard
          </GazeButton>
          <GazeButton active={panel === "settings"} onClick={() => setPanel("settings")}>
            Settings
          </GazeButton>
          <GazeButton active={panel === "profiles"} onClick={() => setPanel("profiles")}>
            Profiles
          </GazeButton>
          <GazeButton active={panel === "about"} onClick={() => setPanel("about")}>
            How it works
          </GazeButton>
          <GazeButton variant="danger" onClick={() => setEmergency((v) => !v)}>
            {emergency ? "Resume control" : "Emergency stop"}
          </GazeButton>
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {!profile?.calibration && (
            <p className="rounded-xl border-2 border-accent bg-card p-4 text-lg">
              Start the camera, then run <strong>Calibrate</strong>. Nine dots appear one at a time — look at each
              until it disappears. Everything runs locally in your browser; no video leaves this device.
            </p>
          )}

          {panel === "keyboard" && <VirtualKeyboard text={text} onChange={setText} onSpeak={speak} />}
          {panel === "settings" && settings && (
            <SettingsPanel settings={settings} onPatch={patchSettings} onPreset={(p) => update({ preset: p, settings: { ...PRESETS[p].settings } })} preset={profile?.preset ?? "standard"} />
          )}
          {panel === "profiles" && (
            <ProfilesPanel
              profiles={profiles}
              activeId={activeId}
              onSelect={(id) => {
                setActive(id);
                setActiveId(id);
              }}
              onCreate={() => {
                const p = emptyProfile(`User ${profiles.length + 1}`);
                const next = [...profiles, p];
                setProfiles(next);
                saveProfiles(next);
                setActive(p.id);
                setActiveId(p.id);
              }}
              onDeleteAll={() => {
                wipeAll();
                const p = emptyProfile("Primary user");
                setProfiles([p]);
                saveProfiles([p]);
                setActive(p.id);
                setActiveId(p.id);
                say("All local profiles and calibration data deleted.");
              }}
            />
          )}
          {panel === "about" && <AboutPanel />}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border-2 border-border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">Live signals</h2>
            <Meter label="Gaze confidence" value={state.confidence} />
            <Meter label="Intent confidence" value={state.intent} />
            <Meter label="Dwell progress" value={state.dwellProgress} />
            <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
              <Row k="Status" v={state.message} />
              <Row k="Looking at" v={state.targetLabel ?? "—"} />
              <Row k="Jitter" v={`${state.jitter.toFixed(1)} px`} />
              <Row k="Dwell time" v={`${settings?.dwellMs ?? 0} ms`} />
              <Row k="Activations" v={String(profile?.stats.clicks ?? 0)} />
            </dl>
          </section>

          <section className="rounded-2xl border-2 border-border bg-card p-4">
            <h2 className="mb-2 text-lg font-semibold">Calibration map</h2>
            <RegionGrid errors={profile?.calibration?.regionError ?? {}} />
            <p className="mt-2 text-sm text-muted-foreground">
              Green areas are accurate. Amber or red areas can be re-calibrated on their own.
            </p>
          </section>

          {log.length > 0 && (
            <section aria-live="polite" className="rounded-2xl border-2 border-border bg-card p-4 text-sm">
              {log.map((l, i) => (
                <p key={i} className="mb-1 text-muted-foreground">
                  {l}
                </p>
              ))}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function cycleMode(m: InteractionMode): InteractionMode {
  return m === "normal" ? "safe" : m === "safe" ? "navigation" : "normal";
}

function calibrationPoints(regions?: number[]): Vec2[] {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const xs = [0.1, 0.5, 0.9];
  const ys = [0.12, 0.5, 0.88];
  const pts: Vec2[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      if (regions && !regions.includes(idx)) continue;
      pts.push({ x: (xs[c] as number) * w, y: (ys[r] as number) * h });
    }
  }
  return pts.sort(() => Math.random() - 0.5);
}

function ModeBadge({ mode }: { mode: string }) {
  const tone =
    mode === "stopped" ? "bg-destructive text-destructive-foreground" : mode === "normal" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground";
  return <span className={`rounded-lg px-3 py-2 text-sm font-bold uppercase ${tone}`}>{mode}</span>;
}

function StatusChip({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <span className="rounded-lg border-2 border-border px-3 py-2 text-sm">
      {label}: <strong className={ok ? "text-primary" : "text-muted-foreground"}>{value}</strong>
    </span>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{k}</dt>
      <dd className="truncate text-foreground">{v}</dd>
    </div>
  );
}

function RegionGrid({ errors }: { errors: Record<number, number> }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 9 }, (_, i) => {
        const e = errors[i];
        const tone = e === undefined ? "bg-muted" : e < 60 ? "bg-primary" : e < 120 ? "bg-accent" : "bg-destructive";
        return (
          <div key={i} className={`flex h-12 items-center justify-center rounded-md ${tone} text-xs font-semibold text-background`}>
            {e === undefined ? "—" : `${Math.round(e)}px`}
          </div>
        );
      })}
    </div>
  );
}

function SettingsPanel({
  settings,
  preset,
  onPatch,
  onPreset,
}: {
  settings: Settings;
  preset: PresetName;
  onPatch: (p: Partial<Settings>) => void;
  onPreset: (p: PresetName) => void;
}) {
  return (
    <section className="space-y-5 rounded-2xl border-2 border-border bg-card p-5">
      <div>
        <h2 className="mb-3 text-xl font-semibold">Accessibility presets</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as PresetName[]).map((k) => (
            <GazeButton key={k} active={preset === k} onClick={() => onPreset(k)}>
              {PRESETS[k].label}
            </GazeButton>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{PRESETS[preset].description}</p>
      </div>

      <Slider label="Smoothing" hint="Higher = steadier cursor, slightly slower" value={settings.smoothing} min={0} max={1} step={0.05} onChange={(v) => onPatch({ smoothing: v })} />
      <Slider label="Dwell time (ms)" hint="How long to look before it activates" value={settings.dwellMs} min={400} max={4000} step={50} onChange={(v) => onPatch({ dwellMs: v })} />
      <Slider label="Snap strength" hint="Pull toward the centre of buttons" value={settings.snapStrength} min={0} max={1} step={0.05} onChange={(v) => onPatch({ snapStrength: v })} />
      <Slider label="Snap radius (px)" value={settings.snapRadius} min={0} max={250} step={10} onChange={(v) => onPatch({ snapRadius: v })} />
      <Slider label="Intent threshold" hint="Higher = fewer accidental activations" value={settings.intentThreshold} min={0.3} max={0.95} step={0.01} onChange={(v) => onPatch({ intentThreshold: v })} />
      <Slider label="Minimum confidence" value={settings.minConfidence} min={0.1} max={0.8} step={0.05} onChange={(v) => onPatch({ minConfidence: v })} />

      <div className="flex flex-wrap gap-2">
        <GazeButton active={settings.adaptiveDwell} onClick={() => onPatch({ adaptiveDwell: !settings.adaptiveDwell })}>
          Adaptive dwell: {settings.adaptiveDwell ? "on" : "off"}
        </GazeButton>
        <GazeButton active={settings.showGazeDot} onClick={() => onPatch({ showGazeDot: !settings.showGazeDot })}>
          Gaze pointer: {settings.showGazeDot ? "shown" : "hidden"}
        </GazeButton>
        <GazeButton active={settings.adaptiveCalibration} onClick={() => onPatch({ adaptiveCalibration: !settings.adaptiveCalibration })}>
          Learn while I use it: {settings.adaptiveCalibration ? "on" : "off"}
        </GazeButton>
      </div>
    </section>
  );
}

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-base font-medium">
        <span>{label}</span>
        <span className="text-muted-foreground">{value}</span>
      </label>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-2 flex items-center gap-2">
        <GazeButton aria-label={`Decrease ${label}`} onClick={() => onChange(round(Math.max(min, value - step), step))}>
          −
        </GazeButton>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-3 grow accent-primary"
        />
        <GazeButton aria-label={`Increase ${label}`} onClick={() => onChange(round(Math.min(max, value + step), step))}>
          +
        </GazeButton>
      </div>
    </div>
  );
}

function round(v: number, step: number) {
  return Math.round(v / step) * step;
}

function ProfilesPanel({
  profiles,
  activeId,
  onSelect,
  onCreate,
  onDeleteAll,
}: {
  profiles: Profile[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDeleteAll: () => void;
}) {
  return (
    <section className="space-y-4 rounded-2xl border-2 border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Profiles</h2>
      <ul className="space-y-2">
        {profiles.map((p) => (
          <li key={p.id}>
            <GazeButton className="w-full justify-start" active={p.id === activeId} onClick={() => onSelect(p.id)}>
              {p.name} — {PRESETS[p.preset].label} {p.calibration ? "· calibrated" : "· not calibrated"}
            </GazeButton>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <GazeButton variant="solid" onClick={onCreate}>
          New profile
        </GazeButton>
        <GazeButton variant="danger" onClick={onDeleteAll}>
          Delete all stored data
        </GazeButton>
      </div>
      <p className="text-sm text-muted-foreground">
        Profiles hold only numbers: calibration coefficients, timings and preferences. They live in this browser's
        local storage and are never uploaded.
      </p>
    </section>
  );
}

function AboutPanel() {
  return (
    <section className="space-y-4 rounded-2xl border-2 border-border bg-card p-5 text-base leading-relaxed">
      <h2 className="text-xl font-semibold">How GazeBridge works</h2>
      <p>
        <strong>Tracking.</strong> MediaPipe Face Landmarker runs in this browser and returns 478 facial points
        including both irises, plus a head-pose matrix. Iris position is measured relative to each eye's corners, so
        small head movement does not immediately break calibration.
      </p>
      <p>
        <strong>Calibration.</strong> Nine dots collect roughly a second of samples each. Outliers are dropped using a
        median-absolute-deviation test, then ridge regression fits a smooth mapping from eye features to screen
        coordinates. Accuracy is scored per screen region, so only the weak regions need re-doing.
      </p>
      <p>
        <strong>Stabilization.</strong> A one-euro filter smooths hard while you hold still and loosens when you look
        somewhere new — low jitter without feeling sluggish.
      </p>
      <p>
        <strong>Intent.</strong> Looking is not clicking. An intent score combines fixation stability, dwell progress,
        tracking confidence, target size, approach speed and repeat visits. Activation needs both a full dwell and
        enough intent, which is what keeps reading from firing buttons.
      </p>
      <p>
        <strong>Safety.</strong> Escape toggles emergency stop, Ctrl+Space pauses. If the face is lost or confidence
        drops, the cursor freezes instead of drifting. Safe mode points without clicking.
      </p>
      <p>
        <strong>Privacy.</strong> Video never leaves the device and is never recorded — only derived numbers are kept,
        and you can delete them at any time from Profiles.
      </p>
    </section>
  );
}
