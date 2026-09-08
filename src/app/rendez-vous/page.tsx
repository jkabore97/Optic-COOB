import type { Metadata } from "next";
import { BookingForm } from "@/components/BookingForm";
import { Reveal } from "@/components/Reveal";
import { AGENCIES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Prendre rendez-vous",
  description:
    "Réservez votre examen de vue chez COOB Optique, à Ouagadougou ou Bobo-Dioulasso, en quelques secondes. Confirmation immédiate par SMS.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BookingPage({ searchParams }: PageProps<"/rendez-vous">) {
  const sp = await searchParams;
  return (
    <div className="container-x py-10">
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="eyebrow">Rendez-vous</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Réservez votre examen de vue</h1>
          <p className="mt-3 max-w-2xl text-ink-2">
            Choisissez votre agence et un créneau, laissez votre numéro : vous recevez la confirmation par SMS
            immédiatement, et un rappel la veille.
          </p>
          <div className="mt-8">
            <BookingForm initialReason={first(sp.motif)} initialAgency={first(sp.agence)} />
          </div>
        </div>
        <Reveal as="aside" stagger={120} className="space-y-4 lg:pt-24">
          <div className="card p-5">
            <h2 className="font-semibold">Ce qu&apos;il faut apporter</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-2">
              <li>Vos lunettes actuelles, si vous en avez</li>
              <li>Votre dernière ordonnance, si elle existe</li>
              <li>Votre carte d&apos;assurance ou de mutuelle, le cas échéant</li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Durée</h2>
            <p className="mt-2 text-sm text-ink-2">
              Comptez environ 30 minutes pour un examen complet. Le résultat et la prescription vous sont remis sur place.
            </p>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Vous préférez appeler ?</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {AGENCIES.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="text-ink-2">{a.name}</span>
                  <a href={`tel:${a.phoneE164}`} className="font-semibold text-brand-700">{a.phoneDisplay}</a>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
