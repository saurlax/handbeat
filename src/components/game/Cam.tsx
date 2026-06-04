"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore, type Hand } from "@/stores/gameStore";

type Point = { x: number; y: number; z: number };

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const PALETTE: Record<string, { line: string; point: string; tip: string }> = {
  Left:   { line: "rgba(0,255,255,0.9)",  point: "rgba(0,255,255,0.95)",  tip: "rgba(255,80,240,0.95)" },
  Right:  { line: "rgba(255,170,0,0.95)", point: "rgba(255,170,0,0.95)", tip: "rgba(255,80,240,0.95)" },
  Unknown:{ line: "rgba(120,255,120,0.9)",point: "rgba(120,255,120,0.95)",tip: "rgba(255,80,240,0.95)" },
};

const MAX_FPS = 20;
const INTERVAL = 1000 / MAX_FPS;
const STALE_MS = 120;

export default function Cam() {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const workerRef   = useRef<Worker | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef(0);
  const runningRef  = useRef(false);
  const busyRef     = useRef(false);
  const detectAtRef = useRef(0);
  const seenAtRef   = useRef(0);
  const handsRef    = useRef<Hand[]>([]);

  const { setHands, setCameraReady, setCameraError } = useGameStore();

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    for (const hand of handsRef.current) {
      const c = PALETTE[hand.handedness] ?? PALETTE.Unknown;
      ctx.strokeStyle = c.line;
      ctx.lineWidth = Math.max(2, w * 0.008);
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = hand.landmarks[a], pb = hand.landmarks[b];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * w, pa.y * h);
        ctx.lineTo(pb.x * w, pb.y * h);
        ctx.stroke();
      }
      for (let i = 0; i < hand.landmarks.length; i++) {
        const p = hand.landmarks[i];
        ctx.fillStyle = i === 8 ? c.tip : c.point;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, i === 8 ? Math.max(4, w * 0.012) : Math.max(3, w * 0.009), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  const tick = useCallback(() => {
    if (!runningRef.current) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const worker = workerRef.current;
    if (!video || !canvas || !worker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }

    // expire stale landmarks
    if (handsRef.current.length && performance.now() - seenAtRef.current > STALE_MS) {
      handsRef.current = [];
    }

    ctx.drawImage(video, 0, 0);
    draw(ctx, canvas.width, canvas.height);

    // throttle detection
    const now = performance.now();
    if (!busyRef.current && now - detectAtRef.current >= INTERVAL) {
      busyRef.current = true;
      detectAtRef.current = now;
      createImageBitmap(canvas).then((bmp) => {
        worker.postMessage({ type: "detect", bitmap: bmp, timestamp: now }, [bmp]);
      }).catch(() => { busyRef.current = false; });
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    handsRef.current = [];
    setHands([]);
  }, [setHands]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setCameraError(`Camera access denied: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [tick, setCameraError]);

  useEffect(() => {
    const w = new Worker(
      new URL("@/workers/tracker.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = w;

    w.onmessage = (e) => {
      const { type } = e.data;
      if (type === "ready") {
        setCameraError(null);
        setCameraReady(true);
      } else if (type === "result") {
        busyRef.current = false;
        const { detected, hands } = e.data;
        setHands(hands);
        if (detected) {
          seenAtRef.current = performance.now();
          handsRef.current = hands;
        } else {
          handsRef.current = [];
        }
      } else if (type === "error") {
        busyRef.current = false;
        setCameraReady(false);
        setCameraError(e.data.error);
      }
    };
    w.postMessage({ type: "init" });

    return () => {
      w.postMessage({ type: "close" });
      w.terminate();
      workerRef.current = null;
      busyRef.current = false;
    };
  }, [setCameraReady, setCameraError, setHands]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const onVis = () => document.hidden ? stopCamera() : startCamera();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [startCamera, stopCamera]);

  return (
    <div className="absolute bottom-4 right-4 z-20 w-48 rounded-lg overflow-hidden border-2 border-neon-cyan/30 shadow-lg shadow-neon-cyan/10">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="w-full h-auto block opacity-80" style={{ transform: "scaleX(-1)" }} />
      <div className="absolute top-1 left-1 bg-black/60 text-neon-cyan text-xs px-1.5 py-0.5 rounded">camera</div>
    </div>
  );
}
