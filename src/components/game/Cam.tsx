"use client";

import { useEffect, useRef, useCallback } from "react";
import { useGameStore, type Hand } from "@/stores/gameStore";

type Landmark = {
  x: number;
  y: number;
  z: number;
};

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export default function Cam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingRef = useRef(false);
  const detectAtRef = useRef(0);
  const seenAtRef = useRef(0);
  const handsRef = useRef<Hand[]>([]);
  const MAX_DETECTION_FPS = 20;
  const DETECTION_INTERVAL_MS = 1000 / MAX_DETECTION_FPS;
  const LANDMARK_STALE_MS = 120;

  const {
    setHandPosition,
    setHandDetected,
    setHands,
    setCameraReady,
    setCameraError,
  } = useGameStore();

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const worker = workerRef.current;

    if (!video || !canvas || !worker) return;
    if (video.readyState < 2) {
      requestAnimationFrame(processFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      requestAnimationFrame(processFrame);
      return;
    }

    if (handsRef.current.length > 0 && performance.now() - seenAtRef.current > LANDMARK_STALE_MS) {
      handsRef.current = [];
    }

    ctx.drawImage(video, 0, 0);

    const handColors: Record<string, { line: string; point: string; tip: string }> = {
      Left: {
        line: "rgba(0, 255, 255, 0.9)",
        point: "rgba(0, 255, 255, 0.95)",
        tip: "rgba(255, 80, 240, 0.95)",
      },
      Right: {
        line: "rgba(255, 170, 0, 0.95)",
        point: "rgba(255, 170, 0, 0.95)",
        tip: "rgba(255, 80, 240, 0.95)",
      },
      Unknown: {
        line: "rgba(120, 255, 120, 0.9)",
        point: "rgba(120, 255, 120, 0.95)",
        tip: "rgba(255, 80, 240, 0.95)",
      },
    };

    if (handsRef.current.length > 0) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const hand of handsRef.current) {
        const colors = handColors[hand.handedness] ?? handColors.Unknown;
        const landmarks = hand.landmarks;

        ctx.strokeStyle = colors.line;
        ctx.fillStyle = colors.point;
        ctx.lineWidth = Math.max(2, canvas.width * 0.008);

        for (const [start, end] of HAND_CONNECTIONS) {
          const startPoint = landmarks[start];
          const endPoint = landmarks[end];
          if (!startPoint || !endPoint) continue;

          ctx.beginPath();
          ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
          ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
          ctx.stroke();
        }

        for (let index = 0; index < landmarks.length; index += 1) {
          const point = landmarks[index];
          ctx.beginPath();
          ctx.fillStyle = index === 8 ? colors.tip : colors.point;
          ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            index === 8 ? Math.max(4, canvas.width * 0.012) : Math.max(3, canvas.width * 0.009),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      ctx.restore();
    }

    const now = performance.now();
    if (!processingRef.current && now - detectAtRef.current >= DETECTION_INTERVAL_MS) {
      processingRef.current = true;
      detectAtRef.current = now;

      createImageBitmap(canvas)
        .then((bitmap) => {
          console.log("[main] posting detect, ts=%.0f", now);
          worker.postMessage({ type: "detect", bitmap, timestamp: now }, [bitmap]);
        })
        .catch(() => {
          processingRef.current = false;
        });
    }

    requestAnimationFrame(processFrame);
  }, []);

  useEffect(() => {
    const worker = new Worker(
      new URL("@/workers/tracker.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type } = event.data;
      console.log("[main] worker message:", type, type === "result" ? { detected: event.data.detected, hands: event.data.hands?.length } : "");
      if (type === "ready") {
        setCameraReady(true);
      } else if (type === "result") {
        const { x, y, z, detected, hands } = event.data;
        processingRef.current = false;
        setHandDetected(detected);
        setHands(hands);
        if (detected) {
          seenAtRef.current = performance.now();
          handsRef.current = hands;
          setHandPosition(1 - x, y, z);
        }
      } else if (type === "error") {
        processingRef.current = false;
        setCameraError(event.data.error);
      }
    };

    worker.postMessage({ type: "init" });

    return () => {
      worker.postMessage({ type: "close" });
      worker.terminate();
      workerRef.current = null;
      processingRef.current = false;
      detectAtRef.current = 0;
    };
  }, [setCameraReady, setCameraError, setHandDetected, setHandPosition]);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: "user",
          },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          processFrame();
        }
      } catch (err) {
        setCameraError(
          `Camera access denied: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [processFrame, setCameraError]);

  return (
    <div className="absolute bottom-4 right-4 z-20 w-48 rounded-lg overflow-hidden border-2 border-neon-cyan/30 shadow-lg shadow-neon-cyan/10">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas
        ref={canvasRef}
        className="w-full h-auto block opacity-80"
        style={{ transform: "scaleX(-1)" }}
      />
      <div className="absolute top-1 left-1 bg-black/60 text-neon-cyan text-xs px-1.5 py-0.5 rounded">
        camera
      </div>
    </div>
  );
}
