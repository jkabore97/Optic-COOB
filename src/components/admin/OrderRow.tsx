import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, type Order } from "@/lib/db";
import { getAgency } from "@/lib/config";
import { formatFcfa } from "@/lib/frames";
import { formatPhoneLocal } from "@/lib/phone";
import { resendReadySmsAction, setOrderStatusAction } from "@/app/admin/actions";
import { OrderStatusBadge } from "./StatusBadge";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Ouagadougou", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function OrderRow({ order }: { order: Order }) {
  const idx = ORDER_STATUS_FLOW.indexOf(order.status);
  const next = ORDER_STATUS_FLOW[idx + 1];
  const prev = ORDER_STATUS_FLOW[idx - 1];
  const balance = order.totalFcfa != null ? order.totalFcfa - (order.paidFcfa ?? 0) : null;

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{order.code}</span>
            <OrderStatusBadge status={order.status} />
            <span className="badge bg-brand-100 text-brand-800">{getAgency(order.agency).name}</span>
            {order.status === "ready" && (
              <span className={`badge ${order.readySmsAt ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                {order.readySmsAt ? `SMS envoyé ${fmt(order.readySmsAt)}` : "SMS non envoyé"}
              </span>
            )}
          </div>
          <p className="mt-1.5 font-semibold">{order.customerName} <span className="font-normal text-ink-2">· {formatPhoneLocal(order.phone)}</span></p>
          <p className="text-sm text-ink-2">
            {order.frame || <em>Monture non précisée</em>}{order.lenses ? ` · ${order.lenses}` : ""}
          </p>
          {order.notes && <p className="mt-1 text-xs text-ink-3">{order.notes}</p>}
          <p className="mt-1 text-xs text-ink-3">
            Créée le {fmt(order.createdAt)}
            {order.totalFcfa != null && ` · Total ${formatFcfa(order.totalFcfa)}`}
            {balance != null && balance > 0 && <span className="font-semibold text-amber-700"> · Reste {formatFcfa(balance)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {prev && (
            <form action={setOrderStatusAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value={prev} />
              <button type="submit" className="btn-ghost btn-sm">← {ORDER_STATUS_LABELS[prev]}</button>
            </form>
          )}
          {order.status === "ready" && (
            <form action={resendReadySmsAction}>
              <input type="hidden" name="id" value={order.id} />
              <button type="submit" className="btn-outline btn-sm">Renvoyer le SMS</button>
            </form>
          )}
          {next && (
            <form action={setOrderStatusAction}>
              <input type="hidden" name="id" value={order.id} />
              <input type="hidden" name="status" value={next} />
              <button type="submit" className={next === "ready" ? "btn-accent btn-sm" : "btn-primary btn-sm"}>
                {next === "ready" ? "Prête → envoyer le SMS" : ORDER_STATUS_LABELS[next]} →
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
