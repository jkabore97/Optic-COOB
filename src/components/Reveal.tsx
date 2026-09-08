"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type Variant = "up" | "fade" | "scale" | "left" | "right";

interface RevealProps {
  children: ReactNode;
  /** Type d'entrée. */
  variant?: Variant;
  /** Délai en millisecondes (pour décaler les éléments d'une grille). */
  delay?: number;
  /** Élément HTML à rendre. */
  as?: ElementType;
  className?: string;
  /** Décale automatiquement chaque enfant direct (grilles). */
  stagger?: number;
  /** Ne rejoue pas l'animation quand l'élément ressort de l'écran. */
  once?: boolean;
  id?: string;
}

/**
 * Anime l'apparition d'un bloc lorsqu'il entre dans l'écran, au défilement.
 * Les transitions sont définies dans globals.css (.reveal, .reveal-*), et désactivées
 * automatiquement si l'utilisateur préfère réduire les animations.
 */
export function Reveal({ children, variant = "up", delay = 0, as: Tag = "div", className = "", stagger, once = true, id }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Avec « réduire les animations », le CSS affiche tout immédiatement : rien à observer.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          if (once) io.disconnect();
        } else if (!once) {
          setShown(false);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  const style: CSSProperties & Record<string, string | number> = {};
  if (delay) style.transitionDelay = `${delay}ms`;
  if (stagger) style["--stagger"] = `${stagger}ms`;

  return (
    <Tag
      ref={ref}
      id={id}
      className={`reveal reveal-${variant} ${stagger ? "reveal-stagger" : ""} ${shown ? "is-shown" : ""} ${className}`}
      style={style}
    >
      {children}
    </Tag>
  );
}
