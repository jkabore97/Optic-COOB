import Image from "next/image";
import Link from "next/link";
import {
  COLOR_LABELS,
  COLOR_SWATCH,
  MATERIAL_LABELS,
  SHAPE_LABELS,
  formatFcfa,
  frameImageUrl,
  type Frame,
} from "@/lib/frames";

export function FrameCard({ frame }: { frame: Frame }) {
  return (
    <article className="card group overflow-hidden">
      <Link href={`/montures/${frame.slug}`} className="block">
        <div className="relative flex aspect-[5/3] items-center justify-center bg-paper-2 px-6">
          <Image
            src={frameImageUrl(frame)}
            alt={`${frame.name} ${COLOR_LABELS[frame.color]}`}
            width={1000}
            height={400}
            unoptimized
            className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.04]"
          />
          {frame.tags?.[0] && (
            <span className="badge absolute left-3 top-3 bg-accent-100 text-accent-700 capitalize">{frame.tags[0]}</span>
          )}
        </div>
      </Link>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{frame.collection}</p>
          <h3 className="mt-0.5 truncate text-base font-semibold text-ink">
            <Link href={`/montures/${frame.slug}`}>{frame.name}</Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-2">
            <span
              className="inline-block h-3 w-3 rounded-full border border-ink/15"
              style={{ background: COLOR_SWATCH[frame.color] }}
              aria-hidden="true"
            />
            {COLOR_LABELS[frame.color]} · {SHAPE_LABELS[frame.shape]} · {MATERIAL_LABELS[frame.material]}
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-brand-800">{formatFcfa(frame.priceFcfa)}</p>
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <Link href={`/essayage?monture=${frame.slug}`} className="btn-outline btn-sm flex-1">
          Essayer
        </Link>
        <Link href={`/montures/${frame.slug}`} className="btn-ghost btn-sm">
          Détails
        </Link>
      </div>
    </article>
  );
}
