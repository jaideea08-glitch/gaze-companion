# 03 — Gaze tracking problems and the causes of cursor jitter

All numbers below come from `tools/bench/gaze-bench.ts`, which drives the
shipped `calibration.ts` and `filter.ts` with a deterministic synthetic gaze
signal (`tools/bench/simulator.ts`): a mildly non-linear eye model, quantised
iris centroids, per-frame Gaussian iris noise and slow head drift, sampled at
the same ~35 fps the engine uses.

The **absolute** pixel values depend on the simulator's noise assumptions and
are not a claim about real-world accuracy. The **relative** comparisons are the
result: they isolate which stage of the pipeline destroys stability, and they
give the Phase 2 work a regression test that runs in two seconds without a
camera.

Full raw output: [`docs/benchmarks/baseline-2026-08-28.md`](../benchmarks/baseline-2026-08-28.md).

---

## Cause 1 — the stabilizer is disabled by its own parameters (dominant)

One-euro adapts its cutoff with `cutoff = minCutoff + beta * |velocity|`. The
velocity here is the derivative of the *screen-space* signal, in **px/s**. The
shipped mapping produces `beta` between 0.02 and 0.07.

Noise alone moves the predicted point tens of pixels per frame, i.e. on the
order of 1 000 px/s. With `beta = 0.0425` that is
`cutoff ≈ 1.2 + 0.0425 × 1000 ≈ 43 Hz` at a 35 Hz sample rate — `alpha`
saturates at 1 and the filter becomes a pass-through. The filter interprets its
own input noise as intentional movement.

The sweep confirms it. `minCutoff` is irrelevant while `beta` stays at the
shipped value; the entire smoothing slider is inert:

| minCutoff | beta | fixation jitter px | filter latency ms |
|---|---|---|---|
| 2.5 | 0.0425 (shipped) | 30.1 | 0.0 |
| 1.2 | 0.0425 (shipped) | 29.9 | 0.0 |
| 0.5 | 0.0425 (shipped) | 29.8 | 0.0 |
| 0.2 | 0.0425 (shipped) | 29.8 | 0.0 |
| 2.5 | 0.001 | 15.0 | 28.6 |
| 1.2 | 0.001 | 10.1 | 57.1 |
| **0.5** | **0.001** | **7.7** | **57.1** |
| 0.5 | 0 (plain low-pass) | 53.9 | 200.0 |

Same picture through the public API — the whole 0..1 smoothing slider moves
fixation jitter by less than 8 px:

| smoothing | raw jitter px | filtered jitter px |
|---|---|---|
| 0 | 41.3 | 33.1 |
| 0.55 (default) | 41.3 | 29.9 |
| 1 | 41.3 | 23.2 |

**Fix.** Re-scale `beta` to the units of the signal (normalised screen units per
second, not px/s), and compute the speed estimate from a *median-prefiltered*
signal so noise cannot inflate it. Target the `minCutoff ≈ 0.5`, `beta ≈ 1e-3`
region: ~4× less jitter than today at ~57 ms of added latency, which is below
the ~100 ms threshold where pointer lag becomes perceptible. The last row shows
why the adaptive term must be kept rather than replaced by a plain low-pass:
with `beta = 0` the same cutoff costs 200 ms and *worse* measured jitter,
because saccade overshoot bleeds into the fixation window.

## Cause 2 — calibration confounds head pose with screen position

Calibration visits points sequentially: 900 ms settle + 1100 ms sampling per
point, so 18 s for 9 points and 34 s for 17. Head pose drifts over that window,
and because each target is visited in a fixed order, drift is *correlated with
target position*. The regression happily explains screen position with head
pose, and the model then fails whenever the head is somewhere else.

| head drift (rad) | mean error px | p95 error px |
|---|---|---|
| 0 | 79.0 | 137.3 |
| 0.05 | 150.5 | 265.5 |
| 0.12 | 203.8 | 377.9 |
| 0.25 | 283.6 | 542.3 |

A 0.05 rad (≈3°) slow head sway — unavoidable for most users, and the norm for
users with reduced postural control, i.e. the target audience — nearly doubles
error.

This also explains a counter-intuitive result: **more calibration points can be
worse**, because a longer sequence accumulates more drift.

| layout | duration | mean error px | p95 error px |
|---|---|---|---|
| 5-point | 10.1 s | 121.5 | 210.6 |
| 9-point | 18.1 s | 147.2 | 262.2 |
| 13-point | 26.2 s | 87.1 | 155.9 |
| 17-point | 34.2 s | 91.1 | 174.3 |

This is direct evidence for the brief's instruction not to fix jitter by adding
calibration points.

**Fix.** Three changes, in order of value:
1. Randomise point order and re-visit a subset at the end, so pose drift is
   uncorrelated with target position and detectable.
2. Sample less per point (400–600 ms after settle is enough once outliers are
   rejected) and shorten the total sequence.
3. Make pose a *conditioning* input rather than a free predictor: fit the gaze
   mapping on pose-normalised features and keep an explicit, separately
   regularised pose-compensation term, so the pose path cannot absorb the gaze
   signal.

## Cause 3 — the polynomial basis is inert

`basis()` adds five quadratic/interaction columns and two cubic columns. Raw
features are O(0.1), so those columns are O(1e-2) to O(1e-3), while the ridge
penalty `lambda * N` is applied uniformly to every column including the
intercept. The high-order columns are regularised out of existence.

Measured: linear, quadratic and the shipped cubic basis produce **identical**
predictions at every penalty tested.

| basis | lambda | mean error px | fixation jitter px |
|---|---|---|---|
| linear | 0.001 | 77.1 | 45.1 |
| quadratic | 0.001 | 77.1 | 45.1 |
| cubic (shipped) | 0.001 | 77.1 | 45.1 |
| all three | 0.01 | 252.2 | 25.9 |
| all three | 0.1 | 463.4 | 5.1 |

The `lambda` rows also show the failure mode of un-standardised ridge: at
`lambda = 0.1` the model collapses toward the screen centre — 5 px of jitter and
463 px of error, i.e. a beautifully stable wrong answer.

A naive z-score of the features made things *worse* in the same harness
(215–300 px), because near-constant feature dimensions (nose offset, roll) get
their noise amplified to unit variance. So the fix is not "standardise
everything":

**Fix.** Standardise with a variance floor, drop dimensions whose calibration
variance is below that floor, penalise the intercept at zero, and select
`lambda` by leave-one-point-out cross-validation over the calibration set
instead of hard-coding it. Only then is a higher-order basis worth having; the
selection procedure will tell us which order actually earns its place.

## Cause 4 — targeted recalibration destroys the model

`calibrate(worstRegions)` collects samples for the weak regions only, then calls
the same global `fitModel`. The result is a model fit on one to three screen
points that replaces the model fit on nine. The previous `regionError` map is
merged forward, so the diagnostics panel keeps reporting the *old* errors for
untouched regions and the UI looks healthier than the model is.

**Fix.** Keep the global model and fit a *residual correction field* over it
(per-region affine offset, or thin-plate/RBF over region centres), refreshed
only for the regions that were re-measured. Persist base model and correction
field separately, and version them (see [06](06-data-model.md)).

## Cause 5 — everything runs on the render thread

Per frame, on the browser main thread: MediaPipe inference, feature extraction,
prediction, filtering, `document.querySelectorAll("[data-gaze-target]")`,
`getBoundingClientRect()` on every match (a forced synchronous layout), and a
`setState` that re-renders a 552-line route.

Consequences: the sample interval is whatever the renderer leaves over, so the
one-euro `dt` is irregular in exactly the way that makes its derivative estimate
noisy; and GC/layout spikes appear as cursor jumps.

**Fix.** Camera + inference + core in a worker (native: a dedicated tracking
thread), a fixed sampling cadence with real timestamps, a target cache
invalidated by `MutationObserver`/`ResizeObserver` rather than a per-frame DOM
walk, and a throttled (≤10 Hz) diagnostics channel to the UI.

## Cause 6 — stale closures in the frame loop

`loop` is a `useCallback` depending on `calibrating` and `state.cursor`, but the
`requestAnimationFrame` chain re-arms itself with the closure it was created
with. Once tracking starts, the running loop keeps the values captured at start
forever:

- `state.cursor` — the low-confidence "hold the cursor still" path holds the
  cursor at its position from the moment tracking started, not its current one.
- `calibrating` — snapping and dwell are supposed to be suppressed during
  calibration; in the running loop they are not.

**Fix.** Move all loop state into refs (or out of React entirely, which the
worker split does anyway) so there is exactly one source of truth per frame.

## Cause 7 — confidence gates but never weights

`confidence` only decides whether to freeze the cursor (`< minConfidence`), and
freezing is binary. There is no confidence weighting inside the filter, no
outlier rejection on the live signal (only during calibration), no dead-zone
around a settled fixation, and the `JitterMeter` output is displayed but never
used to adapt anything, despite `adaptiveCalibration` and per-profile stats
existing in the data model.

**Fix.** The Phase 2 stabilizer should be a chain, in this order: reject
per-frame outliers (MAD against a short window) → median prefilter (5 samples)
→ confidence-weighted one-euro → velocity-gated dead zone during fixation →
snap bias. Each stage must be individually switchable so the benchmark can
attribute the improvement.

## Summary of the fix list, ranked by measured value

| # | Fix | Expected effect |
|---|---|---|
| 1 | Re-scale one-euro `beta`, add median prefilter | jitter 30 px → ~8 px at ~57 ms latency |
| 2 | Randomised, shorter calibration + pose conditioning | removes the 2× error inflation from 3° of head sway |
| 3 | Standardise with variance floor + CV-selected `lambda` | makes the non-linear basis actually contribute |
| 4 | Residual correction field for targeted recalibration | makes "fix weak areas" safe instead of destructive |
| 5 | Worker/thread split + cached targets + fixed cadence | removes layout- and GC-induced jumps, stabilises `dt` |
| 6 | Kill stale closures | fixes low-confidence hold and calibration gating |
| 7 | Confidence weighting, dead zone, adaptive smoothing | stability during fixation without adding latency to saccades |
