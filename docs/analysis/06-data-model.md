# 06 — Data model

## Design rules

- Everything needed to track is **local**. The cloud is backup, recovery and
  multi-device sync only. Losing the network must not degrade tracking.
- Calibration is stored as **model parameters**, never as raw video, frames or
  landmark streams.
- Calibration is **per (profile, device, display geometry)**. A model fit on a
  laptop's built-in camera is meaningless on a docked 27" monitor.
- Every syncable row carries `version`, `updated_at` and `device_id` so
  conflicts resolve deterministically.

## Local schema (SQLite on native, IndexedDB on web)

```
profile(id, name, created_at, updated_at, version, deleted_at)
settings(profile_id, json, updated_at, version)          -- the Settings shape
device(id, os, os_version, app_version, camera_label, created_at)
display(id, device_id, width_px, height_px, scale, is_primary)
calibration(
  id, profile_id, device_id, display_id,
  layout,                       -- 5 | 9 | 13 | 17
  model_json,                   -- weights + basis id + feature scaling
  correction_json,              -- residual field for targeted recalibration
  accuracy_px, p95_px, region_error_json,
  captured_at, model_schema, version, updated_at
)
behavior_stats(profile_id, day, clicks, false_clicks, missed_clicks,
               mean_selection_ms, mean_confidence, mean_jitter_px)
consent(profile_id, kind, granted, granted_at, revoked_at, policy_version)
sync_state(table_name, row_id, dirty, last_pushed_at, last_pulled_at)
audit_log(id, at, kind, detail)      -- local only, never synced
```

`model_json` is versioned by `model_schema`; a client that does not understand a
newer schema must refuse to use the model and offer recalibration rather than
misinterpret weights.

Local storage is encrypted at rest with a key held in the platform keystore
(DPAPI / Keychain / Android Keystore). Web falls back to unencrypted IndexedDB
and must say so in the UI.

## Supabase schema

```sql
-- every table: owner column + RLS, no exceptions
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text, os text, os_version text, app_version text,
  created_at timestamptz not null default now()
);

create table public.calibrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  display_key text not null,          -- "1920x1080@1.0:primary"
  layout smallint not null,
  model_schema int not null,
  model jsonb not null,               -- weights only
  correction jsonb,
  accuracy_px real, p95_px real, region_error jsonb,
  captured_at timestamptz not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  unique (profile_id, device_id, display_key)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                 -- 'sync' | 'diagnostics' | 'research'
  granted boolean not null,
  policy_version text not null,
  changed_at timestamptz not null default now()
);

create table public.usage_daily (        -- aggregates only, opt-in
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  clicks int, false_clicks int, missed_clicks int,
  mean_selection_ms real, mean_confidence real, mean_jitter_px real,
  primary key (user_id, day)
);
```

RLS on every table, identical shape:

```sql
alter table public.calibrations enable row level security;
create policy "own rows" on public.calibrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

No table stores gaze coordinates, landmarks, frames or audio. `usage_daily`
holds daily aggregates only, written only when `consents.kind = 'diagnostics'`
is granted.

The service-role key exists only in Edge Functions. Clients use the anon key
plus the user's JWT. There is no path by which a client can read another user's
row even if it tries.

## Sync protocol

Last-writer-wins is unacceptable here — silently replacing a good local
calibration with a stale cloud one can leave a user unable to operate their
computer. Rules:

1. Push: rows where `sync_state.dirty`, with `If-Match` on `version`. A version
   conflict returns the server row; the client does not retry blindly.
2. Pull: rows where `updated_at > last_pulled_at`.
3. Conflict on **settings**: field-level merge, newest `updated_at` per field.
4. Conflict on **calibration**: never automatic. Compare `accuracy_px` and
   `captured_at`; if the local model is newer *or* measurably better, keep local
   and mark the remote as superseded. Otherwise prompt, showing both accuracy
   scores and dates. A cloud model is never applied without the local model
   being recoverable.
5. `deleted_at` tombstones; hard delete after 30 days.
6. Sync is a background job that can be off entirely. Tracking never awaits it.

## Deletion and export

- **Export**: an Edge Function returns a signed JSON bundle of every row owned
  by the user, plus the local store's contents assembled client-side.
- **Delete account**: an Edge Function using the service role deletes
  `auth.users` (cascading all tables), purges Storage objects, and returns a
  receipt. The client then wipes the local store and keystore key. Deletion must
  also be reachable from a plain web page, not only from inside the app, since a
  user who cannot operate their device may need a carer to do it.
