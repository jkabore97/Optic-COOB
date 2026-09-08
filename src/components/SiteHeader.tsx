"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BUSINESS } from "@/lib/config";
import { Logo } from "./Logo";

const NAV = [
  { href: "/montures", label: "Montures" },
  { href: "/essayage", label: "Essayage virtuel" },
  { href: "/suivi", label: "Suivre ma commande" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className={`sticky top-0 z-40 border-b bg-white/90 backdrop-blur transition-shadow duration-300 ${scrolled ? "border-ink/10 shadow-soft" : "border-transparent"}`}>
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  active ? "bg-brand-50 text-brand-800" : "text-ink-2 hover:bg-brand-50 hover:text-brand-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <a href={`tel:${BUSINESS.phoneE164}`} className="btn-ghost btn-sm">
            {BUSINESS.phoneDisplay}
          </a>
          <Link href="/rendez-vous" className="btn-primary btn-sm">
            Prendre rendez-vous
          </Link>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-brand-800 hover:bg-brand-50 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="border-t border-ink/8 bg-paper md:hidden">
          <nav className="container-x flex flex-col py-3" aria-label="Navigation mobile">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={close} className="rounded-xl px-3 py-3 text-base font-medium text-ink-2 hover:bg-brand-50">
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 px-3 pb-2">
              <Link href="/rendez-vous" onClick={close} className="btn-primary">
                Prendre rendez-vous
              </Link>
              <a href={`tel:${BUSINESS.phoneE164}`} className="btn-outline">
                Appeler le {BUSINESS.phoneDisplay}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
