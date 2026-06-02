"use client";

import dynamic from "next/dynamic";

const Stage = dynamic(
  () => import("@/components/game/Stage"),
  { ssr: false }
);

export default function Home() {
  return <Stage />;
}
