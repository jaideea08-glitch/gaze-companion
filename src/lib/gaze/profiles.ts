import { PRESETS } from "./presets";
import type { Profile, PresetName } from "./types";

const KEY = "eyeassist.profiles.v1";
const ACTIVE = "eyeassist.active.v1";

export function emptyProfile(name: string, preset: PresetName = "standard"): Profile {
  return {
    id: `p_${Math.random().toString(36).slice(2, 10)}`,
    name,
    preset,
    createdAt: Date.now(),
    settings: { ...PRESETS[preset].settings },
    calibration: null,
    stats: { clicks: 0, cancelled: 0, undone: 0, avgJitter: 0, avgSelectionMs: 0, samples: 0 },
  };
}

export function loadProfiles(): Profile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    return [];
  }
}

export function saveProfiles(list: Profile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE);
}

export function setActiveId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE, id);
}

export function wipeAll() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(ACTIVE);
}
