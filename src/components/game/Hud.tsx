"use client";

import { useMemo } from "react";
import { useGameStore } from "@/stores/gameStore";

export default function Hud() {
  const handDetected = useGameStore((s) => s.handDetected);
  const hands = useGameStore((s) => s.hands);
  const cameraReady = useGameStore((s) => s.cameraReady);
  const cameraError = useGameStore((s) => s.cameraError);
  const score = useGameStore((s) => s.score);
  const combo = useGameStore((s) => s.combo);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const phase = useGameStore((s) => s.phase);
  const chart = useGameStore((s) => s.chart);
  const currentTimeMs = useGameStore((s) => s.currentTimeMs);
  const lastJudgement = useGameStore((s) => s.lastJudgement);
  const judgementCounts = useGameStore((s) => s.judgementCounts);

  const progress = useMemo(() => {
    if (!chart) {
      return 0;
    }

    return Math.min(100, (currentTimeMs / chart.durationMs) * 100);
  }, [chart, currentTimeMs]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute left-6 top-6 space-y-1">
        <div className="font-mono text-4xl font-bold tabular-nums text-neon-cyan">
          {score.toLocaleString()}
        </div>
        {combo > 1 && (
          <div className="text-xl font-bold tabular-nums text-neon-magenta">{combo}x combo</div>
        )}
        {maxCombo > 0 && <div className="text-sm tabular-nums text-white/40">max: {maxCombo}x</div>}
      </div>

      <div className="absolute right-6 top-6 space-y-2 text-right">
        <div
          className={`rounded border px-2 py-1 text-xs ${
            cameraReady
              ? "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan"
              : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
          }`}
        >
          {cameraReady ? "camera ready" : "initializing camera..."}
        </div>
        <div
          className={`rounded border px-2 py-1 text-xs ${
            handDetected
              ? "border-neon-lime/30 bg-neon-lime/10 text-neon-lime"
              : "border-white/10 bg-white/5 text-white/30"
          }`}
        >
          {hands.length > 0 ? `${hands.length} hand${hands.length > 1 ? "s" : ""} detected` : "no hand"}
        </div>
        <div className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/50">
          phase: {phase}
        </div>
      </div>

      <div className="absolute left-1/2 top-6 w-[min(28rem,calc(100vw-4rem))] -translate-x-1/2">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-neon-cyan via-neon-lime to-neon-magenta transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {lastJudgement && phase === "playing" && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 text-center">
          <div
            className={`text-2xl font-bold uppercase tracking-[0.3em] ${
              lastJudgement === "perfect"
                ? "text-neon-lime"
                : lastJudgement === "good"
                  ? "text-neon-cyan"
                  : "text-red-400"
            }`}
          >
            {lastJudgement}
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-6 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-white/70 backdrop-blur">
        <div>Perfect: {judgementCounts.perfect}</div>
        <div>Good: {judgementCounts.good}</div>
        <div>Miss: {judgementCounts.miss}</div>
      </div>

      {cameraError && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-red-500/40 bg-red-500/20 px-6 py-3 text-sm text-red-300">
          {cameraError}
        </div>
      )}
    </div>
  );
}
