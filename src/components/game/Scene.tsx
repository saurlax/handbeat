"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGameStore, type Hand, type NoteInstance } from "@/stores/gameStore";

const LANES = 5;
const LANE_WIDTH = 5;
const JUDGE_LINE_Y = -3.8;
const NOTE_SPAWN_Z = -16;
const NOTE_JUDGE_Z = 0;
const APPROACH_MS = 2200;
const PERFECT_WINDOW_MS = 80;
const GOOD_WINDOW_MS = 160;
const MISS_WINDOW_MS = 180;

function getLaneCenter(lane: number) {
  return ((lane - (LANES - 1) / 2) / ((LANES - 1) / 2)) * (LANE_WIDTH / 2);
}

function getLaneFromX(x: number) {
  const normalized = Math.min(0.999, Math.max(0, x));
  return Math.min(LANES - 1, Math.floor(normalized * LANES));
}

function noteZPosition(note: NoteInstance, currentTimeMs: number) {
  const progress = 1 - (note.hitTimeMs - currentTimeMs) / APPROACH_MS;
  return NOTE_SPAWN_Z + progress * (NOTE_JUDGE_Z - NOTE_SPAWN_Z);
}

function isVisibleNote(note: NoteInstance, currentTimeMs: number) {
  if (note.status !== "pending") {
    return false;
  }

  const delta = note.hitTimeMs - currentTimeMs;
  return delta <= APPROACH_MS && delta >= -500;
}

function FeedbackBurst({
  visible,
  color,
}: {
  visible: boolean;
  color: string;
}) {
  return (
    <mesh position={[0, JUDGE_LINE_Y, 0.3]} visible={visible}>
      <torusGeometry args={[3.6, 0.05, 16, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </mesh>
  );
}

export default function Scene() {
  const phase = useGameStore((s) => s.phase);
  const indexTipX = useGameStore((s) => s.indexTipX);
  const indexTipY = useGameStore((s) => s.indexTipY);
  const hands = useGameStore((s) => s.hands);
  const notes = useGameStore((s) => s.notes);
  const currentTimeMs = useGameStore((s) => s.currentTimeMs);
  const chart = useGameStore((s) => s.chart);
  const lastJudgement = useGameStore((s) => s.lastJudgement);
  const tickGame = useGameStore((s) => s.tickGame);
  const registerHit = useGameStore((s) => s.registerHit);
  const registerMiss = useGameStore((s) => s.registerMiss);
  const finishGame = useGameStore((s) => s.finishGame);

  const handsRef = useRef<Hand[]>([]);
  const seenAtRef = useRef(0);
  const feedbackUntilRef = useRef(0);
  const feedbackColorRef = useRef("#00f0ff");

  const laneCenters = useMemo(
    () => Array.from({ length: LANES }, (_, lane) => getLaneCenter(lane)),
    []
  );

  useEffect(() => {
    if (hands.length > 0) {
      handsRef.current = hands;
      seenAtRef.current = performance.now();
    }
  }, [hands]);

  useEffect(() => {
    if (!lastJudgement) {
      return;
    }

    feedbackUntilRef.current = performance.now() + 120;
    feedbackColorRef.current =
      lastJudgement === "perfect"
        ? "#39ff14"
        : lastJudgement === "good"
          ? "#00f0ff"
          : "#ff3366";
  }, [lastJudgement]);

  useFrame(() => {
    const now = performance.now();
    if (handsRef.current.length > 0 && now - seenAtRef.current > 140) {
      handsRef.current = [];
    }

    if (phase !== "playing") {
      return;
    }

    tickGame(now);

    const state = useGameStore.getState();
    const time = state.currentTimeMs;

    for (const note of state.notes) {
      if (note.status === "pending" && time - note.hitTimeMs > MISS_WINDOW_MS) {
        registerMiss(note.id);
      }
    }

    const primaryHand = handsRef.current[0];
    if (primaryHand) {
      const lane = getLaneFromX(indexTipX);
      const candidate = state.notes.find(
        (note) =>
          note.status === "pending" &&
          note.lane === lane &&
          Math.abs(note.hitTimeMs - time) <= GOOD_WINDOW_MS
      );

      if (candidate) {
        const delta = Math.abs(candidate.hitTimeMs - time);
        registerHit(candidate.id, delta <= PERFECT_WINDOW_MS ? "perfect" : "good");
      }
    }

    const refreshed = useGameStore.getState();
    if (
      refreshed.chart &&
      refreshed.currentTimeMs >= refreshed.chart.durationMs &&
      refreshed.notes.every((note) => note.status !== "pending")
    ) {
      finishGame();
    }
  });

  const feedbackVisible = feedbackUntilRef.current > performance.now();

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 5, 10]} intensity={100} color="#00f0ff" distance={30} />
      <pointLight position={[0, -2, 6]} intensity={40} color="#ff00ff" distance={20} />

      <mesh position={[0, -4.9, -7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 24]} />
        <meshBasicMaterial color="#09111f" transparent opacity={0.88} />
      </mesh>

      {laneCenters.map((x, i) => (
        <group key={`lane-${i}`}>
          <mesh position={[x, JUDGE_LINE_Y, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.36, 48]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.4} />
          </mesh>
          <mesh position={[x, -3.8, -8]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.06, 16]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.14} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, JUDGE_LINE_Y, 0.15]}>
        <planeGeometry args={[LANE_WIDTH + 2.4, 0.42]} />
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.18} />
      </mesh>

      <FeedbackBurst visible={feedbackVisible} color={feedbackColorRef.current} />

      {notes.filter((note) => isVisibleNote(note, currentTimeMs)).map((note) => {
        const z = noteZPosition(note, currentTimeMs);
        const laneX = getLaneCenter(note.lane);
        const hue =
          note.lane === 0 || note.lane === 4
            ? "#ffb100"
            : note.lane === 2
              ? "#39ff14"
              : "#00f0ff";

        return (
          <group key={note.id} position={[laneX, JUDGE_LINE_Y, z]}>
            <mesh>
              <cylinderGeometry args={[0.28, 0.28, 0.2, 24]} />
              <meshStandardMaterial
                color={hue}
                emissive={hue}
                emissiveIntensity={1}
                transparent
                opacity={0.92}
              />
            </mesh>
            <mesh position={[0, 0, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.34, 0.05, 12, 36]} />
              <meshBasicMaterial color={hue} transparent opacity={0.4} />
            </mesh>
          </group>
        );
      })}

      <mesh
        position={[
          handsRef.current[0] ? (indexTipX - 0.5) * LANE_WIDTH : 0,
          handsRef.current[0] ? (1 - indexTipY) * 4 - 2 : 0,
          0.6,
        ]}
        visible={Boolean(handsRef.current[0])}
      >
        <sphereGeometry args={[0.2, 18, 18]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00f0ff"
          emissiveIntensity={0.9}
          transparent
          opacity={0.88}
        />
        <mesh position={[0, 0, -0.1]}>
          <ringGeometry args={[0.24, 0.32, 32]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.45} />
        </mesh>
      </mesh>

      <mesh
        position={[
          handsRef.current[1] ? (handsRef.current[1].indexTipX - 0.5) * LANE_WIDTH : 0,
          handsRef.current[1] ? (1 - handsRef.current[1].indexTipY) * 4 - 2 : 0,
          0.3,
        ]}
        visible={Boolean(handsRef.current[1])}
      >
        <sphereGeometry args={[0.15, 18, 18]} />
        <meshStandardMaterial
          color="#ffb100"
          emissive="#ffb100"
          emissiveIntensity={0.9}
          transparent
          opacity={0.82}
        />
      </mesh>
    </>
  );
}
