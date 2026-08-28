# Gaze Companion — re-architecture analysis

This directory is the pre-implementation analysis required before the
re-architecture work starts. It documents what exists today, what is wrong with
it, what should replace it, and in what order.

Nothing here changes application behaviour. The only executable artifact added
alongside it is the benchmark harness in `tools/bench/`, which produced the
numbers cited throughout.

| Document | Contents |
|---|---|
| [01-current-architecture.md](01-current-architecture.md) | What the repository actually is today, module by module |
| [02-technology-analysis.md](02-technology-analysis.md) | Technology choices, what they can and cannot do |
| [03-tracking-and-jitter.md](03-tracking-and-jitter.md) | Measured root causes of inaccuracy and cursor jitter |
| [04-migration-strategy.md](04-migration-strategy.md) | How to get from a web prototype to a native, shared-core product |
| [05-repository-structure.md](05-repository-structure.md) | Proposed monorepo layout and build topology |
| [06-data-model.md](06-data-model.md) | Local schema, Supabase schema, RLS, sync and conflict rules |
| [07-platform-architecture.md](07-platform-architecture.md) | Per-OS capability matrix and integration design |
| [08-security-privacy.md](08-security-privacy.md) | Threat model, data classes, risks and mitigations |
| [09-roadmap.md](09-roadmap.md) | Phased plan with exit criteria per phase |

Measured baselines live in [`docs/benchmarks/`](../benchmarks/).

## Executive summary

The repository is **not** the Python prototype the README describes. It is a
Lovable-managed TanStack Start web application (React 19, Vite, Bun) that runs
MediaPipe FaceLandmarker in the browser, fits a ridge-regression gaze model, and
drives a simulated cursor over DOM elements inside its own page.

That is a good research harness and a poor product: a web page cannot move the
operating system cursor, cannot click other applications, and cannot run in the
background. The product vision in the brief is only reachable through native
platform integrations.

The core algorithms are worth keeping in *design* — one-euro filtering, ridge
calibration with MAD outlier rejection, accessibility-tree target discovery, and
multi-signal intent scoring are the right primitives. Their *implementations*
have specific, measurable defects:

1. **The stabilizer is effectively disabled by its own parameters.** One-euro's
   `beta` term is applied to a velocity expressed in px/s. At the shipped values
   the adaptive cutoff rises to tens of Hz on noise alone, so the filter passes
   the noise through. Measured: fixation jitter stays at ~30 px across the whole
   smoothing slider; re-tuning `beta` from 0.0425 to 1e-3 drops it to 7.7 px at
   57 ms of added latency. Details in [03](03-tracking-and-jitter.md).
2. **Calibration collects head pose and gaze target confounded in time.** Points
   are visited sequentially over 18–34 s while head pose drifts, so the
   regression attributes pose to screen position. Measured: adding 0.05 rad of
   slow head drift nearly doubles generalisation error (79 px → 150 px).
3. **The cubic basis contributes nothing.** Features are O(0.1) and
   un-standardised, so squared/cubic columns are O(1e-2)–O(1e-3) and the uniform
   ridge penalty annihilates exactly the terms added for expressiveness. Linear,
   quadratic and cubic bases produce identical predictions to 0.1 px.
4. **"Fix weak areas" refits the entire model from the weak region's samples**,
   which destroys the global mapping rather than repairing part of it.
5. **The render loop and the tracking loop are the same loop.** Inference,
   filtering, target discovery (`querySelectorAll` + `getBoundingClientRect` on
   every frame) and a full React `setState` all run per frame on the main
   thread.
6. **Stale-closure bugs in the engine loop**: the running `requestAnimationFrame`
   chain captures `calibrating` and `state.cursor` from the frame it was
   started on, so low-confidence hold and calibration gating use stale values.
7. **Nothing is local-first.** The MediaPipe WASM runtime and model are fetched
   from third-party CDNs at startup, so a cold start with no internet cannot
   track at all.
8. **No backend, no auth, no sync, no account deletion, no consent records**,
   despite those being product requirements.
9. **No tests and no CI.** `bun run lint` fails on 60 pre-existing formatting
   errors.

The recommended path is not a rewrite. It is: extract the algorithms into a
portable core with a golden-vector test suite, fix the measured defects against
that suite, then grow native platform layers around the core — Windows first,
because it is the only platform where the full product vision is achievable
without restriction.

## Product-level correction worth making early

Apple ships **Eye Tracking** as a built-in, system-wide accessibility feature on
supported iPhone and iPad models (Settings → Accessibility → Eye Tracking,
announced May 2024, on-device processing, with Snap to Item and Dwell Control).
A third-party iOS app cannot offer a competing system-wide gaze cursor, and it
should not try to. The iOS/iPadOS version should be an in-app AAC/communication
surface that is excellent *under* Apple's Eye Tracking and Switch Control, plus
profile/calibration sync. See [07](07-platform-architecture.md).
