"use client";

import Image from "next/image";
import { useState } from "react";
import { COLOR_LABELS, frameImageUrl, type Frame } from "@/lib/frames";
import { Glasses3D } from "./Glasses3D";

/** Visuel de la fiche monture : image 2D ou vue 3D manipulable. */
export function FrameViewer({ frame }: { frame: Frame }) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  return (
    <div className="card relative overflow-hidden bg-paper-2">
      <div className="absolute right-3 top-3 z-10 flex gap-1 rounded-full bg-white p-1 shadow-soft" role="tablist" aria-label="Type de visuel">
        {(["2d", "3d"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === m ? "bg-brand-700 text-white" : "text-ink-2 hover:bg-brand-50"}`}
          >
            {m === "2d" ? "Image" : "Vue 3D"}
          </button>
        ))}
      </div>
      {mode === "2d" ? (
        <div className="flex aspect-[5/3] items-center justify-center p-8">
          <Image src={frameImageUrl(frame)} alt={`${frame.name} ${COLOR_LABELS[frame.color]}`} width={1000} height={400} unoptimized priority className="h-auto w-full" />
        </div>
      ) : (
        <div className="aspect-[5/3]">
          <Glasses3D frame={frame} autoRotate={false} interactive />
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1.5 text-[11px] font-medium text-white">
            Faites glisser pour tourner la monture
          </p>
        </div>
      )}
    </div>
  );
}
