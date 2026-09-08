import Link from "next/link";
import { FrameForm } from "@/components/admin/FrameForm";

export default function NewFramePage() {
  return (
    <div>
      <nav className="text-sm text-ink-3"><Link href="/admin/montures" className="hover:text-brand-700">Montures</Link> / Nouvelle monture</nav>
      <h1 className="mt-2 text-2xl font-bold">Ajouter une monture</h1>
      <div className="mt-6">
        <FrameForm />
      </div>
    </div>
  );
}
