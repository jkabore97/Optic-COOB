import Image from "next/image";
import Link from "next/link";
import { FrameCard } from "@/components/FrameCard";
import { Parallax } from "@/components/Parallax";
import { Reveal } from "@/components/Reveal";
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
  const hasRealFrames = catalog.some((f) => f.source === "db");
  const featured = catalog.slice(0, 4);

  return (
    <>
      {/* Hero : visuels de la campagne COOB Signature */}
      <section className="relative overflow-hidden bg-white">
        <div className="container-x grid items-center gap-10 py-12 md:grid-cols-2 md:py-16">
          <div className="order-2 md:order-1">
            <p className="eyebrow rise-in">{BUSINESS.legalName}</p>
            <h1 className="rise-in rise-in-1 mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              Signe ton style. <span className="text-brand-600">Vois mieux.</span>
            </h1>
            <p className="rise-in rise-in-2 mt-5 max-w-lg text-lg text-ink-2">
              Examen de la vue, montures de grandes marques et verres certifiés, à Ouagadougou et Bobo-Dioulasso.
              Réservez en ligne, essayez vos montures depuis votre téléphone et recevez un SMS quand vos lunettes sont prêtes.
            </p>
            <div className="rise-in rise-in-3 mt-8 flex flex-wrap gap-3">
              <Link href="/rendez-vous" className="btn-primary">
                Prendre rendez-vous
              </Link>
              <Link href="/essayage" className="btn-lime">
                Essayer des montures en ligne
              </Link>
            </div>
            <div className="rise-in rise-in-4 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-2">
              <a href={BUSINESS.reviewsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-brand-700">
                <span className="text-accent-500" aria-hidden="true">★★★★★</span>
                <span>{BUSINESS.reviewCount}+ avis Google</span>
              </a>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700">
                🏆 {BUSINESS.award}
              </span>
            </div>
          </div>
          <div className="relative order-1 md:order-2 rise-in rise-in-1">
            <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-brand-500/25 blur-2xl" aria-hidden="true" />
            <div className="relative grid grid-cols-2 gap-3">
              <Parallax speed={0.06}>
                <Image
                  src="/images/signature.jpg"
                  alt="Campagne COOB Signature"
                  width={1440}
                  height={1916}
                  priority
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="h-full w-full rounded-3xl object-cover shadow-soft"
                />
              </Parallax>
              <Parallax speed={0.14} className="grid gap-3">
                <Image
                  src="/images/campagne-signe-ton-style.jpg"
                  alt="Campagne #SigneTonStyle"
                  width={1600}
                  height={612}
                  priority
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="w-full rounded-3xl object-cover shadow-soft"
                />
                <Image
                  src="/images/poster-vision-parfaite.jpg"
                  alt="Ce qui compte le plus à vos yeux mérite une vision parfaite"
                  width={1440}
                  height={1833}
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="w-full rounded-3xl object-cover shadow-soft"
                />
              </Parallax>
            </div>
            <p className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-soft backdrop-blur">
              {BUSINESS.tagline}
            </p>
          </div>
        </div>
      </section>

      {/* Marques */}
      <section className="border-y border-ink/8 bg-paper-2">
        <div className="py-5">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">Les grandes marques, chez COOB</p>
          <div className="relative mt-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
            <ul className="marquee flex w-max items-center gap-10 whitespace-nowrap text-sm font-semibold text-ink-2" aria-label="Marques distribuées">
              {[...BRANDS, ...BRANDS].map((b, i) => (
                <li key={`${b}-${i}`} aria-hidden={i >= BRANDS.length}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="container-x py-16">
        <Reveal>
          <p className="eyebrow">Nos services</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Tout pour vos yeux, au même endroit</h2>
        </Reveal>
        <Reveal stagger={90} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        </Reveal>
      </section>

      {/* Catalogue : uniquement les vraies montures ajoutées dans l'espace équipe */}
      {hasRealFrames && (
      <section className="bg-white py-16">
        <div className="container-x">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Montures</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Nos modèles du moment</h2>
            </div>
            <Link href="/montures" className="btn-outline">
              Voir tout le catalogue
            </Link>
          </Reveal>
          <Reveal stagger={90} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((f) => (
              <FrameCard key={f.slug} frame={f} />
            ))}
          </Reveal>
        </div>
      </section>

      )}

      {/* Steps */}
      <section className="bg-brand-500 py-16 text-ink">
        <div className="container-x">
          <Reveal>
            <p className="eyebrow text-brand-900">Comment ça marche</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Trois étapes, zéro tracas</h2>
          </Reveal>
          <Reveal as="ol" stagger={120} className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl bg-white/85 p-6 backdrop-blur">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-brand-300">{s.n}</span>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-2">{s.text}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Agences */}
      <section id="contact" className="container-x py-16">
        <div className="grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Reveal>
              <p className="eyebrow">Nos agences</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Trois agences pour vous accueillir</h2>
            </Reveal>
            <Reveal stagger={100} className="mt-8 grid gap-4 sm:grid-cols-3">
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
            </Reveal>
            <Reveal delay={150} className="mt-6 flex flex-wrap gap-3">
              <a href={`https://wa.me/${BUSINESS.whatsapp}`} target="_blank" rel="noreferrer" className="btn-lime">
                WhatsApp {BUSINESS.whatsappDisplay}
              </a>
              <Link href="/rendez-vous" className="btn-primary">
                Prendre rendez-vous
              </Link>
            </Reveal>
          </div>
          <Reveal variant="right" delay={100} className="lg:col-span-2">
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
          </Reveal>
        </div>
      </section>
    </>
  );
}
