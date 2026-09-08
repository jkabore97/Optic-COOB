"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GENDER_LABELS, MATERIAL_LABELS, SHAPE_LABELS } from "@/lib/frames";

const PRICE_OPTIONS = [
  { value: "", label: "Tous les prix" },
  { value: "20000", label: "Jusqu'à 20 000 FCFA" },
  { value: "30000", label: "Jusqu'à 30 000 FCFA" },
  { value: "45000", label: "Jusqu'à 45 000 FCFA" },
];

function Select({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (name: string, value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
      {label}
      <select name={name} value={value} onChange={(e) => onChange(name, e.target.value)} className="field py-2">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CatalogFilters({ count }: { count: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const hasFilters = ["forme", "matiere", "genre", "prix"].some((k) => params.get(k));

  return (
    <div className="card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          name="forme"
          label="Forme"
          value={params.get("forme") ?? ""}
          options={[{ value: "", label: "Toutes les formes" }, ...Object.entries(SHAPE_LABELS).map(([value, label]) => ({ value, label }))]}
          onChange={set}
        />
        <Select
          name="matiere"
          label="Matière"
          value={params.get("matiere") ?? ""}
          options={[{ value: "", label: "Toutes les matières" }, ...Object.entries(MATERIAL_LABELS).map(([value, label]) => ({ value, label }))]}
          onChange={set}
        />
        <Select
          name="genre"
          label="Pour"
          value={params.get("genre") ?? ""}
          options={[{ value: "", label: "Tout le monde" }, ...Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }))]}
          onChange={set}
        />
        <Select name="prix" label="Budget" value={params.get("prix") ?? ""} options={PRICE_OPTIONS} onChange={set} />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-3">
        <span>{count} monture{count > 1 ? "s" : ""}</span>
        {hasFilters && (
          <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => router.replace(pathname)}>
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
