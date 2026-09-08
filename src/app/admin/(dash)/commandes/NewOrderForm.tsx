"use client";

import { useActionState } from "react";
import { createOrderAction } from "@/app/admin/actions";
import { AGENCIES, MAIN_AGENCY } from "@/lib/config";

export function NewOrderForm({ frameNames }: { frameNames: string[] }) {
  const [state, action, pending] = useActionState(createOrderAction, undefined);
  return (
    <form action={action} className="card grid gap-4 p-5">
      <h2 className="text-lg font-bold">Nouvelle commande</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="customerName" className="label">Client</label>
          <input id="customerName" name="customerName" className="field" required minLength={2} placeholder="Nom et prénom" />
        </div>
        <div>
          <label htmlFor="phone" className="label">Téléphone (SMS)</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className="field" required placeholder="70 12 34 56" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="agency" className="label">Agence de retrait</label>
          <select id="agency" name="agency" className="field" defaultValue={MAIN_AGENCY.id}>
            {AGENCIES.map((a) => (
              <option key={a.id} value={a.id}>{a.name} — {a.city}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="frame" className="label">Monture</label>
          <input id="frame" name="frame" className="field" list="frames" placeholder="Ex. Kadiogo Noir ou référence fournisseur" />
          <datalist id="frames">
            {frameNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="lenses" className="label">Verres</label>
          <input id="lenses" name="lenses" className="field" placeholder="Ex. progressifs antireflet" />
        </div>
        <div>
          <label htmlFor="totalFcfa" className="label">Total (FCFA)</label>
          <input id="totalFcfa" name="totalFcfa" type="number" inputMode="numeric" min={0} step={500} className="field" />
        </div>
        <div>
          <label htmlFor="paidFcfa" className="label">Acompte versé (FCFA)</label>
          <input id="paidFcfa" name="paidFcfa" type="number" inputMode="numeric" min={0} step={500} className="field" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="notes" className="label">Notes internes</label>
          <input id="notes" name="notes" className="field" maxLength={500} placeholder="Correction, délai annoncé, etc." />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" name="notify" value="1" defaultChecked className="h-4 w-4 accent-brand-700" />
        Envoyer au client un SMS de confirmation avec sa référence
      </label>
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
      <button type="submit" className="btn-primary justify-self-start" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer la commande"}
      </button>
    </form>
  );
}
