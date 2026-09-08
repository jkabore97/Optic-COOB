"use client";

import Image from "next/image";
import { useState } from "react";

export interface GalleryPhoto {
  src: string;
  alt: string;
  caption: string;
}

/**
 * Galerie des boutiques : bande qui défile lentement en continu (pause au survol),
 * chaque photo s'agrandit au survol ; un clic l'ouvre en grand.
 */
export function StoreGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [open, setOpen] = useState<GalleryPhoto | null>(null);
  const loop = [...photos, ...photos];

  return (
    <>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        <ul className="marquee-slow flex w-max gap-4" aria-label="Photos de nos boutiques">
          {loop.map((p, i) => (
            <li key={`${p.src}-${i}`} aria-hidden={i >= photos.length} className="group relative h-56 w-[22rem] shrink-0 overflow-hidden rounded-3xl bg-paper-2 shadow-soft sm:h-64 sm:w-[26rem]">
              <button type="button" className="block h-full w-full text-left" onClick={() => setOpen(p)} tabIndex={i >= photos.length ? -1 : 0} aria-label={`Agrandir : ${p.caption}`}>
                <Image src={p.src} alt={p.alt} fill sizes="(min-width: 640px) 26rem, 22rem" className="object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4 text-sm font-semibold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  {p.caption}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={open.caption} onClick={() => setOpen(null)}>
          <figure className="rise-in max-h-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Image src={open.src} alt={open.alt} width={1600} height={780} className="max-h-[80vh] w-auto rounded-2xl object-contain" />
            <figcaption className="mt-3 flex items-center justify-between gap-4 text-sm text-white">
              <span>{open.caption}</span>
              <button type="button" className="btn btn-sm bg-white/15 text-white hover:bg-white/25" onClick={() => setOpen(null)}>Fermer</button>
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}
