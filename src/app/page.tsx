import Image from "next/image";
import Link from "next/link";
import { FrameCard } from "@/components/FrameCard";
import { HeroGlasses } from "@/components/HeroGlasses";
import { AGENCIES, BRANDS, BUSINESS, OPENING_HOURS, WEEKDAY_LABELS, type Weekday } from "@/lib/config";
import { getCatalog } from "@/lib/catalog";


const SERVICES = [
  {
    title: "Examen de la vue",
    text: "Bilan visuel complet par nos optométristes, adultes et enfants. Prescription remise le jour même.",
    href: "/rendez-vous",
    cta: "Prendre rendez-vous",
  },
  {
    title: "Diagnostic des défauts visuels",
    text: "Myopie, hypermétropie, astigmatisme, presbytie : on identifie précisément votre correction.",
    href: "/rendez-vous",
    cta: "Réserver un examen",
  },
  {
    title: "Équipements optiques",
    text: "Montures de grandes marques, verres certifiés haute performance, lentilles de contact.",
    href: "/montures",
    cta: "Voir les montures",
  },
  {
    title: "Réparation & ajustage",
    text: "Plaquettes, vis, branches : on répare et on ajuste vos lunettes, souvent en quelques minutes.",
    href: "/rendez-vous?motif=reparation",
    cta: "Réserver un créneau",
  },
];

const STEPS = [
  { n: "1", title: "Réservez en ligne", text: "Choisissez votre agence et votre créneau en 30 secondes. Confirmation immédiate par SMS." },
  { n: "2", title: "Choisissez vos montures", text: "Essayez-les virtuellement depuis votre téléphone, puis validez en boutique avec nos opticiens." },
  { n: "3", title: "Recevez un SMS", text: "Dès que vos lunettes sont prêtes, vous êtes prévenu. Plus besoin d'appeler ou de passer pour rien." },
];

const hours = (d: Weekday) =>
  OPENING_HOURS[d].length === 0
    ? "Fermé"
    : OPENING_HOURS[d].map((p) => `${p.open.replace(":", "h")} – ${p.close.replace(":", "h")}`).join(" / ");

export default async function HomePage() {
  const catalog = await getCatalog();
  const featured = catalog.slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="container-x grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
          <div>
            <p className="eyebrow">{BUSINESS.legalName}</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Votre vision, <span className="text-brand-600">notre expertise.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-ink-2">
              Examen de la vue, montures de grandes marques et verres certifiés, à Ouagadougou et Bobo-Dioulasso.
              Réservez en ligne, essayez vos montures depuis votre téléphone et recevez un SMS quand vos lunettes sont prêtes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/rendez-vous" className="btn-primary">
                Prendre rendez-vous
              </Link>
              <Link href="/essayage" className="btn-lime">
                Essayer des montures en ligne
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-2">
              <a href={BUSINESS.reviewsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-brand-700">
                <span className="text-accent-500" aria-hidden="true">★★★★★</span>
                <span>{BUSINESS.reviewCount}+ avis Google</span>
              </a>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">
                🏆 {BUSINESS.award}
              </span>
            </div>
          </div>
          <HeroGlasses />
        </div>
      </section>

      {/* Marques */}
      <section className="border-y border-ink/8 bg-paper-2">
        <div className="container-x py-5">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">Les grandes marques, chez COOB</p>
          <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-ink-2">
            {BRANDS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Services */}
      <section className="container-x py-16">
        <p className="eyebrow">Nos services</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Tout pour vos yeux, au même endroit</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <div key={s.title} className="card flex flex-col p-5">
              <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">✓</span>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 flex-1 text-sm text-ink-2">{s.text}</p>
              <Link href={s.href} className="mt-4 text-sm font-semibold text-brand-700 hover:underline">
                {s.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Catalogue */}
      <section className="bg-white py-16">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Montures</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Nos modèles du moment</h2>
            </div>
            <Link href="/montures" className="btn-outline">
              Voir tout le catalogue
            </Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((f) => (
              <FrameCard key={f.slug} frame={f} />
            ))}
          </div>
        </div>
      </section>

      {/* Signature */}
      <section className="container-x grid items-center gap-8 py-16 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-4">
          <Image src="/images/signature.jpg" alt="Campagne COOB Signature" width={1440} height={1916} sizes="(min-width: 768px) 25vw, 50vw" className="w-full rounded-3xl object-cover" />
          <div className="grid gap-4">
            <Image src="/images/campagne-signe-ton-style.jpg" alt="Campagne #SigneTonStyle" width={1600} height={612} sizes="(min-width: 768px) 25vw, 50vw" className="w-full rounded-3xl object-cover" />
            <Image src="/images/poster-vision-parfaite.jpg" alt="Ce qui compte le plus à vos yeux mérite une vision parfaite" width={1440} height={1833} sizes="(min-width: 768px) 25vw, 50vw" className="w-full rounded-3xl object-cover" />
          </div>
        </div>
        <div>
          <p className="eyebrow">COOB Signature</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Signe ton style</h2>
          <p className="mt-4 text-ink-2">
            Des lunettes qui corrigent votre vue et affirment votre personnalité. Notre collection Signature
            réunit des montures sélectionnées pour leur caractère, à essayer en ligne avant de passer en agence.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/essayage" className="btn-lime">
              Essayer virtuellement
            </Link>
            <Link href="/montures" className="btn-outline">
              Découvrir la collection
            </Link>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-brand-500 py-16 text-ink">
        <div className="container-x">
          <p className="eyebrow text-brand-900">Comment ça marche</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Trois étapes, zéro tracas</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl bg-white/85 p-6 backdrop-blur">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-brand-300">{s.n}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Agences */}
      <section id="contact" className="container-x py-16">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p className="eyebrow">Nos agences</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Trois agences pour vous accueillir</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {AGENCIES.map((a) => (
                <div key={a.id} className={`card p-5 ${a.main ? "ring-2 ring-brand-500" : ""}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{a.city}</p>
                  <h3 className="mt-1 text-lg font-semibold">{a.name}</h3>
                  <p className="mt-1 text-sm text-ink-2">{a.address}</p>
                  <a href={`tel:${a.phoneE164}`} className="mt-3 block text-sm font-semibold text-brand-700">{a.phoneDisplay}</a>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={a.mapsUrl} target="_blank" rel="noreferrer" className="btn-outline btn-sm">Itinéraire</a>
                    <Link href={`/rendez-vous?agence=${a.id}`} className="btn-ghost btn-sm">RDV</Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="btn-lime">
                WhatsApp {BUSINESS.whatsappDisplay}
              </a>
              <Link href="/rendez-vous" className="btn-primary">
                Prendre rendez-vous
              </Link>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="card overflow-hidden">
              <Image src="/images/hero-store.jpg" alt="Une cliente essaie une monture avec un opticien COOB" width={1440} height={969} sizes="(min-width: 1024px) 40vw, 100vw" className="aspect-[4/3] w-full object-cover" />
              <div className="p-5">
                <h3 className="font-semibold">Horaires d&apos;ouverture</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex justify-between border-b border-ink/8 pb-2"><span className="text-ink-2">Lundi – Vendredi</span><span className="font-medium">{hours(1)}</span></li>
                  <li className="flex justify-between border-b border-ink/8 pb-2"><span className="text-ink-2">{WEEKDAY_LABELS[6]}</span><span className="font-medium">{hours(6)}</span></li>
                  <li className="flex justify-between"><span className="text-ink-2">{WEEKDAY_LABELS[0]}</span><span className="font-medium">{hours(0)}</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
