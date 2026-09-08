import Image from "next/image";
import Link from "next/link";
import { FrameRowActions } from "@/components/admin/FrameRowActions";
import { frameRecordImageUrl } from "@/lib/catalog";
import { getStore } from "@/lib/db";
import { BUILTIN_FRAMES, COLOR_LABELS, SHAPE_LABELS, formatFcfa, type FrameColor, type FrameShape } from "@/lib/frames";

export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function FramesAdminPage({ searchParams }: PageProps<"/admin/montures">) {
  const sp = await searchParams;
  const ok = first(sp.ok);
  const frames = await getStore().listFrames({ includeInactive: true });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Montures</h1>
          <p className="mt-1 text-sm text-ink-3">
            {frames.length === 0
              ? `Le site affiche ${BUILTIN_FRAMES.length} montures de démonstration tant que vous n'en avez pas ajouté.`
              : `${frames.length} monture${frames.length > 1 ? "s" : ""} · ${frames.filter((f) => f.active).length} visible${frames.filter((f) => f.active).length > 1 ? "s" : ""} sur le site`}
          </p>
        </div>
        <Link href="/admin/montures/nouveau" className="btn-primary btn-sm">+ Ajouter une monture</Link>
      </div>

      {ok && <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{ok}</p>}

      {frames.length === 0 ? (
        <div className="card mt-6 p-8 text-center">
          <p className="font-semibold">Aucune monture pour l&apos;instant</p>
          <p className="mt-2 text-sm text-ink-2">
            Ajoutez vos vraies montures avec une photo de face : elles remplaceront les modèles de démonstration
            dans le catalogue et l&apos;essayage virtuel.
          </p>
          <Link href="/admin/montures/nouveau" className="btn-primary mt-4">Ajouter la première monture</Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {frames.map((f) => (
            <li key={f.id} className={`card flex flex-wrap items-center gap-4 p-3 ${f.active ? "" : "opacity-60"}`}>
              <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-paper-2">
                {f.imageMime ? (
                  <Image src={frameRecordImageUrl(f)} alt="" width={f.imageWidth || 100} height={f.imageHeight || 40} unoptimized className="max-h-14 w-auto max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-ink-3">Sans photo</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {f.name} <span className="font-normal text-ink-2">· {COLOR_LABELS[f.color as FrameColor] ?? f.color}</span>
                  {!f.active && <span className="badge ml-2 bg-paper-2 text-ink-3">Masquée</span>}
                </p>
                <p className="text-xs text-ink-3">
                  {f.collection && `${f.collection} · `}{SHAPE_LABELS[f.shape as FrameShape] ?? f.shape} · {formatFcfa(f.priceFcfa)} · /montures/{f.slug}
                </p>
              </div>
              <FrameRowActions id={f.id} active={f.active} name={f.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
