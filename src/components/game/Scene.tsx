"use client";

import { useEffect, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGameStore, type Hand } from "@/stores/gameStore";
import type { Mesh } from "three";

// Track lanes — 5 vertical lanes mapped from hand X position
const LANES = 5;
const LANE_WIDTH = 3.5;

export default function Scene() {
  const indexTipX = useGameStore((s) => s.indexTipX);
  const indexTipY = useGameStore((s) => s.indexTipY);
  const hands = useGameStore((s) => s.hands);

  const cursorRef = useRef<Mesh>(null);
  const secondaryCursorRef = useRef<Mesh>(null);
  const handsRef = useRef<Hand[]>([]);
  const seenAtRef = useRef(0);
  const laneRings = useMemo(
    () =>
      Array.from({ length: LANES }, (_, i) => {
        const x = ((i - (LANES - 1) / 2) / ((LANES - 1) / 2)) * (LANE_WIDTH / 2);
        return x;
      }),
    []
  );

  useEffect(() => {
    if (hands.length > 0) {
      handsRef.current = hands;
      seenAtRef.current = performance.now();
    }
  }, [hands]);

  // Update cursor position based on hand tracking
  useFrame(() => {
    if (handsRef.current.length > 0 && performance.now() - seenAtRef.current > 120) {
      handsRef.current = [];
    }

    if (cursorRef.current) {
      const primaryHand = handsRef.current[0];
      if (primaryHand) {
        // Map 0-1 hand position to scene coordinates
        const targetX = (indexTipX - 0.5) * LANE_WIDTH;
        const targetY = (1 - indexTipY) * 4 - 2;

        cursorRef.current.position.x += (targetX - cursorRef.current.position.x) * 0.3;
        cursorRef.current.position.y += (targetY - cursorRef.current.position.y) * 0.3;
        cursorRef.current.visible = true;
      } else {
        cursorRef.current.visible = false;
      }
    }

    if (secondaryCursorRef.current) {
      const secondaryHand = handsRef.current[1];
      if (secondaryHand) {
        const targetX = (secondaryHand.indexTipX - 0.5) * LANE_WIDTH;
        const targetY = (1 - secondaryHand.indexTipY) * 4 - 2;

        secondaryCursorRef.current.position.x +=
          (targetX - secondaryCursorRef.current.position.x) * 0.3;
        secondaryCursorRef.current.position.y +=
          (targetY - secondaryCursorRef.current.position.y) * 0.3;
        secondaryCursorRef.current.visible = true;
      } else {
        secondaryCursorRef.current.visible = false;
      }
    }
  });

  return (
    <>
      {/* Ambient and directional lights */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 5, 10]} intensity={100} color="#00f0ff" distance={30} />

      {/* Lane indicators */}
      {laneRings.map((x, i) => (
        <mesh key={`lane-${i}`} position={[x, -4, -2]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.35, 32]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.3} />
        </mesh>
      ))}

      {/* Hand cursor — sphere that follows the index finger tip */}
      <mesh ref={cursorRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00f0ff"
          emissiveIntensity={0.8}
          transparent
          opacity={0.85}
        />
        {/* Glow ring */}
        <mesh position={[0, 0, -0.05]}>
          <ringGeometry args={[0.22, 0.3, 32]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.4} />
        </mesh>
      </mesh>

      <mesh ref={secondaryCursorRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial
          color="#ffb100"
          emissive="#ffb100"
          emissiveIntensity={0.8}
          transparent
          opacity={0.85}
        />
        <mesh position={[0, 0, -0.05]}>
          <ringGeometry args={[0.18, 0.26, 32]} />
          <meshBasicMaterial color="#ffb100" transparent opacity={0.35} />
        </mesh>
      </mesh>

      {/* Beat zone — the line where notes should be hit */}
      <mesh position={[0, -4, 0]}>
        <planeGeometry args={[LANE_WIDTH + 2, 0.5]} />
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.15} />
      </mesh>
    </>
  );
}
