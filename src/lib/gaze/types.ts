export type Vec2 = { x: number; y: number };

export interface GazeFeatures {
  /** Normalized feature vector fed to the calibration mapper. */
  vector: number[];
  /** 0..1 tracker confidence. */
  confidence: number;
  eyeOpenness: number;
  blinking: boolean;
  headYaw: number;
  headPitch: number;
}

export interface GazeSample {
  raw: Vec2;
  filtered: Vec2;
  confidence: number;
  timestamp: number;
  tracking: boolean;
}

export type InteractionMode = "normal" | "safe" | "navigation";

export interface Profile {
  id: string;
  name: string;
  preset: PresetName;
  createdAt: number;
  settings: Settings;
  calibration: CalibrationModel | null;
  stats: BehaviorStats;
}

export type PresetName =
  | "standard"
  | "tremor"
  | "low-precision"
  | "slow-gaze"
  | "high-response"
  | "safe-interaction";

export interface Settings {
  smoothing: number; // 0..1, higher = smoother/slower
  dwellMs: number;
  minDwellMs: number;
  maxDwellMs: number;
  adaptiveDwell: boolean;
  snapStrength: number; // 0..1
  snapRadius: number; // px
  intentThreshold: number; // 0..1
  minConfidence: number; // 0..1
  mode: InteractionMode;
  adaptiveCalibration: boolean;
  showGazeDot: boolean;
  edgeScroll: boolean;
}

export interface BehaviorStats {
  clicks: number;
  cancelled: number;
  undone: number;
  avgJitter: number;
  avgSelectionMs: number;
  samples: number;
}

export interface CalibrationModel {
  /** Ridge regression weight matrices for x and y over the expanded basis. */
  wx: number[];
  wy: number[];
  createdAt: number;
  /** Per-region mean error in px, keyed by region index 0..8 (3x3 grid). */
  regionError: Record<number, number>;
  pointCount: number;
}
