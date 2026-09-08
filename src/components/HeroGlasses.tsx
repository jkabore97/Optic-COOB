"use client";

import Link from "next/link";
import { useState } from "react";
import { BUSINESS } from "@/lib/config";
import { FRAMES, COLOR_LABELS, type Frame } from "@/lib/frames";
import { Glasses3D } from "./Glasses3D";

const SHOWCASE = ["bobo-wayfarer", "sahel-aviateur", "yennenga-papillon", "nazinga-rond", "ouaga-cristal"]
  .map((slug) => FRAMES.find((f) => f.slug === slug)!)
  .filter(Boolean);

/** Visuel 3D animé de la page d'accueil, avec un mini-sélecteur de montures. */
export function HeroGlasses() {
  const [frame, setFrame] = useState<Frame>(SHOWCASE[0]);
  const [ready, setReady] = useState(false);

  return (
    <div className="relative">
      <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-brand-500/25 blur-2xl" aria-hidden="true" />
      <div className="absolute -bottom-8 -left-8 h-48 w-48 rounded-full bg-accent-500/15 blur-3xl" aria-hidden="true" />
      <div className="card relative aspect-[5/4] overflow-hidden bg-[radial-gradient(70%_60%_at_50%_40%,#ffffff_0%,#f1f2ea_70%,#e6e8da_100%)]">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-3" aria-hidden="true">
            Chargement de la vue 3D…
          </div>
        )}
        <Glasses3D frame={frame} autoRotate interactive onReady={() => setReady(true)} />
        <p className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-soft backdrop-blur">
          {BUSINESS.tagline}
        </p>
        <p className="pointer-events-none absolute bottom-4 right-4 hidden rounded-full bg-ink/80 px-3 py-1.5 text-[11px] font-medium text-white sm:block">
          Faites glisser pour tourner
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="tablist" aria-label="Monture affichée en 3D">
          {SHOWCASE.map((f) => (
            <button
              key={f.slug}
              type="button"
              role="tab"
              aria-selected={f.slug === frame.slug}
              title={`${f.name} ${COLOR_LABELS[f.color]}`}
              onClick={() => { setReady(false); setFrame(f); }}
              className={`h-7 w-7 rounded-full border-2 transition ${f.slug === frame.slug ? "scale-110 border-brand-700" : "border-white hover:border-brand-400"}`}
              style={{ background: f.color === "cristal" ? "linear-gradient(135deg,#fff,#cfd8e2)" : undefined, backgroundColor: f.color === "cristal" ? undefined : swatch(f) }}
            />
          ))}
        </div>
        <Link href={`/montures/${frame.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">
          {frame.name} {COLOR_LABELS[frame.color]} →
        </Link>
      </div>
    </div>
  );
}

function swatch(f: Frame): string {
  const map: Record<string, string> = {
    noir: "#1a1a1a", ecaille: "#6b3d1a", dore: "#c9a24a", argent: "#b8bcc4", bleu: "#1f3a68",
    bordeaux: "#6b1f2a", vert: "#2f5d46", "rose-dore": "#d3a08b", gris: "#5b6068",
  };
  return map[f.color] ?? "#888";
}
