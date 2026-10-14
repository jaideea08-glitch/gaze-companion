# 09 — Implementation roadmap

Each phase has an exit criterion. A phase is not done because the code exists;
it is done when the criterion is measured.

Estimates are in *engineering sessions* of focused work, excluding external
waits (store review, hardware procurement, user-testing recruitment), which are
called out separately.

| Phase | Work | Exit criterion | Est. |
|---|---|---|---|
| 0 | Foundations: `typecheck` + `bun test` scripts, CI, formatting-only cleanup of the 60 lint errors, self-hosted MediaPipe assets, recorded feature-trace fixtures | CI green on `main`; the app cold-starts and tracks with the network disabled | 1 |
| 1 | Extract `packages/core-ts` behind `GazeCore` + `TargetProvider`/`InputSink` ports; web app rewired to it | Golden vectors reproduce the pre-extraction outputs exactly | 1 |
| 2 | Accuracy and smoothness: the ranked fix list in [03](03-tracking-and-jitter.md) — filter re-parameterisation, outlier rejection, median prefilter, confidence weighting, dead zone, worker split, stale-closure removal | Fixation jitter < 10 px at < 80 ms added latency on both synthetic and recorded traces; no tracking-error regression | 2 |
| 3 | Calibration: randomised order, shorter dwell per point, held-out region error, standardisation with variance floor, CV-selected `lambda`, residual correction field for targeted recalibration | 9-point calibration under 15 s with lower held-out error than today's 17-point; targeted recalibration improves the weak region without degrading others | 2 |
| 4 | Windows tray app: capture, tracking thread, UIA targets, `SendInput`, calibration UI, emergency hotkey, watchdog, Safe Mode default | A user can operate File Explorer and a browser by gaze for 30 min; emergency stop works with the tracking thread deliberately wedged | 3 |
| 5 | Local profile storage: SQLite + keystore encryption, schema versioning, per-device/per-display calibration, export | Profiles and calibrations survive reinstall; models are per-display and never applied to the wrong geometry | 1 |
| 6 | Supabase: auth, schema + RLS + pgTAP, sync engine with the conflict rules, export and account-deletion Edge Functions | A second account cannot read the first's rows (test-enforced); a stale cloud model never silently replaces a better local one; deletion returns a receipt and wipes local state | 2 |
| 7 | macOS menu-bar app | Feature parity with Windows minus documented Secure Input limitation; notarised build | 2 |
| 8 | Android: CameraX + camera FGS, NDK core, AccessibilityService gestures, overlay cursor, IME keyboard, Play declarations | Gaze taps and swipes work across three third-party apps; policy declarations drafted and reviewed | 3 |
| 9 | iOS/iPadOS in-app AAC surface, ARKit tracking, full Switch Control / Eye Tracking compatibility, sync | Fully operable using Apple's own Eye Tracking; our in-app gaze surface usable on a TrueDepth device | 2 |
| 10 | Adaptive interaction: dwell adaptation driven by measured false/missed activation rates, per-region smoothing, fatigue-aware relaxation | Adaptation demonstrably reduces false activations on replayed sessions and can always be overridden manually | 2 |
| 11 | Voice: on-device speech (Windows/macOS/Android system recognisers), gaze-to-target + voice-to-act | Works offline; no audio persisted or transmitted by default | 2 |
| 12 | Virtual keyboard as a first-class, platform-appropriate IME | Sustained typing rate measured and reported for at least three users | 2 |
| 13 | Accessibility testing: screen readers, high contrast, reduced motion, keyboard-only, switch access, real users | Documented pass across the matrix; issues from real-user sessions triaged | 2 + recruitment wait |
| 14 | Security and privacy audit: threat model review, dependency audit, RLS penetration test, data-map verification, policy publication | No high findings open; policy published and consent flows shipped | 1 |
| 15 | Store releases: Play accessibility declaration, App Store review, Windows/macOS signed distribution | Approved listings; no unsupported claims in any listing | 1 + review wait |

**Total: roughly 29 sessions of engineering**, plus external waits for store
review and user-testing recruitment. Phases 4–9 are the long pole; Phase 2 and
3 are the ones that determine whether the product is usable at all.

## Sequencing notes

- Phases 2 and 3 must complete before the C++ port, so the port targets frozen
  algorithms. The port itself sits inside Phase 4's estimate.
- Phase 6 must not start before Phase 5: sync without a solid local store is how
  calibration data gets lost.
- Phase 13 should have a dry run after Phase 4 rather than waiting until the
  end; the Windows build is the first thing a real user can try.
- Phases 11 and 12 are independent of each other and can be reordered based on
  user feedback from Phase 13's dry run.

## Immediate next step

Approval of this strategy, then Phase 0 and Phase 1 — both of which are
behaviour-preserving and carry no product risk.
