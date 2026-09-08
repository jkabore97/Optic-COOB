"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENCIES, BUSINESS, OPENING_HOURS, WEEKDAY_LABELS, type Weekday } from "@/lib/config";
import { LogoMark } from "./Logo";

const hours = (d: Weekday) =>
  OPENING_HOURS[d].length === 0
    ? "Fermé"
    : OPENING_HOURS[d].map((p) => `${p.open.replace(":", "h")}–${p.close.replace(":", "h")}`).join(" / ");

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="mt-16 bg-ink text-white">
      <div className="container-x grid gap-10 py-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <LogoMark tone="white" height={36} />
          <p className="mt-2 text-sm font-medium text-white/80">{BUSINESS.legalName}</p>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            {BUSINESS.tagline}. Examen de vue, montures de grandes marques, verres correcteurs et lentilles,
            avec un suivi par SMS de votre commande.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="btn-lime btn-sm">
              WhatsApp {BUSINESS.whatsappDisplay}
            </a>
            {BUSINESS.facebookUrl && (
              <a href={BUSINESS.facebookUrl} target="_blank" rel="noreferrer" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
                Facebook
              </a>
            )}
            {BUSINESS.instagramUrl && (
              <a href={BUSINESS.instagramUrl} target="_blank" rel="noreferrer" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">
                Instagram
              </a>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-brand-300">Le site</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li><Link href="/montures" className="hover:text-white">Montures</Link></li>
            <li><Link href="/essayage" className="hover:text-white">Essayage virtuel</Link></li>
            <li><Link href="/rendez-vous" className="hover:text-white">Prendre rendez-vous</Link></li>
            <li><Link href="/suivi" className="hover:text-white">Suivre ma commande</Link></li>
            <li><Link href="/admin" className="hover:text-white">Espace équipe</Link></li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h3 className="text-sm font-semibold text-brand-300">Nos agences</h3>
          <ul className="mt-3 space-y-3 text-sm">
            {AGENCIES.map((a) => (
              <li key={a.id}>
                <p className="font-medium text-white">{a.name} <span className="font-normal text-white/50">· {a.city}</span></p>
                <a href={`tel:${a.phoneE164}`} className="text-white/70 hover:text-white">{a.phoneDisplay}</a>
              </li>
            ))}
          </ul>
        </div>

        <div className="md:col-span-3">
          <h3 className="text-sm font-semibold text-brand-300">Horaires</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-white/70">
            <li className="flex justify-between gap-3"><span className="whitespace-nowrap">Lun – Ven</span><span className="whitespace-nowrap">{hours(1)}</span></li>
            <li className="flex justify-between gap-3"><span>{WEEKDAY_LABELS[6]}</span><span className="whitespace-nowrap">{hours(6)}</span></li>
            <li className="flex justify-between gap-3"><span>{WEEKDAY_LABELS[0]}</span><span>{hours(0)}</span></li>
          </ul>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-500/15 px-3 py-1.5 text-xs font-semibold text-accent-300">
            🏆 {BUSINESS.award}
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-4 text-xs text-white/40 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {BUSINESS.legalName}. Tous droits réservés.</span>
          <span>Ouagadougou · Bobo-Dioulasso, Burkina Faso</span>
        </div>
      </div>
    </footer>
  );
}
