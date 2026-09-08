"use client";

import { useEffect, useRef, useState } from "react";
import { COLOR_SWATCH, type Frame } from "@/lib/frames";

/**
 * Paire de lunettes en 3D, construite procéduralement avec three.js à partir de la
 * forme, de la matière et du coloris du catalogue. Rotation automatique et/ou
 * manipulation à la souris ou au doigt. Chargé dynamiquement (three ≈ 160 Ko gzip).
 */

export interface Glasses3DProps {
  frame: Pick<Frame, "shape" | "material" | "color">;
  /** Rotation continue (désactivée si l'utilisateur préfère réduire les animations). */
  autoRotate?: boolean;
  /** Manipulation à la souris / au doigt. */
  interactive?: boolean;
  className?: string;
  /** Appelé lorsque la scène est prête (pour masquer une image de repli). */
  onReady?: () => void;
}

export function Glasses3D({ frame, autoRotate = true, interactive = true, className = "", onReady }: Glasses3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    import("@/lib/glasses-scene")
      .then(({ mountGlassesScene }) => {
        if (disposed) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        cleanup = mountGlassesScene(host, {
          shape: frame.shape,
          material: frame.material,
          color: COLOR_SWATCH[frame.color],
          colorKey: frame.color,
          autoRotate: autoRotate && !reduced,
          interactive,
        });
        onReadyRef.current?.();
      })
      .catch((err) => {
        console.error("[3D]", err);
        setFailed(true);
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [frame.shape, frame.material, frame.color, autoRotate, interactive]);

  if (failed) return null;
  return (
    <div
      ref={hostRef}
      className={`relative h-full w-full ${interactive ? "cursor-grab active:cursor-grabbing touch-none" : ""} ${className}`}
      role="img"
      aria-label="Monture en 3D"
    />
  );
}
