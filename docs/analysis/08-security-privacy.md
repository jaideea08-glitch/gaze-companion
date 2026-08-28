# 08 — Security and privacy analysis

## Why this is unusually sensitive

The app holds a continuous camera stream of a user's face, a real-time record of
what they are looking at, and — through the accessibility tree — the text of
whatever application they are using. Gaze data is biometric-adjacent and
reveals attention, reading ability, fatigue and cognitive state. The user base
is, by definition, people who may be unable to physically disconnect a camera or
close an app.

## Data classes

| Class | Examples | Rule |
|---|---|---|
| C0 — never leaves the device | camera frames, landmarks, live gaze coordinates, audio | Never transmitted, never written to disk outside an explicit opt-in research recording |
| C1 — local, sensitive | calibration models, accessibility-tree contents, keyboard text | Encrypted at rest; synced only with explicit consent (models only, never tree/text) |
| C2 — syncable | profile names, settings, calibration model parameters | Synced with consent, RLS-isolated |
| C3 — aggregate | daily click counts, mean accuracy, mean jitter | Opt-in diagnostics only, no per-event records |
| C4 — research | recorded feature traces, optionally frames | Separate, explicit, revocable opt-in per session, with a visible recording indicator |

## Findings in the current implementation

| # | Finding | Severity | Fix |
|---|---|---|---|
| P1 | MediaPipe WASM and model fetched from `cdn.jsdelivr.net` / `storage.googleapis.com` at every cold start | High | Self-host with pinned hashes; enables offline use and stops leaking session timing to third parties |
| P2 | Landmarker instance parked on `window.__gazeLandmarker` — reachable by any script on the page | Medium | Module-scoped instance inside a worker |
| P3 | Profiles, including calibration models, in plain `localStorage` | Medium | Platform keystore-backed encryption on native; disclose the web limitation |
| P4 | No consent records, no privacy policy, no data map | High | `consents` table + policy versioning ([06](06-data-model.md)) |
| P5 | No account deletion or export path (no backend at all yet) | High | Edge Functions for both, plus a web-reachable deletion route |
| P6 | No Content-Security-Policy; CDN loading forces a permissive one | Medium | Strict CSP once assets are self-hosted |
| P7 | Camera runs whenever tracking is on, with only an in-page indicator | Medium | Persistent OS-level indicator, idle auto-stop, and a hardware-independent stop |
| P8 | Accessibility-tree text (future native work) can contain passwords and messages | High | Never log, never persist, never sync; redact in diagnostics; honour Secure Input / `FLAG_SECURE` |
| P9 | No CI, no dependency audit, no lockfile policy | Medium | CI with `bun audit`, pinned model hashes, review of new deps |

## Backend risks and controls

- **Service-role key exposure.** Only ever inside Edge Functions, injected as a
  secret, never in a client bundle, never in the repo. CI should fail on any
  occurrence of `service_role` outside `supabase/functions/`.
- **Missing RLS.** Every table gets RLS at creation, and pgTAP tests assert that
  a second user cannot read or write another user's rows. A migration that adds
  a table without a policy fails CI.
- **JWT handling.** Tokens in the platform keystore, never in `localStorage` on
  native; refresh rotation on; logout revokes server-side.
- **Storage.** Prefer not to use Storage at all. If research uploads are ever
  added, they go to a private bucket with per-user path policies and a retention
  job, behind the C4 consent.
- **Transport.** TLS only; certificate pinning on mobile if the threat model
  later warrants it.

## Safety risks that are not confidentiality risks

These matter more to this user group than data leaks:

- **A stuck cursor or runaway clicker can lock a user out of their own device.**
  Mitigations: emergency stop on a thread independent of tracking; a watchdog
  that disables input injection if the tracking thread misses its deadline; a
  hard rate limit on synthetic clicks; Safe Mode as the default for new users.
- **Unintended activation** in destructive contexts. Mitigation: intent scoring
  plus dwell, a longer dwell for targets identified as destructive where the
  accessibility tree allows it, and never auto-confirming system dialogs.
- **Silent degradation.** If confidence collapses (lighting, glasses, user moved)
  the app must visibly say so and stop clicking rather than click randomly.

## Claims discipline

No medical claims, no diagnostic claims, no therapeutic claims — in the app,
the README, the store listings or the marketing copy. Describe it as an
assistive input tool. Fatigue or attention metrics derived from gaze must not be
presented as health information.
