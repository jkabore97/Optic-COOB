import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogFilters } from "@/components/CatalogFilters";
import { FrameCard } from "@/components/FrameCard";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Montures",
  description:
    "Découvrez nos montures : acétate, métal, titane, pour homme, femme et enfant. Essayez-les virtuellement avant de passer en boutique.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CatalogPage({ searchParams }: PageProps<"/montures">) {
  const sp = await searchParams;
  const forme = first(sp.forme);
  const matiere = first(sp.matiere);
  const genre = first(sp.genre);
  const prix = Number(first(sp.prix)) || 0;

  const frames = (await getCatalog()).filter(
    (f) =>
      (!forme || f.shape === forme) &&
      (!matiere || f.material === matiere) &&
      (!genre || f.gender === genre || (genre !== "enfant" && f.gender === "mixte")) &&
      (!prix || f.priceFcfa <= prix),
  );

  return (
    <div className="container-x py-10">
      <p className="eyebrow">Catalogue</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Nos montures</h1>
      <p className="mt-3 max-w-2xl text-ink-2">
        Prix indicatifs pour la monture seule. Les verres correcteurs sont ajoutés selon votre
        prescription. Essayez chaque modèle virtuellement, puis venez le tester en boutique.
      </p>

      <div className="mt-8">
        <Suspense>
          <CatalogFilters count={frames.length} />
        </Suspense>
      </div>

      {frames.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-white p-8 text-center text-ink-2">
          Aucune monture ne correspond à ces critères. Essayez d&apos;élargir votre recherche.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {frames.map((f) => (
            <FrameCard key={f.slug} frame={f} />
          ))}
        </div>
      )}
    </div>
  );
}
