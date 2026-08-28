# 02 — Technology analysis

## Current stack

| Layer | Technology | Verdict |
|---|---|---|
| App shell | TanStack Start + React 19 + Vite 8 + Bun | Fine for a web harness; irrelevant to the product vision |
| UI kit | shadcn/ui + Tailwind 4 (~50 unused components) | Keep for the web/shared UI surface; prune later |
| Vision | `@mediapipe/tasks-vision` 1.0.1 FaceLandmarker (478-pt mesh with iris) | Right model family; wrong delivery (CDN) and wrong thread |
| Gaze math | Hand-written TypeScript | Correct in intent, defective in detail (see [03](03-tracking-and-jitter.md)) |
| Persistence | `localStorage` | Not durable, not multi-device, not encryptable, no schema versioning |
| Backend | none | Required by the brief (Supabase) |
| Packaging | Lovable-connected web project | Cannot deliver OS-level input on any platform |

## What a browser fundamentally cannot do

This is the decisive constraint and it is not a bug to be fixed:

- Move the operating system cursor, or click, scroll or drag in other apps.
- Read the accessibility tree of other applications.
- Run while the browser is closed or the tab is backgrounded (rAF is throttled).
- Hold the camera open as a background service.
- Register a global emergency-stop hotkey.

So the current app can only ever gaze-operate its own DOM. It stays valuable as
a research harness, a calibration playground and the shared-UI prototype, but
the product must be native per platform.

## Language strategy for the shared core

The brief prefers C++ and asks for justification before introducing Rust. The
recommendation is **C++17** for the core, unchanged, for these reasons:

- Every target platform links C++ natively: MSVC on Windows, Objective-C++ /
  Swift interop on Apple platforms, the NDK on Android, Emscripten for the web
  harness. Rust would need a C ABI shim on every platform and adds a second
  toolchain to Android/iOS builds for no capability gain.
- MediaPipe's own C++ Tasks API is available for desktop and Android, so a C++
  core lets the vision frontend and the gaze core share buffers without
  marshalling.
- The core is ~2 000 lines of numerics and state machines with no concurrency
  and no allocation in the hot path. Rust's principal advantage (safe
  concurrency, ownership over complex lifetimes) is not exercised here.

Where Rust *would* be justified, and should be reconsidered when reached: the
sync/crypto layer for local encrypted profile storage. That code is
allocation-heavy, security-sensitive and platform-uniform. It is not part of
the first phases; revisit at Phase 6.

**Python** stays where it belongs: offline evaluation, dataset tooling, model
training and plotting under `tools/`. Nothing in the shipped runtime.

## Vision frontend per platform

The core must consume *landmarks*, never frames. That keeps the camera-specific,
license-specific and hardware-accelerated parts at the edge:

| Platform | Landmark source | Notes |
|---|---|---|
| Windows | MediaPipe Tasks (C++) with the face landmarker `.task` bundled in the installer | GPU delegate where available, CPU fallback |
| macOS | Vision `VNDetectFaceLandmarksRequest` or MediaPipe Tasks | Vision is cheaper and system-maintained; MediaPipe gives iris landmarks, which Vision does not expose as richly — benchmark both |
| Android | MediaPipe Tasks (Android) with the model as an asset | CameraX `ImageAnalysis`, `YUV_420_888`, GPU delegate |
| iOS/iPadOS | ARKit `ARFaceAnchor` on TrueDepth devices, Vision fallback | ARKit already provides `lookAtPoint` and blend shapes |
| Web harness | `@mediapipe/tasks-vision`, self-hosted WASM + model | Must be self-hosted to work offline |

## Model and asset delivery

Fetching the WASM runtime from jsdelivr and the model from Google Cloud Storage
at startup is three problems at once: an offline cold start cannot track at all,
a third party learns when each user starts a tracking session, and the runtime
is trivially supply-chain-attackable. Assets must be vendored per platform
(installer payload, APK asset, app bundle, and `public/` for the web) with a
recorded hash.

## Threading

Inference, filtering and UI share one thread today. Target topology:

- **Web harness**: camera + inference in a Web Worker with `OffscreenCanvas`;
  core compiled to WASM inside the same worker; only the filtered cursor and a
  throttled diagnostics snapshot cross to the UI thread.
- **Native**: a capture thread (camera callback), a tracking thread (inference +
  core, real-time-ish priority), and the UI thread. The interaction controller
  posts OS input events from the tracking thread; the UI never sits in the
  gaze→input path, so a hung UI can never trap the user.

## Build topology for the core

One source tree, four consumers:

```
core/  (C++17, no exceptions in hot path, no RTTI, no allocation per frame)
 ├── static lib  → Windows (MSVC), macOS/iOS (Xcode, xcframework)
 ├── shared lib  → Android (NDK, via JNI or cpp-shared with Kotlin bindings)
 └── wasm        → web harness (Emscripten, prebuilt artifact committed)
```

The WASM artifact is **prebuilt and committed** rather than built in the web
app's Vite pipeline. The web project is Lovable-connected; requiring Emscripten
in that build would break the editor's ability to build the branch.
