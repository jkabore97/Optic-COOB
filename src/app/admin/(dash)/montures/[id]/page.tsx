import Link from "next/link";
import { notFound } from "next/navigation";
import { FrameForm } from "@/components/admin/FrameForm";
import { frameRecordImageUrl } from "@/lib/catalog";
import { getStore } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditFramePage({ params }: PageProps<"/admin/montures/[id]">) {
  const { id } = await params;
  const frame = await getStore().getFrame(id);
  if (!frame) notFound();
  return (
    <div>
      <nav className="text-sm text-ink-3"><Link href="/admin/montures" className="hover:text-brand-700">Montures</Link> / {frame.name}</nav>
      <h1 className="mt-2 text-2xl font-bold">Modifier « {frame.name} »</h1>
      <div className="mt-6">
        <FrameForm initial={frame} initialImageUrl={frame.imageMime ? frameRecordImageUrl(frame) : undefined} />
      </div>
    </div>
  );
}
