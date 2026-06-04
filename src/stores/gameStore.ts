import { create } from "zustand";

export interface Hand {
  handedness: string;
  landmarks: Array<{ x: number; y: number; z: number }>;
  indexTipX: number;
  indexTipY: number;
  indexTipZ: number;
}

export type GamePhase = "boot" | "ready" | "playing" | "finished";
export type Judgement = "perfect" | "good" | "miss";

export interface Note {
  id: string;
  lane: number;
  hitTimeMs: number;
  type: "tap";
}

export interface Chart {
  durationMs: number;
  notes: Note[];
}

export interface NoteInstance extends Note {
  status: "pending" | "hit" | "miss";
}

export interface JudgementCounts {
  perfect: number;
  good: number;
  miss: number;
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

const EMPTY_COUNTS: JudgementCounts = {
  perfect: 0,
  good: 0,
  miss: 0,
};

const PERFECT_POINTS = 1000;
const GOOD_POINTS = 600;

interface GameState {
  handDetected: boolean;
  indexTipX: number;
  indexTipY: number;
  indexTipZ: number;
  hands: Hand[];

  phase: GamePhase;
  chart: Chart | null;
  notes: NoteInstance[];
  currentTimeMs: number;
  startedAtMs: number | null;
  score: number;
  combo: number;
  maxCombo: number;
  noteSpeed: number;
  judgementCounts: JudgementCounts;
  lastJudgement: Judgement | null;
  inferenceLatencyMs: number;

  cameraReady: boolean;
  cameraError: string | null;

  setHands: (hands: Hand[]) => void;
  setHandDetected: (detected: boolean) => void;
  initializeGame: (chart: Chart) => void;
  startGame: () => void;
  tickGame: (nowMs: number) => void;
  registerHit: (noteId: string, judgement: Exclude<Judgement, "miss">) => void;
  registerMiss: (noteId: string) => void;
  finishGame: () => void;
  resetGame: () => void;
  setCameraReady: (ready: boolean) => void;
  setCameraError: (error: string | null) => void;
  setInferenceLatency: (latencyMs: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  handDetected: false,
  indexTipX: 0.5,
  indexTipY: 0.5,
  indexTipZ: 0,
  hands: [],

  phase: "boot",
  chart: null,
  notes: [],
  currentTimeMs: 0,
  startedAtMs: null,
  score: 0,
  combo: 0,
  maxCombo: 0,
  noteSpeed: 3,
  judgementCounts: { ...EMPTY_COUNTS },
  lastJudgement: null,
  inferenceLatencyMs: 0,

  cameraReady: false,
  cameraError: null,

  setHands: (hands) =>
    set(() => ({
      hands: hands.map(mirrorHand),
      handDetected: hands.length > 0,
      indexTipX: hands[0] ? 1 - hands[0].indexTipX : 0.5,
      indexTipY: hands[0]?.indexTipY ?? 0.5,
      indexTipZ: hands[0]?.indexTipZ ?? 0,
    })),

  setHandDetected: (detected) => set({ handDetected: detected }),

  initializeGame: (chart) =>
    set((state) => ({
      chart,
      notes: chart.notes.map((note) => ({ ...note, status: "pending" })),
      currentTimeMs: 0,
      startedAtMs: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      judgementCounts: { ...EMPTY_COUNTS },
      lastJudgement: null,
      inferenceLatencyMs: 0,
      phase: state.cameraReady ? "ready" : "boot",
    })),

  startGame: () =>
    set((state) => {
      if (!state.chart || !state.cameraReady || state.cameraError) {
        return state;
      }

      return {
        phase: "playing",
        currentTimeMs: 0,
        startedAtMs: performance.now(),
        score: 0,
        combo: 0,
        maxCombo: 0,
        judgementCounts: { ...EMPTY_COUNTS },
        lastJudgement: null,
        inferenceLatencyMs: 0,
        notes: state.chart.notes.map((note) => ({ ...note, status: "pending" })),
      };
    }),

  tickGame: (nowMs) =>
    set((state) => {
      if (state.phase !== "playing" || state.startedAtMs === null) {
        return state;
      }

      const currentTimeMs = Math.max(0, nowMs - state.startedAtMs);
      return { currentTimeMs };
    }),

  registerHit: (noteId, judgement) =>
    set((state) => {
      const noteIndex = state.notes.findIndex((note) => note.id === noteId);
      if (noteIndex === -1 || state.notes[noteIndex].status !== "pending") {
        return state;
      }

      const points = judgement === "perfect" ? PERFECT_POINTS : GOOD_POINTS;
      const combo = state.combo + 1;
      const nextNotes = state.notes.slice();
      nextNotes[noteIndex] = { ...nextNotes[noteIndex], status: "hit" };

      return {
        notes: nextNotes,
        score: state.score + points,
        combo,
        maxCombo: Math.max(state.maxCombo, combo),
        lastJudgement: judgement,
        judgementCounts: {
          ...state.judgementCounts,
          [judgement]: state.judgementCounts[judgement] + 1,
        },
      };
    }),

  registerMiss: (noteId) =>
    set((state) => {
      const noteIndex = state.notes.findIndex((note) => note.id === noteId);
      if (noteIndex === -1 || state.notes[noteIndex].status !== "pending") {
        return state;
      }

      const nextNotes = state.notes.slice();
      nextNotes[noteIndex] = { ...nextNotes[noteIndex], status: "miss" };

      return {
        notes: nextNotes,
        combo: 0,
        lastJudgement: "miss",
        judgementCounts: {
          ...state.judgementCounts,
          miss: state.judgementCounts.miss + 1,
        },
      };
    }),

  finishGame: () =>
    set((state) => {
      if (state.phase !== "playing") {
        return state;
      }

      return {
        phase: "finished",
        startedAtMs: null,
      };
    }),

  resetGame: () =>
    set((state) => ({
      phase: state.cameraReady ? "ready" : "boot",
      notes: state.chart ? state.chart.notes.map((note) => ({ ...note, status: "pending" })) : [],
      currentTimeMs: 0,
      startedAtMs: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      judgementCounts: { ...EMPTY_COUNTS },
      lastJudgement: null,
      inferenceLatencyMs: 0,
    })),

  setCameraReady: (ready) =>
    set((state) => ({
      cameraReady: ready,
      phase:
        ready && state.phase === "boot" && state.chart
          ? "ready"
          : !ready && state.phase !== "playing"
            ? "boot"
            : state.phase,
    })),

  setCameraError: (error) =>
    set((state) => ({
      cameraError: error,
      cameraReady: error ? false : state.cameraReady,
      phase: error && state.phase !== "playing" ? "boot" : state.phase,
    })),

  setInferenceLatency: (latencyMs) =>
    set({
      inferenceLatencyMs: Math.max(0, Math.round(latencyMs)),
    }),
}));

export function getPendingLaneNote(
  notes: NoteInstance[],
  lane: number,
  currentTimeMs: number,
  windowMs: number
) {
  return notes.find(
    (note) =>
      note.status === "pending" &&
      note.lane === lane &&
      Math.abs(note.hitTimeMs - currentTimeMs) <= windowMs
  );
}
