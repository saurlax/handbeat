// Web Worker: Hand Tracking via MediaPipe
// Receives ImageBitmap from main thread, runs inference, returns landmarks.

let detector: any = null;
let ready = false;

type Point = { x: number; y: number; z: number };
type Hand = {
  handedness: string;
  landmarks: Point[];
  indexTipX: number;
  indexTipY: number;
  indexTipZ: number;
};

async function initDetector() {
  try {
    const { HandLandmarker, FilesetResolver } = await import(
      "@mediapipe/tasks-vision"
    );

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
    );

    detector = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    ready = true;
    self.postMessage({ type: "ready" });
  } catch (error) {
    self.postMessage({ type: "error", error: String(error) });
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, timestamp } = event.data;

  switch (type) {
    case "init":
      await initDetector();
      break;

    case "detect":
      if (!ready || !detector) {
        console.warn("[worker] detect ignored: ready=%s detector=%s", ready, !!detector);
        return;
      }

      const bitmap = event.data.bitmap as ImageBitmap;
      if (!bitmap) {
        console.warn("[worker] detect ignored: no bitmap");
        return;
      }

      try {
        const results = detector.detectForVideo(bitmap, timestamp);
        console.log("[worker] detectForVideo result: landmarks=%d", results.landmarks?.length ?? 0);

        if (results.landmarks && results.landmarks.length > 0) {
          const hands: Hand[] = results.landmarks.map((points: Point[], index: number) => {
            const handedness = results.handedness?.[index]?.[0]?.categoryName ?? "Unknown";
            const tip = points[8];

            return {
              handedness,
              landmarks: points,
              indexTipX: tip?.x ?? 0,
              indexTipY: tip?.y ?? 0,
              indexTipZ: tip?.z ?? 0,
            };
          });

          const primaryHand = hands[0];
          self.postMessage({
            type: "result",
            x: primaryHand.indexTipX,
            y: primaryHand.indexTipY,
            z: primaryHand.indexTipZ,
            detected: true,
            hands,
          });
        } else {
          self.postMessage({
            type: "result",
            x: 0,
            y: 0,
            z: 0,
            detected: false,
            hands: [],
          });
        }
      } catch {
        self.postMessage({
          type: "result",
          x: 0,
          y: 0,
          z: 0,
          detected: false,
          hands: [],
        });
      } finally {
        bitmap.close();
      }
      break;

    case "close":
      if (detector) {
        detector.close();
        detector = null;
      }
      ready = false;
      break;
  }
};
