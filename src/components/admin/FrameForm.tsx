"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { saveFrameAction } from "@/app/admin/actions";
import { COLOR_LABELS, COLOR_SWATCH, GENDER_LABELS, MATERIAL_LABELS, SHAPE_LABELS } from "@/lib/frames";
import { loadToCanvas, removeLightBackground, trimTransparent } from "@/lib/image-tools";
import { defaultAnchors, type Pt } from "@/lib/tryon-math";
import type { CatalogFrameRecord } from "@/lib/db/types";

interface Props {
  initial?: CatalogFrameRecord;
  /** URL de la photo actuelle (édition). */
  initialImageUrl?: string;
}

interface ImageState {
  /** Data URL PNG à envoyer (vide = conserver la photo existante). */
  data: string;
  /** URL affichée (data URL ou photo existante). */
  src: string;
  width: number;
  height: number;
}

export function FrameForm({ initial, initialImageUrl }: Props) {
  const [state, action, pending] = useActionState(saveFrameAction, undefined);
  const [image, setImage] = useState<ImageState | null>(
    initial && initialImageUrl && initial.imageWidth
      ? { data: "", src: initialImageUrl, width: initial.imageWidth, height: initial.imageHeight }
      : null,
  );
  const [anchorL, setAnchorL] = useState<Pt | null>(initial ? { x: initial.anchorLx, y: initial.anchorLy } : null);
  const [anchorR, setAnchorR] = useState<Pt | null>(initial ? { x: initial.anchorRx, y: initial.anchorRy } : null);
  const [picking, setPicking] = useState<"L" | "R" | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [clearLenses, setClearLenses] = useState(true);
  const [threshold, setThreshold] = useState(228);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<File | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const processFile = async (file: File | null, remove = removeBg, thr = threshold, lenses = clearLenses) => {
    if (!file) return;
    setBusy(true);
    try {
      let canvas = await loadToCanvas(file, 1400);
      if (remove) {
        removeLightBackground(canvas, thr, lenses ? "all" : "edges");
        canvas = trimTransparent(canvas);
      }
      const data = canvas.toDataURL("image/png");
      const next = { data, src: data, width: canvas.width, height: canvas.height };
      setImage(next);
      const def = defaultAnchors(canvas.width, canvas.height);
      setAnchorL(def.anchorL);
      setAnchorR(def.anchorR);
      setPicking("L");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File | undefined) => {
    fileRef.current = file ?? null;
    void processFile(file ?? null);
  };

  const onImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img || !image) return;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * image.width;
    const y = ((e.clientY - rect.top) / rect.height) * image.height;
    const pt = { x: Math.round(x), y: Math.round(y) };
    if (picking === "R") {
      setAnchorR(pt);
      setPicking(null);
    } else {
      setAnchorL(pt);
      setPicking("R");
    }
  };

  const pct = (p: Pt) => ({ left: `${(p.x / (image?.width || 1)) * 100}%`, top: `${(p.y / (image?.height || 1)) * 100}%` });

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-5">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <input type="hidden" name="imageData" value={image?.data ?? ""} />
      <input type="hidden" name="imageWidth" value={image?.width ?? 0} />
      <input type="hidden" name="imageHeight" value={image?.height ?? 0} />
      <input type="hidden" name="anchorLx" value={anchorL?.x ?? 0} />
      <input type="hidden" name="anchorLy" value={anchorL?.y ?? 0} />
      <input type="hidden" name="anchorRx" value={anchorR?.x ?? 0} />
      <input type="hidden" name="anchorRy" value={anchorR?.y ?? 0} />

      {/* Photo + calibrage */}
      <section className="card p-5 lg:col-span-3">
        <h2 className="text-lg font-bold">1. Photo de la monture</h2>
        <p className="mt-1 text-sm text-ink-2">
          Photo de face, monture ouverte, sur fond blanc ou uni. Idéalement un PNG avec fond transparent.
          Pour l&apos;essayage, les verres doivent être transparents (les yeux restent visibles) : décochez
          « Verres transparents aussi » seulement pour une monture blanche ou très claire.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="btn-outline btn-sm cursor-pointer">
            {image ? "Changer la photo" : "Choisir une photo"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-700"
              checked={removeBg}
              onChange={(e) => {
                setRemoveBg(e.target.checked);
                void processFile(fileRef.current, e.target.checked, threshold);
              }}
            />
            Rendre le fond clair transparent
          </label>
          {removeBg && (
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-700"
                checked={clearLenses}
                onChange={(e) => {
                  setClearLenses(e.target.checked);
                  void processFile(fileRef.current, true, threshold, e.target.checked);
                }}
              />
              Verres transparents aussi
            </label>
          )}
          {removeBg && (
            <label className="flex items-center gap-2 text-xs text-ink-3">
              Sensibilité
              <input
                type="range"
                min={190}
                max={250}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                onMouseUp={() => void processFile(fileRef.current, true, threshold, clearLenses)}
                onTouchEnd={() => void processFile(fileRef.current, true, threshold, clearLenses)}
                className="accent-brand-700"
              />
            </label>
          )}
          {busy && <span className="text-xs text-ink-3">Traitement…</span>}
        </div>

        {image ? (
          <>
            <div className="mt-4 rounded-xl bg-[repeating-conic-gradient(#e9e9e2_0_25%,#f7f7f2_0_50%)] bg-[length:20px_20px] p-3">
              <div className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={image.src}
                  alt="Aperçu de la monture"
                  className={`block max-h-[420px] w-auto max-w-full ${picking ? "cursor-crosshair" : "cursor-pointer"}`}
                  onClick={onImageClick}
                  draggable={false}
                />
                {anchorL && anchorR && (
                  <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="none">
                    <line x1={anchorL.x} y1={anchorL.y} x2={anchorR.x} y2={anchorR.y} stroke="#afbb01" strokeWidth={Math.max(2, image.width / 400)} strokeDasharray="8 6" />
                  </svg>
                )}
                {anchorL && <Marker label="G" style={pct(anchorL)} active={picking === "L"} />}
                {anchorR && <Marker label="D" style={pct(anchorR)} active={picking === "R"} />}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className={`badge ${picking ? "bg-accent-100 text-accent-700" : "bg-brand-100 text-brand-800"}`}>
                {picking === "L"
                  ? "Cliquez sur le centre du verre GAUCHE (à gauche sur la photo)"
                  : picking === "R"
                    ? "Cliquez sur le centre du verre DROIT"
                    : "Calibrage terminé — cliquez sur l'image pour recommencer"}
              </span>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setPicking("L")}>
                Recalibrer
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-3">
              Ces deux points sont alignés sur les pupilles lors de l&apos;essayage virtuel. Ils doivent être au centre de chaque verre.
            </p>
          </>
        ) : (
          <div className="mt-4 flex h-40 items-center justify-center rounded-xl border border-dashed border-ink/20 text-sm text-ink-3">
            Aucune photo pour l&apos;instant
          </div>
        )}
      </section>

      {/* Fiche */}
      <section className="card grid content-start gap-4 p-5 lg:col-span-2">
        <h2 className="text-lg font-bold">2. Fiche produit</h2>
        <div>
          <label htmlFor="name" className="label">Nom du modèle</label>
          <input id="name" name="name" className="field" required minLength={2} defaultValue={initial?.name} placeholder="Ex. Ray-Ban RB5154 Clubmaster" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="collection" className="label">Marque / collection</label>
            <input id="collection" name="collection" className="field" defaultValue={initial?.collection} placeholder="Ex. Ray-Ban" />
          </div>
          <div>
            <label htmlFor="priceFcfa" className="label">Prix monture (FCFA)</label>
            <input id="priceFcfa" name="priceFcfa" type="number" min={0} step={500} className="field" required defaultValue={initial?.priceFcfa} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select name="shape" label="Forme" options={SHAPE_LABELS} value={initial?.shape ?? "rectangle"} />
          <Select name="material" label="Matière" options={MATERIAL_LABELS} value={initial?.material ?? "acetate"} />
          <div>
            <label htmlFor="color" className="label">Coloris</label>
            <select id="color" name="color" className="field" defaultValue={initial?.color ?? "noir"}>
              {Object.entries(COLOR_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div className="mt-1 flex gap-1">
              {Object.entries(COLOR_SWATCH).map(([v, c]) => (
                <span key={v} className="h-3 w-3 rounded-full border border-ink/15" style={{ background: c }} title={COLOR_LABELS[v as keyof typeof COLOR_LABELS]} />
              ))}
            </div>
          </div>
          <Select name="gender" label="Pour" options={GENDER_LABELS} value={initial?.gender ?? "mixte"} />
        </div>
        <div>
          <p className="label">Taille (verre / pont / branche, mm)</p>
          <div className="grid grid-cols-3 gap-2">
            <input name="sizeLens" type="number" min={0} className="field" placeholder="52" defaultValue={initial?.sizeLens || ""} aria-label="Largeur verre" />
            <input name="sizeBridge" type="number" min={0} className="field" placeholder="18" defaultValue={initial?.sizeBridge || ""} aria-label="Pont" />
            <input name="sizeTemple" type="number" min={0} className="field" placeholder="145" defaultValue={initial?.sizeTemple || ""} aria-label="Branche" />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" name="description" className="field" rows={3} defaultValue={initial?.description} placeholder="Ce qui rend cette monture spéciale…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="tags" className="label">Étiquette (facultatif)</label>
            <input id="tags" name="tags" className="field" defaultValue={initial?.tags.join(", ")} placeholder="Ex. Nouveauté, Solaire" />
          </div>
          <div>
            <label htmlFor="sortOrder" className="label">Ordre d&apos;affichage</label>
            <input id="sortOrder" name="sortOrder" type="number" className="field" defaultValue={initial?.sortOrder ?? 0} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="active" value="1" defaultChecked={initial?.active ?? true} className="h-4 w-4 accent-brand-700" />
          Visible sur le site
        </label>

        {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={pending || busy || !image || !anchorL || !anchorR}>
            {pending ? "Enregistrement…" : initial ? "Enregistrer les modifications" : "Ajouter la monture"}
          </button>
          <Link href="/admin/montures" className="btn-ghost">Annuler</Link>
        </div>
        {!image && <p className="text-xs text-ink-3">Ajoutez une photo pour pouvoir enregistrer.</p>}
      </section>
    </form>
  );
}

function Marker({ label, style, active }: { label: string; style: React.CSSProperties; active: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[11px] font-bold shadow-soft ${
        active ? "border-accent-500 bg-accent-500/80 text-ink" : "border-white bg-brand-600 text-white"
      }`}
      style={style}
    >
      {label}
    </span>
  );
}

function Select({ name, label, options, value }: { name: string; label: string; options: Record<string, string>; value: string }) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <select id={name} name={name} className="field" defaultValue={value}>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}
