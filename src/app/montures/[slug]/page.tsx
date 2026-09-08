import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FrameCard } from "@/components/FrameCard";
import {
  COLOR_LABELS,
  COLOR_SWATCH,
  FRAMES,
  GENDER_LABELS,
  MATERIAL_LABELS,
  SHAPE_LABELS,
  formatFcfa,
  frameImageUrl,
  getFrame,
} from "@/lib/frames";

export function generateStaticParams() {
  return FRAMES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: PageProps<"/montures/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const frame = getFrame(slug);
  if (!frame) return {};
  return {
    title: `${frame.name} ${COLOR_LABELS[frame.color]}`,
    description: frame.description,
  };
}

export default async function FramePage({ params }: PageProps<"/montures/[slug]">) {
  const { slug } = await params;
  const frame = getFrame(slug);
  if (!frame) notFound();

  const variants = FRAMES.filter((f) => f.name === frame.name && f.slug !== frame.slug);
  const similar = FRAMES.filter((f) => f.slug !== frame.slug && f.name !== frame.name && f.shape === frame.shape).slice(0, 3);

  return (
    <div className="container-x py-10">
      <nav className="text-sm text-ink-3" aria-label="Fil d'Ariane">
        <Link href="/montures" className="hover:text-brand-700">Montures</Link> <span aria-hidden="true">/</span>{" "}
        <span className="text-ink-2">{frame.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-5">
        <div className="card flex items-center justify-center bg-paper-2 p-8 lg:col-span-3">
          <Image
            src={frameImageUrl(frame)}
            alt={`${frame.name} ${COLOR_LABELS[frame.color]}`}
            width={1000}
            height={400}
            unoptimized
            priority
            className="h-auto w-full"
          />
        </div>
        <div className="lg:col-span-2">
          <p className="eyebrow">{frame.collection}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {frame.name} <span className="font-normal text-ink-2">{COLOR_LABELS[frame.color]}</span>
          </h1>
          <p className="mt-3 text-2xl font-semibold text-brand-800">{formatFcfa(frame.priceFcfa)}</p>
          <p className="text-xs text-ink-3">Monture seule, prix indicatif. Verres selon prescription.</p>
          <p className="mt-5 text-ink-2">{frame.description}</p>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-ink-3">Forme</dt><dd className="font-medium">{SHAPE_LABELS[frame.shape]}</dd></div>
            <div><dt className="text-ink-3">Matière</dt><dd className="font-medium">{MATERIAL_LABELS[frame.material]}</dd></div>
            <div><dt className="text-ink-3">Pour</dt><dd className="font-medium">{GENDER_LABELS[frame.gender]}</dd></div>
            <div><dt className="text-ink-3">Taille (verre / pont / branche)</dt><dd className="font-medium">{frame.size.join(" – ")} mm</dd></div>
            <div className="col-span-2">
              <dt className="text-ink-3">Coloris</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {[frame, ...variants].map((v) => (
                  <Link
                    key={v.slug}
                    href={`/montures/${v.slug}`}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      v.slug === frame.slug ? "border-brand-700 bg-brand-50 text-brand-800" : "border-ink/15 hover:border-brand-500"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full border border-ink/15" style={{ background: COLOR_SWATCH[v.color] }} />
                    {COLOR_LABELS[v.color]}
                  </Link>
                ))}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={`/essayage?monture=${frame.slug}`} className="btn-accent flex-1">
              Essayer virtuellement
            </Link>
            <Link href="/rendez-vous" className="btn-primary flex-1">
              Prendre rendez-vous
            </Link>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Disponibilité et stock à confirmer en boutique. Appelez-nous pour réserver ce modèle.
          </p>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold tracking-tight">Dans le même esprit</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((f) => (
              <FrameCard key={f.slug} frame={f} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
