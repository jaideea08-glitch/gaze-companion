# 05 — Proposed repository structure

## Constraints

- The repository is Lovable-connected. The web app must keep building from the
  repository root with its current commands, and published history must never
  be rewritten. That rules out moving `src/` into `apps/web/` early, and rules
  out a restructure that requires a force push.
- Native toolchains (MSVC, Xcode, NDK, Emscripten) must never become
  prerequisites for building the web app.

Therefore: grow *beside* the existing app, and defer any move of `src/` to a
single deliberate, non-history-rewriting commit once native work is real.

## Target layout

```
/                              web app stays at the root (Lovable-owned)
  src/                         React UI + ports (DOM targets, DOM input sink)
  public/models/               self-hosted MediaPipe wasm + face_landmarker.task
  package.json, vite.config.ts

packages/
  core-ts/                     the extracted algorithm core (oracle + web impl)
    src/{filter,calibration,intent,pipeline,types}.ts
    test/                      golden-vector tests
  core-wasm/                   prebuilt Emscripten artifact + TS bindings
    dist/gaze_core.{wasm,js}   committed; not built by the web pipeline
  shared-ui/                   settings / profiles / calibration / privacy screens
                               reused by web and, where sensible, desktop shells

core/                          C++17 shared core (single source of truth post-port)
  include/gaze/                stable C API + C++ headers
  src/{filter,calibration,intent,pipeline,model_io}.cpp
  test/                        golden-vector equivalence tests
  CMakeLists.txt

platforms/
  windows/                     tray app: WinUI 3 shell, SendInput, UI Automation
  macos/                       menu-bar app: SwiftUI, CGEvent, AXUIElement
  android/                     Kotlin: CameraX, AccessibilityService, overlay, IME
  ios/                         Swift: in-app AAC surface, ARKit face tracking

fixtures/
  traces/                      recorded feature traces (landmark-derived only)
  golden/                      frozen expected outputs

tools/
  bench/                       the deterministic benchmark harness (exists today)
  eval/                        Python: offline analysis, plots, model training
  scripts/

docs/
  analysis/                    this directory
  benchmarks/                  dated benchmark results
  platform/                    per-platform permission and policy notes
  privacy/                     policy, data map, DSR runbook

supabase/
  migrations/                  SQL migrations
  functions/                   edge functions (account deletion, export)
  tests/                       pgTAP RLS tests
```

## Rules that keep this maintainable

1. **The core never imports a platform.** No DOM, no JNI, no Win32, no
   Foundation. Platform code depends on the core; never the reverse.
2. **Platform boundaries are ports**, defined once in the core's public header:
   `TargetProvider`, `InputSink`, `Clock`, `ModelStore`, `TelemetrySink`. Each
   platform supplies implementations. Adding a platform must not touch core
   code.
3. **Camera frames never cross a port.** Only features and landmarks do. That is
   a privacy invariant as much as an architectural one.
4. **One benchmark, all implementations.** `tools/bench` runs against `core-ts`
   today and against the C++ core through the WASM/CLI build later, so results
   stay comparable across the port.
5. **Fixtures are the contract.** Any change to core behaviour must update
   `fixtures/golden/` in the same PR, with the diff explained.
6. **Supabase schema lives in the repo** as migrations; no console-only changes.

## Ownership boundary with Lovable

Lovable edits the web app: `src/`, `public/`, styling, routes. Everything under
`packages/`, `core/`, `platforms/`, `supabase/` and `tools/` is engineering-owned
and should not be edited from the Lovable editor. Worth stating explicitly in
`AGENTS.md` once `packages/` exists.
