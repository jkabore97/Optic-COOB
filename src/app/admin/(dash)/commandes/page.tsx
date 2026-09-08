import Link from "next/link";
import { OrderRow } from "@/components/admin/OrderRow";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, getStore, type OrderStatus } from "@/lib/db";
import { NewOrderForm } from "./NewOrderForm";
import { getCatalog } from "@/lib/catalog";
import { COLOR_LABELS } from "@/lib/frames";

export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const FILTERS: { value: OrderStatus | "active" | "all"; label: string }[] = [
  { value: "active", label: "En cours" },
  ...ORDER_STATUS_FLOW.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })),
  { value: "all", label: "Toutes" },
];

export default async function OrdersPage({ searchParams }: PageProps<"/admin/commandes">) {
  const sp = await searchParams;
  const filter = (first(sp.statut) ?? "active") as OrderStatus | "active" | "all";
  const ok = first(sp.ok);
  const [orders, catalog] = await Promise.all([
    getStore().listOrders({ status: filter === "all" ? undefined : filter }),
    getCatalog(),
  ]);
  const frameNames = catalog.map((f) => `${f.name} ${COLOR_LABELS[f.color] ?? ""}`.trim());

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <div className="lg:col-span-2">
        {ok && (
          <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
            Commande <span className="font-mono font-semibold">{ok}</span> enregistrée.
          </p>
        )}
        <NewOrderForm frameNames={frameNames} />
      </div>
      <div className="lg:col-span-3">
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "active" ? "/admin/commandes" : `/admin/commandes?statut=${f.value}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f.value ? "bg-brand-700 text-white" : "bg-white text-ink-2 hover:bg-brand-50"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        {orders.length === 0 ? (
          <p className="card mt-4 p-6 text-sm text-ink-2">Aucune commande dans cette catégorie.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
