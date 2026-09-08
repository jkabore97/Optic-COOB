import type { Metadata } from "next";
import { TryOn } from "@/components/TryOn";

export const metadata: Metadata = {
  title: "Essayage virtuel",
  description:
    "Essayez nos montures en direct avec la caméra de votre téléphone ou sur une photo. Tout se passe dans votre navigateur.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TryOnPage({ searchParams }: PageProps<"/essayage">) {
  const sp = await searchParams;
  const slug = first(sp.monture);
  return (
    <div className="container-x py-10">
      <p className="eyebrow">Essayage virtuel</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Essayez nos montures, où que vous soyez</h1>
      <p className="mt-3 max-w-2xl text-ink-2">
        Activez la caméra ou importez une photo de face : la monture se place automatiquement sur votre visage.
        Changez de modèle d&apos;un simple clic, puis prenez une photo pour la partager ou la montrer en boutique.
      </p>
      <div className="mt-8">
        <TryOn initialSlug={slug} />
      </div>
    </div>
  );
}
