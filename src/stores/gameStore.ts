import { create } from "zustand";

export interface Hand {
  handedness: string;
  landmarks: Array<{ x: number; y: number; z: number }>;
  indexTipX: number;
  indexTipY: number;
  indexTipZ: number;
}

function mirrorHand(hand: Hand): Hand {
  return {
    ...hand,
    indexTipX: 1 - hand.indexTipX,
    landmarks: hand.landmarks.map((landmark) => ({
      ...landmark,
      x: 1 - landmark.x,
    })),
  };
}

interface GameState {
  // Hand tracking
  handDetected: boolean;
  indexTipX: number;
  indexTipY: number;
  indexTipZ: number;
  hands: Hand[];

  // Game state
  gameStarted: boolean;
  score: number;
  combo: number;
  maxCombo: number;
  noteSpeed: number;

  // Camera
  cameraReady: boolean;
  cameraError: string | null;

  // Actions
  setHandPosition: (x: number, y: number, z: number) => void;
  setHandDetected: (detected: boolean) => void;
  setHands: (hands: Hand[]) => void;
  increaseScore: (points: number) => void;
  breakCombo: () => void;
  startGame: () => void;
  setCameraReady: (ready: boolean) => void;
  setCameraError: (error: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  handDetected: false,
  indexTipX: 0.5,
  indexTipY: 0.5,
  indexTipZ: 0,
  hands: [],

  gameStarted: false,
  score: 0,
  combo: 0,
  maxCombo: 0,
  noteSpeed: 3,

  cameraReady: false,
  cameraError: null,

  setHandPosition: (x, y, z) =>
    set({ indexTipX: x, indexTipY: y, indexTipZ: z }),

  setHandDetected: (detected) => set({ handDetected: detected }),

  setHands: (hands) =>
    set(() => ({
      hands: hands.map(mirrorHand),
      handDetected: hands.length > 0,
      indexTipX: hands[0] ? 1 - hands[0].indexTipX : 0.5,
      indexTipY: hands[0]?.indexTipY ?? 0.5,
      indexTipZ: hands[0]?.indexTipZ ?? 0,
    })),

  increaseScore: (points) =>
    set((state) => {
      const newCombo = state.combo + 1;
      return {
        score: state.score + points * (1 + Math.floor(newCombo / 10)),
        combo: newCombo,
        maxCombo: Math.max(state.maxCombo, newCombo),
      };
    }),

  breakCombo: () => set({ combo: 0 }),

  startGame: () => set({ gameStarted: true, score: 0, combo: 0, maxCombo: 0 }),

  setCameraReady: (ready) => set({ cameraReady: ready }),

  setCameraError: (error) => set({ cameraError: error }),
}));
