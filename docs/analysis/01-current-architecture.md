# 01 — Current architecture

Commit analysed: `c49fbac` (branch `main`).

## What the repository is

A single-page web application, not a desktop or mobile application.

```
TanStack Start (SSR-capable React 19 app, Vite 8, Bun)
└── src/routes/index.tsx            552 lines — the entire product UI
    └── useGazeEngine (hook)        296 lines — camera, inference, filtering,
        │                                       dwell, snapping, calibration
        ├── lib/gaze/faceTracker    MediaPipe FaceLandmarker + feature extraction
        ├── lib/gaze/calibration    ridge regression over a cubic basis
        ├── lib/gaze/filter         one-euro stabilizer + jitter meter
        ├── lib/gaze/intent         fixation tracking + intent score
        ├── lib/gaze/targets        DOM target discovery, nearest, snap
        ├── lib/gaze/presets        six accessibility presets
        └── lib/gaze/profiles       localStorage persistence
```

Supporting UI: `components/gaze/{GazeCursor,GazeButton,CalibrationOverlay,VirtualKeyboard}`
plus a full shadcn/ui component set (~50 files) that the product barely uses.

There is no backend, no database, no authentication, no service worker, no
tests, no CI workflow, and no native code of any kind.

## Runtime data flow

```
getUserMedia (640x480)
   └── <video> (sr-only)
        └── requestAnimationFrame loop, gated to ~35 fps
             ├── FaceLandmarker.detectForVideo   (main thread, GPU delegate)
             ├── extractFeatures  → 11-dim vector + confidence
             ├── predict(model)   → raw screen point
             ├── GazeStabilizer   → one-euro filtered point
             ├── collectTargets() → querySelectorAll + getBoundingClientRect
             ├── nearest / snap   → biased point
             ├── dwell timer + intentScore → el.click()
             └── setState(...)    → React re-render of the whole route
```

Every stage above runs on the browser main thread, once per frame, including
the DOM measurement pass and a React state update.

## Module notes

### `lib/gaze/faceTracker.ts`
- Loads the MediaPipe WASM fileset from `cdn.jsdelivr.net` and the
  `face_landmarker.task` model from `storage.googleapis.com` at first start.
- Extracts iris offsets in eye-local units, eyelid openness, head yaw/pitch/roll
  from the facial transformation matrix, and a nose-offset pair.
- Confidence is a hand-made product of eye-openness, off-centre penalty and
  pose penalty — not a model-reported quality.
- The resulting instance is stashed on `window.__gazeLandmarker` and read back
  from `window` inside the frame loop.

### `lib/gaze/calibration.ts`
- `basis()` expands the 11-dim feature vector to 20 columns (constant, raw
  features, three quadratic cross terms, two pose interactions, two cubics).
- `ridge()` builds the normal equations directly and solves them with
  Gauss–Jordan elimination; penalty is `lambda * N` on the diagonal, applied to
  every column including the intercept, with no feature standardisation.
- `rejectOutliers()` does per-point MAD rejection at 2.5×MAD.
- `fitModel()` stores `wx`, `wy`, a 3×3 grid of mean region errors, and a sample
  count. Region errors are the *training residuals*, not held-out error.

### `lib/gaze/filter.ts`
- Textbook one-euro implementation with `minCutoff`, `beta`, `dCutoff`.
- `GazeStabilizer.setSmoothing(s)` maps the 0..1 slider to
  `minCutoff = 2.5 - 2.3s` and `beta = 0.02 + 0.05(1-s)`.
- `JitterMeter` computes a rolling 45-sample std-dev. It is displayed but never
  fed back into any adaptation.

### `lib/gaze/intent.ts`
- `FixationTracker` keeps a 600 ms window and exposes `stability()` (px std-dev)
  and `speed()` (px/s across the window).
- `intentScore()` is a fixed weighted sum of stability, dwell fraction,
  confidence, inverse target area, deliberateness and revisit count.

### `lib/gaze/targets.ts`
- Targets are elements carrying `data-gaze-target`, i.e. only elements this app
  renders itself. The docstring claims roles/focusables are used; the code only
  matches the data attribute.
- `nearest()` applies a 0.6× distance bonus to the current target (hysteresis).
- `snap()` interpolates 35 % (inside) or 60 % (outside) of the way to the target
  centre, per frame — so a held gaze converges onto the centre geometrically.

### `hooks/useGazeEngine.ts`
- Owns camera lifecycle, the frame loop, calibration sequencing and dwell.
- Calibration: 900 ms settle, then 1100 ms of sampling per point, MAD rejection
  across all groups, then a single global `fitModel`.
- Dwell refractory is implemented by pushing `dwellStart` 400 ms into the
  future.

### `routes/index.tsx`
- Profile CRUD, presets, settings sliders, diagnostics panel, region grid,
  virtual keyboard, activity log, emergency stop (Escape), pause (Ctrl+Space).
- Adaptive dwell lives here: bursts of activations under 900 ms apart raise
  dwell by 150 ms; six or more spaced activations lower it by 40 ms.
- "Fix N weak areas" calls `runCalibration` with only the weak regions'
  points.
- Branding in the UI is "GazeBridge"; the README calls the project "Gaze
  Companion".

## Documentation drift

`README.md` documents a Python application (`pip install -r requirements.txt`,
`python main.py`) that does not exist in this repository, and a feature matrix
that overstates what is implemented (voice commands, scrolling, drag, multi-user
support, adaptive stabilisation). Any migration plan should treat the README as
a product wish-list, not a description of the system.

## Build and quality state

| Check | Result |
|---|---|
| `bun install` | OK (414 packages) |
| `bun run lint` | **fails** — 60 errors, all `prettier/prettier` formatting, pre-existing |
| Tests | none exist |
| CI | none configured |
| Type checking | only via editor/build; no `tsc --noEmit` script |
