"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Stars } from "@react-three/drei";
import { Suspense, useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";
import { TEST_CHART } from "@/game/chart";
import Scene from "./Scene";
import Hud from "./Hud";
import Cam from "./Cam";

export default function Stage() {
  const phase = useGameStore((state) => state.phase);
  const cameraReady = useGameStore((state) => state.cameraReady);
  const cameraError = useGameStore((state) => state.cameraError);
  const chart = useGameStore((state) => state.chart);
  const initializeGame = useGameStore((state) => state.initializeGame);
  const startGame = useGameStore((state) => state.startGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const score = useGameStore((state) => state.score);
  const maxCombo = useGameStore((state) => state.maxCombo);
  const judgementCounts = useGameStore((state) => state.judgementCounts);

  useEffect(() => {
    if (!chart) {
      initializeGame(TEST_CHART);
    }
  }, [chart, initializeGame]);

  return (
    <main className="relative h-screen w-full overflow-hidden bg-bg-deep">
      <div className="absolute inset-0 z-10">
        <Canvas
          camera={{ position: [0, 0, 12], fov: 60 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <Environment preset="night" />
            <Stars
              radius={50}
              depth={50}
              count={500}
              factor={4}
              saturation={0}
              fade
              speed={0.5}
            />
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      <Hud />

      {(phase === "boot" || phase === "ready" || phase === "finished") && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
          <div className="w-[min(90vw,28rem)] rounded-2xl border border-neon-cyan/20 bg-bg-surface/90 p-8 text-center shadow-2xl shadow-neon-cyan/10">
            {cameraError ? (
              <>
                <h1 className="text-2xl font-semibold text-red-300">Camera error</h1>
                <p className="mt-3 text-sm text-white/70">{cameraError}</p>
              </>
            ) : phase === "finished" ? (
              <>
                <h1 className="text-3xl font-semibold text-neon-cyan">Run complete</h1>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-left">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/40">Result</div>
                  <div className="mt-3 font-mono text-3xl font-bold text-neon-cyan tabular-nums">
                    {score.toLocaleString()}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-white/75">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/40">Perfect</div>
                      <div className="mt-1 font-mono text-xl tabular-nums text-neon-lime">
                        {judgementCounts.perfect}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/40">Good</div>
                      <div className="mt-1 font-mono text-xl tabular-nums text-neon-cyan">
                        {judgementCounts.good}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/40">Miss</div>
                      <div className="mt-1 font-mono text-xl tabular-nums text-red-400">
                        {judgementCounts.miss}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/40">Max Combo</div>
                      <div className="mt-1 font-mono text-xl tabular-nums text-neon-magenta">
                        {maxCombo}x
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetGame}
                  className="mt-6 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-6 py-3 text-sm font-semibold text-neon-cyan transition hover:bg-neon-cyan/20"
                >
                  Play again
                </button>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-semibold text-neon-cyan">
                  {cameraReady ? "Hand Beat v1" : "Initializing camera"}
                </h1>
                <p className="mt-3 text-sm leading-6 text-white/70">
                  用主手食指左右对准对应轨道即可命中，不需要把手压到画面最底部。
                </p>
                <p className="mt-2 text-xs tracking-[0.2em] text-white/40 uppercase">
                  5 lanes · hover hit · no backend yet
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  disabled={!cameraReady}
                  className="mt-6 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-6 py-3 text-sm font-semibold text-neon-cyan transition hover:bg-neon-cyan/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
                >
                  {cameraReady ? "Start run" : "Waiting for camera"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <Cam />
    </main>
  );
}
