"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AGENCIES, BOOKING_HORIZON_DAYS, EXAM_REASONS, getAgency, type ExamReason } from "@/lib/config";
import { addDays, formatDateFr, todayISO, type SlotAvailability } from "@/lib/slots";

interface Confirmation {
  code: string;
  agency: string;
  date: string;
  time: string;
  smsSent: boolean;
}

export function BookingForm({ initialReason, initialAgency }: { initialReason?: string; initialAgency?: string }) {
  const today = todayISO();
  const max = addDays(today, BOOKING_HORIZON_DAYS);

  const [agency, setAgency] = useState(getAgency(initialAgency).id);
  const [date, setDate] = useState(today);
  /** null = chargement en cours */
  const [slots, setSlots] = useState<SlotAvailability[] | null>(null);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState<ExamReason>(
    (EXAM_REASONS.find((r) => r.value === initialReason)?.value ?? "examen") as ExamReason,
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Confirmation | null>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    fetch(`/api/appointments/slots?date=${date}&agence=${agency}`)
      .then((r) => r.json())
      .then((j: { slots?: SlotAvailability[] }) => {
        if (!cancelled) setSlots(j.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [date, agency]);

  const changeAgency = (next: string) => {
    setAgency(next);
    setSlots(null);
    setTime("");
  };

  const changeDate = (next: string) => {
    setDate(next);
    setSlots(null);
    setTime("");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!time) {
      setError("Choisissez un créneau.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, agency, date, time, reason, notes, website: fd.get("website") ?? "" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Une erreur est survenue. Réessayez.");
        if (res.status === 409) {
          // Rafraîchir les créneaux
          const r = await fetch(`/api/appointments/slots?date=${date}&agence=${agency}`).then((x) => x.json());
          setSlots(r.slots ?? []);
          setTime("");
        }
        return;
      }
      setDone(json);
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="card p-6 sm:p-8">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">✓</span>
        <h2 className="mt-4 text-2xl font-bold">Rendez-vous confirmé</h2>
        <p className="mt-2 text-ink-2">
          Nous vous attendons le <strong>{formatDateFr(done.date)}</strong> à <strong>{done.time.replace(":", "h")}</strong>,{" "}
          <strong>{getAgency(done.agency).name}</strong> ({getAgency(done.agency).city}).
        </p>
        <p className="mt-4 rounded-xl bg-paper-2 px-4 py-3 text-sm">
          Référence : <span className="font-mono font-semibold">{done.code}</span>
        </p>
        <p className="mt-3 text-sm text-ink-2">
          {done.smsSent
            ? "Un SMS de confirmation vient de vous être envoyé."
            : "Nous n'avons pas pu envoyer le SMS de confirmation, mais votre rendez-vous est bien enregistré."}{" "}
          Pour modifier ou annuler, appelez le{" "}
          <a href={`tel:${getAgency(done.agency).phoneE164}`} className="font-semibold text-brand-700">
            {getAgency(done.agency).phoneDisplay}
          </a>
          .
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/montures" className="btn-primary">
            Découvrir les montures
          </Link>
          <Link href="/" className="btn-ghost">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 sm:p-8" noValidate>
      <div className="grid gap-6">
        <fieldset>
          <legend className="text-lg font-semibold">1. Choisissez votre agence</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {AGENCIES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => changeAgency(a.id)}
                aria-pressed={agency === a.id}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  agency === a.id ? "border-brand-700 bg-brand-50 ring-2 ring-brand-500/20" : "border-ink/15 bg-white hover:border-brand-500"
                }`}
              >
                <span className="block font-semibold">{a.name}</span>
                <span className="block text-xs text-ink-3">{a.city}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">2. Choisissez un créneau</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-[220px_1fr]">
            <div>
              <label htmlFor="date" className="label">Date</label>
              <input id="date" type="date" className="field" value={date} min={today} max={max} onChange={(e) => changeDate(e.target.value)} required />
              {date && <p className="mt-1.5 text-xs capitalize text-ink-3">{formatDateFr(date)}</p>}
            </div>
            <div>
              <p className="label">Heure</p>
              {slots === null ? (
                <p className="text-sm text-ink-3">Chargement des créneaux…</p>
              ) : slots.length === 0 ? (
                <p className="rounded-xl bg-paper-2 px-3 py-2.5 text-sm text-ink-2">Fermé ce jour-là. Choisissez une autre date.</p>
              ) : slots.every((s) => !s.available) ? (
                <p className="rounded-xl bg-paper-2 px-3 py-2.5 text-sm text-ink-2">Complet. Essayez un autre jour.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setTime(s.time)}
                      aria-pressed={time === s.time}
                      className={`rounded-xl border px-2 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through ${
                        time === s.time ? "border-brand-700 bg-brand-700 text-white" : "border-ink/15 bg-white hover:border-brand-500"
                      }`}
                    >
                      {s.time.replace(":", "h")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-semibold">3. Vos coordonnées</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="label">Nom et prénom</label>
              <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} placeholder="Ex. Awa Ouédraogo" />
            </div>
            <div>
              <label htmlFor="phone" className="label">Téléphone (pour le SMS de confirmation)</label>
              <input id="phone" type="tel" inputMode="tel" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required placeholder="70 12 34 56" />
            </div>
            <div>
              <label htmlFor="reason" className="label">Motif</label>
              <select id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value as ExamReason)}>
                {EXAM_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notes" className="label">Précisions (facultatif)</label>
              <input id="notes" className="field" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Ex. je porte déjà des lunettes" />
            </div>
          </div>
          {/* Pot de miel anti-spam */}
          <div className="hidden" aria-hidden="true">
            <label>Site web<input name="website" tabIndex={-1} autoComplete="off" /></label>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-3">
            {time ? `Créneau choisi : ${formatDateFr(date)} à ${time.replace(":", "h")}.` : "Sélectionnez un créneau pour continuer."}
          </p>
          <button type="submit" className="btn-primary" disabled={submitting || !time}>
            {submitting ? "Enregistrement…" : "Confirmer le rendez-vous"}
          </button>
        </div>
      </div>
    </form>
  );
}
