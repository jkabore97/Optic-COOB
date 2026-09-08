"use client";

import { useEffect, useRef, useState } from "react";

/** Aperçu 3D d'un fichier GLB (URL ou data URL). */
export function ModelPreview({ url, rotation = [0, 0, 0] }: { url: string; rotation?: [number, number, number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    import("@/lib/model-preview").then(({ mountModelPreview }) => {
      if (cancelled) return;
      cleanup = mountModelPreview(host, url, rotation, () => setError("Ce fichier n'a pas pu être lu comme un modèle GLB."));
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [url, rotation]);

  return (
    <div className="relative aspect-[5/3] w-full overflow-hidden rounded-xl bg-[radial-gradient(70%_60%_at_50%_40%,#ffffff_0%,#f1f2ea_70%,#e6e8da_100%)]">
      <div ref={ref} className="h-full w-full" />
      {error && <p className="absolute inset-x-3 bottom-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
    </div>
  );
}
