# 07 — Platform architecture

## Capability matrix

What each platform actually permits a third-party app to do, using public APIs
and without violating store policy. This is the honest version; the README's
current feature table is not.

| Capability | Windows | macOS | Android | iOS/iPadOS | Web (today) |
|---|---|---|---|---|---|
| Move the OS cursor | yes (`SendInput`) | yes (`CGEvent`, needs Accessibility permission) | no cursor concept; taps via gesture dispatch | **no** | no |
| Click / scroll / drag other apps | yes | yes | yes, via `AccessibilityService.dispatchGesture` | **no** | no |
| Read other apps' accessibility tree | yes (UI Automation) | yes (`AXUIElement`, needs permission) | yes (`AccessibilityNodeInfo`) | **no** | no |
| Background / always-on operation | yes (tray) | yes (menu bar, `LSUIElement`) | foreground service, `camera` type | limited; no background camera | no |
| Global emergency hotkey | yes (`RegisterHotKey`) | yes (`CGEventTap` / `NSEvent` monitor) | hardware/notification action | in-app only | in-page only |
| System-wide gaze cursor | yes | yes | approximated by an accessibility overlay + gestures | **provided by the OS itself**, not by us | no |
| Camera in background | yes | yes | yes with `camera` FGS type + `CAMERA` granted while in use | no | no |

## Windows — first target

- Shell: WinUI 3 tray app, `LSUIElement`-equivalent (no taskbar window),
  settings/calibration windows opened on demand.
- Capture: Media Foundation → tracking thread → MediaPipe Tasks (C++) →
  gaze core.
- Targets: UI Automation. Cache the focused window's element tree, refresh on
  `UIA_AutomationFocusChangedEventId` and structure-changed events rather than
  per frame.
- Input: `SendInput` for move/click/scroll; drag as a press–move–release state
  machine owned by the interaction controller.
- Emergency: `RegisterHotKey` for stop and for click-disable, handled on a
  dedicated thread so a wedged tracking thread cannot block it.
- Known limitation to document, not work around: **UIPI**. A non-elevated
  process cannot send input to elevated windows or the UAC secure desktop. The
  honest answer is to detect the condition and tell the user tracking is
  suspended, and to offer an optional elevated install for users who need it.
- No driver, no kernel component, no injection.

## macOS

- Shell: menu-bar app (`LSUIElement = true`), SwiftUI settings.
- Permissions: Camera (`NSCameraUsageDescription`) and **Accessibility**
  (`AXIsProcessTrustedWithOptions`). The onboarding must explain, in plain
  language and before the prompt, that Accessibility is what allows the app to
  move the pointer, and must deep-link to
  System Settings → Privacy & Security → Accessibility.
- Capture: AVFoundation; landmarks from Vision or MediaPipe (benchmark both —
  Vision is system-maintained but exposes less iris detail).
- Targets: `AXUIElement` on the frontmost app; same event-driven caching as UIA.
- Input: `CGEventPost` to `cgSessionEventTap`.
- Limitation to document: when **Secure Input** is active (password fields,
  some terminals) synthetic events and key monitoring are restricted. Detect
  `IsSecureEventInputEnabled()` and surface it as a visible state.
- Hardened runtime, notarised, sandbox off where Accessibility requires it —
  which means distribution is Developer ID / direct download, not the Mac App
  Store. That is a deliberate, documented trade-off.

## Android

- Language: Kotlin. Capture: CameraX `ImageAnalysis` (`YUV_420_888`), inference
  via MediaPipe Tasks with the model as a bundled asset. Core via NDK.
- Execution: a foreground service declaring
  `android:foregroundServiceType="camera"` with `FOREGROUND_SERVICE_CAMERA` in
  the manifest and the `CAMERA` runtime permission granted. Android 14+ enforces
  this and throws `MissingForegroundServiceTypeException` otherwise. The
  `CAMERA` permission is while-in-use, so the service must be started from the
  foreground — it cannot be launched from `BOOT_COMPLETED`.
- Interaction: `AccessibilityService` with `dispatchGesture` for taps, long
  presses and swipes, plus `GLOBAL_ACTION_BACK`/`HOME`/`RECENTS`. The gaze
  cursor is drawn in a `TYPE_ACCESSIBILITY_OVERLAY` window.
- Keyboard: a real `InputMethodService`, not a custom overlay — so gaze typing
  works in every app and respects the system's IME switching.
- Policy: the AccessibilityService is used for a genuine accessibility purpose,
  which is exactly what the `AccessibilityService` API is for, but Play requires
  an accessibility declaration in Play Console, prominent in-app disclosure
  before enabling, and a privacy policy. Foreground service types must also be
  declared in Play Console. Treat all of this as an exit criterion of the
  Android phase, not a submission-day surprise.
- Limitations to document: `FLAG_SECURE` windows cannot be inspected or
  reliably interacted with; some OEM battery managers kill foreground services;
  gesture dispatch does not reach the system UI in all contexts.

## iOS / iPadOS — scope correction

**Apple already ships system-wide Eye Tracking** as a built-in accessibility
feature on supported iPhone and iPad models (Settings → Accessibility → Eye
Tracking; announced May 2024; front camera; on-device; includes Snap to Item and
Dwell Control). A third-party app cannot provide a system-wide gaze cursor, and
attempting to imply otherwise would be both technically impossible and a
review rejection.

The defensible iOS product is therefore:

- An **in-app AAC / communication and control surface** (phrase board, gaze
  keyboard, quick actions) that a user drives with gaze *inside* our app, using
  ARKit face tracking (`ARFaceAnchor`, `lookAtPoint`, blend shapes) on TrueDepth
  devices, with a Vision-landmark fallback.
- **Excellent behaviour under Apple's own Eye Tracking and Switch Control**:
  correct accessibility labels, large hit targets, `accessibilityTraits`, no
  gesture-only interactions, full Dwell Control compatibility. For many users
  this is more valuable than anything we could build ourselves.
- **Profile and calibration sync**, so settings a user establishes on Windows
  follow them to iPad.
- Shortcuts / App Intents so gaze-triggered actions can drive other apps
  through the supported automation surface.

No private APIs, no sandbox escape, no claim of system-wide control.

## Shared UI

Settings, profiles, calibration flow, help and privacy controls are the same
product on every platform and change often. Options: reuse `shared-ui` (React)
inside a webview on desktop, or reimplement natively per platform. The
recommendation is native on mobile (accessibility fidelity matters most there,
and webviews interact badly with Switch Control and TalkBack), and `shared-ui`
in a webview on Windows/macOS for the non-critical settings screens, with the
calibration overlay always native because it is latency-sensitive.

## Emergency controls, on every platform

Non-negotiable and identical in spirit everywhere: an always-available stop that
is reachable *without* gaze, a distinct click-disable that keeps the cursor
moving (Safe Mode), an obvious visual state, and a physical/hardware path
(keyboard shortcut, notification action, hardware button). None of these may be
routed through the UI thread that gaze rendering uses.
