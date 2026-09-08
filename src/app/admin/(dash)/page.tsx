import Link from "next/link";
import { AppointmentStatusBadge } from "@/components/admin/StatusBadge";
import { OrderRow } from "@/components/admin/OrderRow";
import { EXAM_REASONS, getAgency } from "@/lib/config";
import { getStore } from "@/lib/db";
import { formatPhoneLocal } from "@/lib/phone";
import { formatDateFr, todayISO } from "@/lib/slots";
import { setAppointmentStatusAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const store = getStore();
  const today = todayISO();
  const [appts, orders] = await Promise.all([
    store.listAppointments({ from: today, to: today }),
    store.listOrders({ status: "active" }),
  ]);
  const ready = orders.filter((o) => o.status === "ready");
  const inProgress = orders.filter((o) => o.status !== "ready");
  const reasonLabel = (v: string) => EXAM_REASONS.find((r) => r.value === v)?.label ?? v;

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-ink-3">RDV aujourd&apos;hui</p><p className="mt-1 text-3xl font-bold">{appts.filter((a) => a.status !== "cancelled").length}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-3">Commandes en cours</p><p className="mt-1 text-3xl font-bold">{inProgress.length}</p></div>
        <div className="card p-5"><p className="text-sm text-ink-3">Prêtes, à retirer</p><p className="mt-1 text-3xl font-bold text-green-700">{ready.length}</p></div>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold capitalize">{formatDateFr(today)}</h2>
          <Link href="/admin/rendez-vous" className="text-sm font-semibold text-brand-700 hover:underline">Tous les rendez-vous →</Link>
        </div>
        {appts.length === 0 ? (
          <p className="card mt-4 p-6 text-sm text-ink-2">Aucun rendez-vous aujourd&apos;hui.</p>
        ) : (
          <ul className="mt-4 grid gap-2">
            {appts.map((a) => (
              <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold tabular-nums">{a.time.replace(":", "h")}</span>
                  <div>
                    <p className="font-semibold">{a.name} <span className="font-normal text-ink-2">· {formatPhoneLocal(a.phone)}</span></p>
                    <p className="text-xs text-ink-3">{reasonLabel(a.reason)}{a.notes ? ` — ${a.notes}` : ""} · {a.code}</p>
                  </div>
                  <span className="badge bg-brand-100 text-brand-800">{getAgency(a.agency).name}</span>
                  <AppointmentStatusBadge status={a.status} />
                </div>
                {a.status === "confirmed" && (
                  <div className="flex gap-2">
                    <form action={setAppointmentStatusAction}>
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="done" />
                      <button className="btn-primary btn-sm">Honoré</button>
                    </form>
                    <form action={setAppointmentStatusAction}>
                      <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="cancelled" />
                      <button className="btn-ghost btn-sm">Annuler</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Commandes en cours</h2>
          <Link href="/admin/commandes" className="btn-primary btn-sm">+ Nouvelle commande</Link>
        </div>
        {orders.length === 0 ? (
          <p className="card mt-4 p-6 text-sm text-ink-2">Aucune commande en cours.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orders.slice(0, 10).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
