import Link from "next/link";
import { AppointmentStatusBadge } from "@/components/admin/StatusBadge";
import { EXAM_REASONS, getAgency } from "@/lib/config";
import { getStore } from "@/lib/db";
import { formatPhoneLocal } from "@/lib/phone";
import { addDays, formatDateFr, isValidISODate, todayISO } from "@/lib/slots";
import { setAppointmentStatusAction } from "../../actions";

export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AppointmentsPage({ searchParams }: PageProps<"/admin/rendez-vous">) {
  const sp = await searchParams;
  const today = todayISO();
  const from = isValidISODate(first(sp.date) ?? "") ? first(sp.date)! : today;
  const to = addDays(from, 6);
  const appts = await getStore().listAppointments({ from, to });
  const reasonLabel = (v: string) => EXAM_REASONS.find((r) => r.value === v)?.label ?? v;

  const byDate = new Map<string, typeof appts>();
  for (const a of appts) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Rendez-vous</h1>
        <form className="flex items-center gap-2">
          <Link href={`/admin/rendez-vous?date=${addDays(from, -7)}`} className="btn-ghost btn-sm">← Semaine préc.</Link>
          <input type="date" name="date" defaultValue={from} className="field w-auto py-1.5" />
          <button className="btn-outline btn-sm">Aller</button>
          <Link href={`/admin/rendez-vous?date=${addDays(from, 7)}`} className="btn-ghost btn-sm">Semaine suiv. →</Link>
        </form>
      </div>
      <p className="mt-1 text-sm text-ink-3">Du {formatDateFr(from)} au {formatDateFr(to)} · {appts.length} rendez-vous</p>

      {appts.length === 0 ? (
        <p className="card mt-6 p-6 text-sm text-ink-2">Aucun rendez-vous sur cette période.</p>
      ) : (
        <div className="mt-6 grid gap-6">
          {[...byDate.entries()].map(([date, list]) => (
            <section key={date}>
              <h2 className="text-lg font-bold capitalize">{formatDateFr(date)}</h2>
              <ul className="mt-2 grid gap-2">
                {list.map((a) => (
                  <li key={a.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold tabular-nums">{a.time.replace(":", "h")}</span>
                      <div>
                        <p className="font-semibold">{a.name} <span className="font-normal text-ink-2">· {formatPhoneLocal(a.phone)}</span></p>
                        <p className="text-xs text-ink-3">
                          {reasonLabel(a.reason)}{a.notes ? ` — ${a.notes}` : ""} · {a.code}
                          {a.confirmationSmsAt ? " · SMS confirmé" : " · SMS non envoyé"}
                          {a.reminderSmsAt ? " · rappel envoyé" : ""}
                        </p>
                      </div>
                      <span className="badge bg-brand-100 text-brand-800">{getAgency(a.agency).name}</span>
                  <AppointmentStatusBadge status={a.status} />
                    </div>
                    <div className="flex gap-2">
                      {a.status !== "done" && (
                        <form action={setAppointmentStatusAction}>
                          <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="done" />
                          <button className="btn-primary btn-sm">Honoré</button>
                        </form>
                      )}
                      {a.status !== "cancelled" && (
                        <form action={setAppointmentStatusAction}>
                          <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="cancelled" />
                          <button className="btn-ghost btn-sm">Annuler</button>
                        </form>
                      )}
                      {a.status === "cancelled" && (
                        <form action={setAppointmentStatusAction}>
                          <input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="confirmed" />
                          <button className="btn-outline btn-sm">Rétablir</button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
