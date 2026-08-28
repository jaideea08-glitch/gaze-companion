# 04 — Migration strategy

## Principle

Do not rewrite. Extract, pin behaviour with tests, fix against the tests, then
grow platforms around the extracted core. At no point should `main` stop
building the web app — it is Lovable-connected and must stay green.

## Step 0 — safety net before touching algorithms

1. Add `bun run typecheck` (`tsc --noEmit`) and a test runner (`bun test`).
2. Add CI: install, lint, typecheck, test, build. Fix the 60 pre-existing
   Prettier errors in one isolated formatting-only commit so later diffs are
   readable.
3. Record **golden vectors**: run the benchmark simulator, and separately a few
   real webcam sessions, and freeze the resulting feature traces as JSON
   fixtures (`fixtures/traces/*.json`). These contain landmark-derived features
   only — never frames.
4. Freeze current outputs for those traces as the reference. Every later change
   is judged as a delta against them by the benchmark, not by feel.

## Step 1 — extract the core, still in TypeScript

Move the pure algorithm code out of `src/lib/gaze` into `packages/core-ts` with
a single explicit interface and **no** DOM, React, MediaPipe or browser types:

```ts
interface GazeCore {
  reset(): void;
  pushSample(f: GazeFeatures, tMs: number): CoreOutput;   // filtered point + confidence + state
  beginCalibration(layout: CalibrationLayout): void;
  pushCalibrationSample(f: GazeFeatures, target: Vec2, tMs: number): void;
  finishCalibration(): CalibrationResult;
  loadModel(m: CalibrationModel): void;
  exportModel(): CalibrationModel;
}
```

Target discovery, dwell activation and OS input stay *outside* the core behind
ports, because they are inherently platform-specific:

```ts
interface TargetProvider { targetsAt(t: number): Target[] }   // DOM | UIA | AX | AccessibilityNodeInfo
interface InputSink { move(p): void; click(p, button): void; scroll(p, d): void }
```

The web app keeps working by implementing those two ports exactly as
`useGazeEngine` does today. This step must be behaviour-preserving: the golden
vectors from Step 0 must reproduce bit-for-bit.

## Step 2 — fix the measured defects, in `core-ts`, one at a time

Work the ranked list in [03](03-tracking-and-jitter.md). Each fix is one PR
carrying its benchmark delta in the description. The web app is the test bed —
this is where the prototype earns its keep, because iteration is seconds
instead of a native build.

Exit criterion for Step 2: on the golden traces, fixation jitter under 10 px
with added latency under 80 ms, and no regression in tracking error.

## Step 3 — port the frozen core to C++

Only once the algorithms have stopped changing. `packages/core-ts` becomes the
*oracle*: the C++ core is required to reproduce the golden vectors within a
tight tolerance (1e-4 normalised units), enforced by a test that runs both
implementations over the same fixtures in CI. That makes the port verifiable
rather than a leap of faith.

`core-ts` is then retained, not deleted, for two jobs: the oracle, and the web
harness's implementation until the WASM artifact is in place.

## Step 4 — first native platform: Windows

Windows first because it is the only target where the full vision is achievable
with public APIs and no store-policy gate: `SendInput` for cursor and clicks,
UI Automation for real target discovery, tray app, global emergency hotkey. It
is also the platform where a broken build cannot brick a user's device.

## Step 5 — storage, then sync

Local-first encrypted profile store on Windows, with schema and versioning from
[06](06-data-model.md). Supabase auth and sync come *after* local storage is
solid, and sync must be removable without affecting tracking.

## Step 6 — macOS, then Android, then iOS

In that order: macOS reuses the desktop shape; Android needs accessibility
policy work and a Play declaration; iOS needs the narrowest scope and the most
honest positioning (see [07](07-platform-architecture.md)).

## What gets preserved, changed, and deleted

**Preserved (design and code, ported):**
- MediaPipe FaceLandmarker feature extraction, including the iris-offset and
  eyelid-openness formulation.
- One-euro filtering as the core smoother (re-parameterised, not replaced).
- Ridge calibration with MAD outlier rejection and per-point sample groups.
- Multi-signal deterministic intent scoring and the fixation tracker.
- Sticky nearest-target selection with hysteresis, and gentle snapping.
- The six accessibility presets — they encode real user-need thinking.
- Region-error diagnostics and the profile/settings shape.

**Changed:**
- Filter parameterisation, the calibration protocol, the ridge conditioning, the
  targeted-recalibration mechanism, threading, and asset delivery.
- Region error becomes held-out error, not training residuals.

**Deleted:**
- CDN loading of runtime and model.
- `window.__gazeLandmarker`.
- The Python-era README instructions.
- Unused shadcn components, once the shared UI surface is settled.

## Risks

| Risk | Mitigation |
|---|---|
| Lovable sync breaks on repo restructure | Keep the web app at its current path and its build unchanged; add packages beside it; never force-push |
| C++ port silently changes behaviour | Golden-vector equivalence test in CI, `core-ts` as oracle |
| Synthetic benchmark over-fits the simulator | Add recorded real-webcam traces in Step 0 and weight them equally in the exit criteria |
| Accuracy work drags on and platforms never start | Step 2 has a numeric exit criterion and a hard time box; Windows work can start in parallel against the frozen interface |
| Play/App Store rejection late in the cycle | Policy review is an exit criterion of the Android and iOS phases, not a release-time discovery |
