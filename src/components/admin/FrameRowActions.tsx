"use client";

import Link from "next/link";
import { deleteFrameAction, toggleFrameActiveAction } from "@/app/admin/actions";

export function FrameRowActions({ id, active, name }: { id: string; active: boolean; name: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={`/admin/montures/${id}`} className="btn-outline btn-sm">Modifier</Link>
      <form action={toggleFrameActiveAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={active ? "0" : "1"} />
        <button className="btn-ghost btn-sm">{active ? "Masquer" : "Afficher"}</button>
      </form>
      <form
        action={deleteFrameAction}
        onSubmit={(e) => {
          if (!confirm(`Supprimer définitivement « ${name} » ?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button className="btn-ghost btn-sm text-red-700 hover:bg-red-50">Supprimer</button>
      </form>
    </div>
  );
}
