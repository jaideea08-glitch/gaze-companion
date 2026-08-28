import { useCallback, useEffect, useRef, useState } from "react";
import { extractFeatures, getLandmarker } from "@/lib/gaze/faceTracker";
import { GazeStabilizer, JitterMeter } from "@/lib/gaze/filter";
import { FixationTracker, intentScore } from "@/lib/gaze/intent";
import { collectTargets, nearest, snap, type GazeTarget } from "@/lib/gaze/targets";
import {
  fitModel,
  predict,
  rejectOutliers,
  regionOf,
  type CalibSample,
} from "@/lib/gaze/calibration";
import type { CalibrationModel, Profile, Settings, Vec2 } from "@/lib/gaze/types";

export type EngineStatus = "idle" | "loading" | "running" | "paused" | "error";

export interface EngineState {
  status: EngineStatus;
  message: string;
  cursor: Vec2;
  confidence: number;
  tracking: boolean;
  fps: number;
  jitter: number;
  intent: number;
  dwellProgress: number;
  targetLabel: string | null;
  blinking: boolean;
}

const INITIAL: EngineState = {
  status: "idle",
  message: "Camera off",
  cursor: { x: 0, y: 0 },
  confidence: 0,
  tracking: false,
  fps: 0,
  jitter: 0,
  intent: 0,
  dwellProgress: 0,
  targetLabel: null,
  blinking: false,
};

export function useGazeEngine(
  profile: Profile | null,
  onActivate: (el: HTMLElement) => void,
  onCalibrated: (m: CalibrationModel) => void,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<EngineState>(INITIAL);
  const [calibrating, setCalibrating] = useState(false);
  const [calibPoint, setCalibPoint] = useState<Vec2 | null>(null);
  const [calibIndex, setCalibIndex] = useState(0);
  const [calibTotal, setCalibTotal] = useState(0);

  const settingsRef = useRef<Settings | null>(profile?.settings ?? null);
  const modelRef = useRef<CalibrationModel | null>(profile?.calibration ?? null);
  useEffect(() => {
    settingsRef.current = profile?.settings ?? null;
    modelRef.current = profile?.calibration ?? null;
  }, [profile]);

  const stab = useRef(new GazeStabilizer());
  const jitter = useRef(new JitterMeter());
  const fixation = useRef(new FixationTracker());
  const raf = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const featuresRef = useRef<number[] | null>(null);
  const confRef = useRef(0);
  const rawRef = useRef<Vec2>({ x: 0, y: 0 });
  const dwellStart = useRef<number | null>(null);
  const currentTarget = useRef<HTMLElement | null>(null);
  const revisits = useRef<Map<HTMLElement, number>>(new Map());
  const pausedRef = useRef(false);
  const collectRef = useRef<((f: number[], c: number) => void) | null>(null);
  const lastFrame = useRef(0);
  const fpsAcc = useRef<number[]>([]);
  const runningRef = useRef(false);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState((s) => ({ ...INITIAL, status: "idle", message: "Camera off", fps: 0, cursor: s.cursor }));
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    raf.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const now = performance.now();
    if (now - lastFrame.current < 28) return; // cap ~35fps to keep CPU sane
    lastFrame.current = now;

    let result;
    try {
      const lm = (window as unknown as { __gazeLandmarker?: Awaited<ReturnType<typeof getLandmarker>> })
        .__gazeLandmarker;
      if (!lm) return;
      result = lm.detectForVideo(video, now);
    } catch {
      return;
    }

    fpsAcc.current.push(now);
    while (fpsAcc.current.length && now - (fpsAcc.current[0] as number) > 1000) fpsAcc.current.shift();

    const f = extractFeatures(result);
    const s = settingsRef.current;
    if (!f || !s) {
      setState((p) => ({ ...p, tracking: false, confidence: 0, message: "Face not detected", dwellProgress: 0 }));
      dwellStart.current = null;
      return;
    }
    featuresRef.current = f.vector;
    confRef.current = f.confidence;

    if (collectRef.current) collectRef.current(f.vector, f.confidence);

    const model = modelRef.current;
    if (!model) {
      setState((p) => ({
        ...p,
        tracking: true,
        confidence: f.confidence,
        blinking: f.blinking,
        fps: fpsAcc.current.length,
        message: "Tracking – calibration needed",
      }));
      return;
    }

    const raw = predict(model, f.vector);
    rawRef.current = raw;
    stab.current.setSmoothing(s.smoothing);
    const smoothed = stab.current.apply(raw, now);
    jitter.current.push(smoothed);
    fixation.current.push(smoothed, now);

    const lowConf = f.confidence < s.minConfidence || f.blinking;
    const cursor = lowConf ? state.cursor : clampToScreen(smoothed);

    // ---- target snapping (accessibility-tree driven) ----
    let snapped = cursor;
    let target: GazeTarget | null = null;
    if (!pausedRef.current && !calibrating) {
      const targets = collectTargets();
      target = nearest(cursor, targets, s.snapRadius, currentTarget.current);
      snapped = snap(cursor, target, s.snapStrength);
    }

    // ---- dwell + intent ----
    let progress = 0;
    let intent = 0;
    const el = target?.el ?? null;
    if (el !== currentTarget.current) {
      currentTarget.current = el;
      dwellStart.current = el ? now : null;
      fixation.current.reset();
      if (el) revisits.current.set(el, (revisits.current.get(el) ?? 0) + 1);
    }

    if (el && !pausedRef.current && !calibrating && !lowConf) {
      const required = s.dwellMs;
      progress = Math.min(1, (now - (dwellStart.current ?? now)) / required);
      intent = intentScore({
        stability: fixation.current.stability(),
        dwellFraction: progress,
        confidence: f.confidence,
        targetArea: (target as GazeTarget).rect.width * (target as GazeTarget).rect.height,
        revisits: revisits.current.get(el) ?? 0,
        approachSpeed: fixation.current.speed(),
      });

      const canClick = s.mode === "normal";
      if (canClick && progress >= 1 && intent >= s.intentThreshold) {
        dwellStart.current = now + 400; // refractory period, prevents repeat fire
        progress = 0;
        onActivate(el);
      }
    }

    setState({
      status: "running",
      message: lowConf ? "Low confidence – input held" : "Tracking",
      cursor: snapped,
      confidence: f.confidence,
      tracking: true,
      fps: fpsAcc.current.length,
      jitter: jitter.current.value(),
      intent,
      dwellProgress: progress,
      targetLabel: el ? el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 24) || null : null,
      blinking: f.blinking,
    });
  }, [calibrating, onActivate, state.cursor]);

  const start = useCallback(async () => {
    setState((p) => ({ ...p, status: "loading", message: "Starting camera…" }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setState((p) => ({ ...p, message: "Loading tracking model…" }));
      const lm = await getLandmarker();
      (window as unknown as { __gazeLandmarker?: unknown }).__gazeLandmarker = lm;
      runningRef.current = true;
      setState((p) => ({ ...p, status: "running", message: "Tracking" }));
      raf.current = requestAnimationFrame(loop);
    } catch (e) {
      setState((p) => ({
        ...p,
        status: "error",
        message: e instanceof Error ? e.message : "Camera unavailable",
      }));
    }
  }, [loop]);

  useEffect(() => () => stop(), [stop]);

  const setPaused = useCallback((v: boolean) => {
    pausedRef.current = v;
    setState((p) => ({ ...p, status: v ? "paused" : "running", message: v ? "Paused" : "Tracking" }));
  }, []);

  /** Run a calibration sequence over the given screen points. */
  const runCalibration = useCallback(
    async (points: Vec2[], previous?: CalibrationModel | null) => {
      setCalibrating(true);
      setCalibTotal(points.length);
      const groups: CalibSample[][] = [];
      for (let i = 0; i < points.length; i++) {
        const pt = points[i] as Vec2;
        setCalibIndex(i);
        setCalibPoint(pt);
        await wait(900); // let the user find and settle on the target
        const group: CalibSample[] = [];
        collectRef.current = (features, confidence) => {
          if (confidence > 0.25) group.push({ features, target: pt });
        };
        await wait(1100);
        collectRef.current = null;
        groups.push(group);
      }
      setCalibPoint(null);
      setCalibrating(false);
      const clean = rejectOutliers(groups);
      if (clean.length < 20) return null;
      const model = fitModel(clean, window.innerWidth, window.innerHeight, previous);
      modelRef.current = model;
      stab.current.reset();
      onCalibrated(model);
      return model;
    },
    [onCalibrated],
  );

  return {
    videoRef,
    state,
    start,
    stop,
    setPaused,
    runCalibration,
    calibrating,
    calibPoint,
    calibIndex,
    calibTotal,
    model: modelRef,
    regionOf,
  };
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function clampToScreen(p: Vec2): Vec2 {
  return {
    x: Math.max(4, Math.min(window.innerWidth - 4, p.x)),
    y: Math.max(4, Math.min(window.innerHeight - 4, p.y)),
  };
}
