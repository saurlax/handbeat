"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Stars } from "@react-three/drei";
import { Suspense } from "react";
import { useGameStore } from "@/stores/gameStore";
import Scene from "./Scene";
import Hud from "./Hud";
import Cam from "./Cam";

export default function Stage() {
  const cameraReady = useGameStore((state) => state.cameraReady);
  const cameraError = useGameStore((state) => state.cameraError);

  return (
    <main className="relative w-full h-screen overflow-hidden bg-bg-deep">
      {/* Loading / error overlay */}
      {!cameraReady && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="text-neon-cyan text-lg animate-pulse">
            {cameraError ?? "Initializing camera..."}
          </div>
        </div>
      )}

      {/* 3D Scene */}
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

      {/* HUD */}
      <Hud />

      {/* Camera Preview */}
      <Cam />
    </main>
  );
}
