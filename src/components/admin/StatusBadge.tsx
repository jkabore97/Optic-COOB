import { ORDER_STATUS_LABELS, type AppointmentStatus, type OrderStatus } from "@/lib/db";

const ORDER_COLORS: Record<OrderStatus, string> = {
  received: "bg-slate-100 text-slate-800",
  in_progress: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  collected: "bg-paper-2 text-ink-3",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${ORDER_COLORS[status]}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

const APPT_LABELS: Record<AppointmentStatus, string> = {
  confirmed: "Confirmé",
  done: "Honoré",
  cancelled: "Annulé",
};
const APPT_COLORS: Record<AppointmentStatus, string> = {
  confirmed: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`badge ${APPT_COLORS[status]}`}>{APPT_LABELS[status]}</span>;
}
