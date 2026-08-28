import { FilesetResolver, FaceLandmarker, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import type { GazeFeatures } from "./types";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// MediaPipe FaceLandmarker indices.
const L_IRIS = [468, 469, 470, 471, 472];
const R_IRIS = [473, 474, 475, 476, 477];
const L_CORNERS = [33, 133];
const R_CORNERS = [362, 263];
const L_LID = [159, 145];
const R_LID = [386, 374];

let landmarker: FaceLandmarker | null = null;
let loading: Promise<FaceLandmarker> | null = null;

export async function getLandmarker(): Promise<FaceLandmarker> {
  if (landmarker) return landmarker;
  if (loading) return loading;
  loading = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
    const lm = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    landmarker = lm;
    return lm;
  })();
  return loading;
}

function centroid(pts: { x: number; y: number }[], idx: number[]) {
  let x = 0;
  let y = 0;
  for (const i of idx) {
    x += pts[i].x;
    y += pts[i].y;
  }
  return { x: x / idx.length, y: y / idx.length };
}

/**
 * Convert raw landmarks into a head-pose-normalized gaze feature vector.
 * Iris offsets are expressed in eye-local coordinates so that moderate head
 * movement does not immediately invalidate calibration; residual head pose is
 * passed through as explicit features so the regression can compensate.
 */
export function extractFeatures(result: FaceLandmarkerResult): GazeFeatures | null {
  const face = result.faceLandmarks?.[0];
  if (!face || face.length < 478) return null;

  const li = centroid(face, L_IRIS);
  const ri = centroid(face, R_IRIS);

  const lw = face[L_CORNERS[1]].x - face[L_CORNERS[0]].x || 1e-4;
  const rw = face[R_CORNERS[1]].x - face[R_CORNERS[0]].x || 1e-4;
  const lh = Math.abs(face[L_LID[1]].y - face[L_LID[0]].y) || 1e-4;
  const rh = Math.abs(face[R_LID[1]].y - face[R_LID[0]].y) || 1e-4;

  const lx = (li.x - (face[L_CORNERS[0]].x + face[L_CORNERS[1]].x) / 2) / lw;
  const ly = (li.y - (face[L_LID[0]].y + face[L_LID[1]].y) / 2) / lw;
  const rx = (ri.x - (face[R_CORNERS[0]].x + face[R_CORNERS[1]].x) / 2) / rw;
  const ry = (ri.y - (face[R_LID[0]].y + face[R_LID[1]].y) / 2) / rw;

  const openL = lh / lw;
  const openR = rh / rw;
  const eyeOpenness = (openL + openR) / 2;

  const m = result.facialTransformationMatrixes?.[0]?.data;
  let headYaw = 0;
  let headPitch = 0;
  let headRoll = 0;
  if (m && m.length === 16) {
    headYaw = Math.atan2(-m[8], Math.hypot(m[9], m[10]));
    headPitch = Math.atan2(m[9], m[10]);
    headRoll = Math.atan2(m[4], m[0]);
  }

  const nose = face[1];
  const blinking = eyeOpenness < 0.055;

  // Confidence penalises closed/edge-of-frame/extreme-pose conditions.
  const centerPenalty = Math.min(1, Math.hypot(nose.x - 0.5, nose.y - 0.5) * 2);
  const posePenalty = Math.min(1, (Math.abs(headYaw) + Math.abs(headPitch)) / 1.1);
  const openScore = Math.min(1, Math.max(0, (eyeOpenness - 0.045) / 0.05));
  const confidence = Math.max(0, Math.min(1, openScore * (1 - 0.5 * centerPenalty) * (1 - 0.6 * posePenalty)));

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
