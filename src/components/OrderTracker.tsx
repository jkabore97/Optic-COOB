"use client";

import { useState } from "react";
import { BUSINESS } from "@/lib/config";

interface TrackResult {
  code: string;
  customerName: string;
  agency: { name: string; city: string; phoneDisplay: string; phoneE164: string; mapsUrl: string };
  frame: string;
  lenses: string;
  status: string;
  statusLabel: string;
  stepIndex: number;
  steps: string[];
  createdAt: string;
  readyAt: string | null;
  collectedAt: string | null;
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: BUSINESS.timeZone, day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function OrderTracker({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Une erreur est survenue.");
      else setResult(json);
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} className="card grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="code" className="label">Référence de commande</label>
          <input id="code" className="field font-mono uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="COOB-XXXXX" required />
        </div>
        <div>
          <label htmlFor="phone" className="label">Téléphone utilisé à la commande</label>
          <input id="phone" type="tel" inputMode="tel" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="70 12 34 56" required />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Recherche…" : "Suivre"}
        </button>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 sm:col-span-3">{error}</p>}
      </form>

      {result && (
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-ink-3">Commande <span className="font-mono font-semibold text-ink">{result.code}</span></p>
              <h2 className="mt-1 text-xl font-bold">{result.statusLabel}</h2>
              <p className="mt-1 text-sm text-ink-2">
                {result.frame || "Monture"}{result.lenses ? ` · ${result.lenses}` : ""}
              </p>
              <p className="mt-1 text-sm text-ink-2">
                À retirer : <strong>{result.agency.name}</strong>, {result.agency.city} ·{" "}
                <a href={`tel:${result.agency.phoneE164}`} className="font-semibold text-brand-700">{result.agency.phoneDisplay}</a>
              </p>
            </div>
            {result.status === "ready" && (
              <a href={result.agency.mapsUrl} target="_blank" rel="noreferrer" className="btn-lime btn-sm">
                Itinéraire vers l&apos;agence
              </a>
            )}
          </div>

          <ol className="mt-6 grid gap-3 sm:grid-cols-4">
            {result.steps.map((label, i) => {
              const state = i < result.stepIndex ? "done" : i === result.stepIndex ? "current" : "todo";
              return (
                <li key={label} className="flex items-start gap-3 sm:flex-col sm:gap-2">
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      state === "done" ? "bg-brand-700 text-white" : state === "current" ? "bg-accent-500 text-ink" : "bg-paper-2 text-ink-3"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={`text-sm ${state === "todo" ? "text-ink-3" : "font-medium"}`}>{label}</span>
                </li>
              );
            })}
          </ol>

          <dl className="mt-6 grid gap-2 text-sm text-ink-2 sm:grid-cols-3">
            <div><dt className="text-ink-3">Enregistrée</dt><dd>{fmt(result.createdAt)}</dd></div>
            {result.readyAt && <div><dt className="text-ink-3">Prête depuis</dt><dd>{fmt(result.readyAt)}</dd></div>}
            {result.collectedAt && <div><dt className="text-ink-3">Retirée</dt><dd>{fmt(result.collectedAt)}</dd></div>}
          </dl>
        </div>
      )}
    </div>
  );
}
