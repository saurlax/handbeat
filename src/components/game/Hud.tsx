"use client";

import { useGameStore } from "@/stores/gameStore";

export default function Hud() {
  const handDetected = useGameStore((s) => s.handDetected);
  const hands = useGameStore((s) => s.hands);
  const cameraReady = useGameStore((s) => s.cameraReady);
  const cameraError = useGameStore((s) => s.cameraError);
  const score = useGameStore((s) => s.score);
  const combo = useGameStore((s) => s.combo);
  const maxCombo = useGameStore((s) => s.maxCombo);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Top-left: Score and combo */}
      <div className="absolute top-6 left-6 space-y-1">
        <div className="text-4xl font-bold font-mono text-neon-cyan tabular-nums">
          {score.toLocaleString()}
        </div>
        {combo > 1 && (
          <div className="text-xl font-bold text-neon-magenta tabular-nums">
            {combo}x combo
          </div>
        )}
        {maxCombo > 0 && (
          <div className="text-sm text-white/40 tabular-nums">
            max: {maxCombo}x
          </div>
        )}
      </div>

      {/* Top-right: Status indicators */}
      <div className="absolute top-6 right-6 space-y-2 text-right">
        <div
          className={`text-xs px-2 py-1 rounded ${
            cameraReady
              ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30"
              : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
          }`}
        >
          {cameraReady ? "camera ready" : "initializing camera..."}
        </div>
        <div
          className={`text-xs px-2 py-1 rounded ${
            handDetected
              ? "bg-neon-lime/10 text-neon-lime border border-neon-lime/30"
              : "bg-white/5 text-white/30 border border-white/10"
          }`}
        >
          {hands.length > 0
            ? `${hands.length} hand${hands.length > 1 ? "s" : ""} detected`
            : "no hand"}
        </div>
      </div>

      {/* Error banner */}
      {cameraError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500/20 text-red-300 border border-red-500/40 rounded-lg px-6 py-3 text-sm">
          {cameraError}
        </div>
      )}
    </div>
  );
}
