import { FilesetResolver, FaceLandmarker, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import type { GazeFeatures } from "./types";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// MediaPipe FaceLandmarker landmark indices (478-point mesh with iris).
const L_IRIS = [468, 469, 470, 471, 472];
const R_IRIS = [473, 474, 475, 476, 477];

let landmarker: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;

export async function getLandmarker(): Promise<FaceLandmarker> {
  if (landmarker) return landmarker;
  if (loading) return loading;
  loading = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const lm = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    landmarker = lm;
    return lm;
  })();
  return loading;
}

type Pt = { x: number; y: number; z?: number };

function centroid(pts: Pt[], idx: number[]): Pt {
  let x = 0;
  let y = 0;
  for (const i of idx) {
    const p = pts[i];
    if (!p) continue;
    x += p.x;
    y += p.y;
  }
  return { x: x / idx.length, y: y / idx.length };
}

/**
 * Convert raw landmarks into a head-pose-normalized gaze feature vector.
 * Iris offsets are expressed in eye-local units so moderate head movement does
 * not instantly invalidate calibration; residual head pose is passed through as
 * explicit features so the regression can compensate for the rest.
 */
export function extractFeatures(result: FaceLandmarkerResult): GazeFeatures | null {
  const face = result.faceLandmarks?.[0] as Pt[] | undefined;
  if (!face || face.length < 478) return null;

  const get = (i: number): Pt => face[i] ?? { x: 0, y: 0 };

  const li = centroid(face, L_IRIS);
  const ri = centroid(face, R_IRIS);

  const l0 = get(33);
  const l1 = get(133);
  const r0 = get(362);
  const r1 = get(263);
  const lidLTop = get(159);
  const lidLBot = get(145);
  const lidRTop = get(386);
  const lidRBot = get(374);

  const lw = l1.x - l0.x || 1e-4;
  const rw = r1.x - r0.x || 1e-4;
  const lh = Math.abs(lidLBot.y - lidLTop.y) || 1e-4;
  const rh = Math.abs(lidRBot.y - lidRTop.y) || 1e-4;

  const lx = (li.x - (l0.x + l1.x) / 2) / lw;
  const ly = (li.y - (lidLTop.y + lidLBot.y) / 2) / lw;
  const rx = (ri.x - (r0.x + r1.x) / 2) / rw;
  const ry = (ri.y - (lidRTop.y + lidRBot.y) / 2) / rw;

  const eyeOpenness = (lh / lw + rh / rw) / 2;

  const m = result.facialTransformationMatrixes?.[0]?.data;
  let headYaw = 0;
  let headPitch = 0;
  let headRoll = 0;
  if (m && m.length === 16) {
    const m8 = m[8] ?? 0;
    const m9 = m[9] ?? 0;
    const m10 = m[10] ?? 0;
    const m4 = m[4] ?? 0;
    const m0 = m[0] ?? 1;
    headYaw = Math.atan2(-m8, Math.hypot(m9, m10));
    headPitch = Math.atan2(m9, m10);
    headRoll = Math.atan2(m4, m0);
  }

  const nose = get(1);
  const blinking = eyeOpenness < 0.055;

  const centerPenalty = Math.min(1, Math.hypot(nose.x - 0.5, nose.y - 0.5) * 2);
  const posePenalty = Math.min(1, (Math.abs(headYaw) + Math.abs(headPitch)) / 1.1);
  const openScore = Math.min(1, Math.max(0, (eyeOpenness - 0.045) / 0.05));
  const confidence = Math.max(
    0,
    Math.min(1, openScore * (1 - 0.5 * centerPenalty) * (1 - 0.6 * posePenalty)),
  );

  return {
    vector: [
      (lx + rx) / 2,
      (ly + ry) / 2,
      lx,
      ly,
      rx,
      ry,
      headYaw,
      headPitch,
      headRoll,
      nose.x - 0.5,
      nose.y - 0.5,
    ],
    confidence,
    eyeOpenness,
    blinking,
    headYaw,
    headPitch,
  };
}
