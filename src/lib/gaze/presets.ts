import type { PresetName, Settings } from "./types";

export const BASE: Settings = {
  smoothing: 0.55,
  dwellMs: 1000,
  minDwellMs: 500,
  maxDwellMs: 2500,
  adaptiveDwell: true,
  snapStrength: 0.5,
  snapRadius: 90,
  intentThreshold: 0.62,
  minConfidence: 0.35,
  mode: "normal",
  adaptiveCalibration: false,
  showGazeDot: true,
  edgeScroll: true,
};

export const PRESETS: Record<PresetName, { label: string; description: string; settings: Settings }> = {
  standard: {
    label: "Standard",
    description: "Balanced responsiveness and smoothing.",
    settings: { ...BASE },
  },
  tremor: {
    label: "Tremor-friendly",
    description: "Heavy stabilization, larger tolerance, longer dwell.",
    settings: { ...BASE, smoothing: 0.85, dwellMs: 1400, snapRadius: 140, snapStrength: 0.7, intentThreshold: 0.6 },
  },
  "low-precision": {
    label: "Low precision",
    description: "Strong snapping and wide interaction zones.",
    settings: { ...BASE, smoothing: 0.75, snapStrength: 0.85, snapRadius: 180, dwellMs: 1200 },
  },
  "slow-gaze": {
    label: "Slow gaze",
    description: "Slower cursor, longer dwell, forgiving timing.",
    settings: { ...BASE, smoothing: 0.9, dwellMs: 1800, maxDwellMs: 4000, intentThreshold: 0.55 },
  },
  "high-response": {
    label: "High responsiveness",
    description: "Minimal filtering, fast dwell for experienced users.",
    settings: { ...BASE, smoothing: 0.25, dwellMs: 700, minDwellMs: 400, snapStrength: 0.3 },
  },
  "safe-interaction": {
    label: "Safe interaction",
    description: "Strict intent checks, no automatic clicking.",
    settings: { ...BASE, mode: "safe", dwellMs: 1600, intentThreshold: 0.82, minConfidence: 0.5 },
  },
};
