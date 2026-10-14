# Gaze benchmark harness

Deterministic, camera-free benchmarks for the gaze core. Run:

```bash
bun run tools/bench/gaze-bench.ts
```

It prints a Markdown report; dated results are committed under
`docs/benchmarks/`.

## What it does

`simulator.ts` generates synthetic `GazeFeatures` for a known screen point:
quantised iris centroids, per-frame Gaussian iris noise, a mildly non-linear
eye→screen mapping, per-eye disagreement, slow head yaw/pitch/roll drift, and
confidence decay with pose. A fixed seed makes every run reproducible.

`gaze-bench.ts` drives the **shipped** implementation
(`src/lib/gaze/calibration.ts`, `src/lib/gaze/filter.ts`) through it and reports
calibration error by layout, fixation jitter raw vs filtered, filter latency and
settle time, tracking error, head-drift sensitivity, basis/regularisation
ablations, a one-euro parameter sweep, and per-frame cost.

## What it is not

It is not production gaze code, it is not shipped in the app, and it is not a
substitute for real-webcam evaluation. Absolute numbers reflect the simulator's
assumptions; treat only the *relative* comparisons as findings. Recorded
real-webcam feature traces should be added as fixtures and weighted equally
before any accuracy claim leaves this repository.

## Why it exists

So that changes to filtering and calibration are judged by a measured delta
rather than by how the cursor feels on one developer's face, and so that a
regression is caught in two seconds without hardware.
