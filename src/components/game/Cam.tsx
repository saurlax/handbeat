"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore, type Hand } from "@/stores/gameStore";

type HandLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number
  ) => {
    landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    handedness?: Array<Array<{ categoryName?: string }>>;
  };
  close: () => void;
};

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const PALETTE: Record<string, { line: string; point: string; tip: string }> = {
  Left: { line: "rgba(0,255,255,0.9)", point: "rgba(0,255,255,0.95)", tip: "rgba(255,80,240,0.95)" },
  Right: { line: "rgba(255,170,0,0.95)", point: "rgba(255,170,0,0.95)", tip: "rgba(255,80,240,0.95)" },
  Unknown: { line: "rgba(120,255,120,0.9)", point: "rgba(120,255,120,0.95)", tip: "rgba(255,80,240,0.95)" },
};

const TASKS_VISION_VERSION = "0.10.35";
const STALE_MS = 180;

export default function Cam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<HandLandmarkerInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  const seenAtRef = useRef(0);
  const handsRef = useRef<Hand[]>([]);

  const { setHands, setCameraReady, setCameraError, setInferenceLatency } = useGameStore();

  const drawOverlay = useCallback((canvas: HTMLCanvasElement, hands: Hand[]) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const hand of hands) {
      const c = PALETTE[hand.handedness] ?? PALETTE.Unknown;
      ctx.strokeStyle = c.line;
      ctx.lineWidth = Math.max(2, canvas.width * 0.008);

      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = hand.landmarks[a];
        const pb = hand.landmarks[b];
        if (!pa || !pb) {
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
        ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
        ctx.stroke();
      }

      for (let i = 0; i < hand.landmarks.length; i += 1) {
        const p = hand.landmarks[i];
        ctx.fillStyle = i === 8 ? c.tip : c.point;
        ctx.beginPath();
        ctx.arc(
          p.x * canvas.width,
          p.y * canvas.height,
          i === 8 ? Math.max(4, canvas.width * 0.012) : Math.max(3, canvas.width * 0.009),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
  }, []);

  const updateOverlaySize = useCallback(() => {
    const video = videoRef.current;
    const canvas = overlayRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  }, []);

  const tick = useCallback(() => {
    if (!runningRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = overlayRef.current;
    const detector = detectorRef.current;
    if (!video || !canvas || !detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    updateOverlaySize();

    const now = performance.now();
    if (handsRef.current.length > 0 && now - seenAtRef.current > STALE_MS) {
      handsRef.current = [];
      setHands([]);
      drawOverlay(canvas, []);
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      try {
        const inferenceStart = performance.now();
        const results = detector.detectForVideo(video, now);
        setInferenceLatency(performance.now() - inferenceStart);
        const landmarks = results.landmarks ?? [];

        if (landmarks.length > 0) {
          const hands: Hand[] = landmarks.map((points, index) => {
            const handedness =
              results.handedness?.[index]?.[0]?.categoryName ?? "Unknown";
            const tip = points[8];

            return {
              handedness,
              landmarks: points,
              indexTipX: tip?.x ?? 0,
              indexTipY: tip?.y ?? 0,
              indexTipZ: tip?.z ?? 0,
            };
          });

          handsRef.current = hands;
          seenAtRef.current = now;
          setHands(hands);
          drawOverlay(canvas, hands);
        } else if (handsRef.current.length > 0) {
          handsRef.current = [];
          setHands([]);
          drawOverlay(canvas, []);
        }
      } catch (error) {
        setInferenceLatency(0);
        setCameraError(
          `Hand tracking failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [drawOverlay, setCameraError, setHands, setInferenceLatency, updateOverlaySize]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    lastVideoTimeRef.current = -1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    handsRef.current = [];
    setHands([]);
    setInferenceLatency(0);
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext("2d");
      ctx?.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  }, [setHands, setInferenceLatency]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60, min: 30 },
          facingMode: "user",
        },
      });

      streamRef.current = stream;
      if (!videoRef.current) {
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      updateOverlaySize();
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(tick);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setCameraError(
        `Camera access denied: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, [setCameraError, tick, updateOverlaySize]);

  useEffect(() => {
    let cancelled = false;

    const initDetector = async () => {
      try {
        const { HandLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(
          `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
        );

        const detector = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.4,
        });

        if (cancelled) {
          detector.close();
          return;
        }

        detectorRef.current = detector as HandLandmarkerInstance;
        setCameraError(null);
        setCameraReady(true);
      } catch (error) {
        setCameraReady(false);
        setCameraError(
          `Hand tracker init failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    };

    initDetector();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, [setCameraError, setCameraReady]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const onResize = () => updateOverlaySize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateOverlaySize]);

  useEffect(() => {
    const onVis = () => (document.hidden ? stopCamera() : startCamera());
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [startCamera, stopCamera]);

  return (
    <div className="absolute bottom-4 right-4 z-20 w-48 overflow-hidden rounded-lg border-2 border-neon-cyan/30 shadow-lg shadow-neon-cyan/10">
      <div className="relative">
        <video
          ref={videoRef}
          className="block h-auto w-full scale-x-[-1] opacity-80"
          playsInline
          muted
        />
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
        />
        <div className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-neon-cyan">
          camera
        </div>
      </div>
    </div>
  );
}
