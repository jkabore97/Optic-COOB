export type AppointmentStatus = "confirmed" | "cancelled" | "done";

export interface Appointment {
  id: string;
  code: string;
  name: string;
  phone: string; // E.164
  agency: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  reason: string;
  notes: string;
  status: AppointmentStatus;
  createdAt: string; // ISO
  confirmationSmsAt: string | null;
  reminderSmsAt: string | null;
}

export type OrderStatus = "received" | "in_progress" | "ready" | "collected";

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "received",
  "in_progress",
  "ready",
  "collected",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: "Commande reçue",
  in_progress: "En fabrication",
  ready: "Prête à retirer",
  collected: "Retirée",
};

export interface Order {
  id: string;
  code: string;
  customerName: string;
  phone: string; // E.164
  agency: string;
  frame: string;
  lenses: string;
  notes: string;
  totalFcfa: number | null;
  paidFcfa: number | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  collectedAt: string | null;
  readySmsAt: string | null;
}

export type SmsStatus = "sent" | "failed" | "skipped";

export interface SmsLog {
  id: string;
  to: string;
  body: string;
  provider: string;
  status: SmsStatus;
  providerId: string | null;
  error: string | null;
  relatedType: "appointment" | "order" | null;
  relatedId: string | null;
  createdAt: string;
}

export type NewAppointment = Omit<
  Appointment,
  "id" | "createdAt" | "confirmationSmsAt" | "reminderSmsAt" | "status"
>;

export type NewOrder = Omit<
  Order,
  "id" | "createdAt" | "updatedAt" | "readyAt" | "collectedAt" | "readySmsAt" | "status"
>;

export interface Store {
  // Rendez-vous
  createAppointment(input: NewAppointment): Promise<Appointment>;
  getAppointment(id: string): Promise<Appointment | null>;
  listAppointments(opts: { from?: string; to?: string }): Promise<Appointment[]>;
  bookedTimes(date: string, agency: string): Promise<string[]>;
  updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "status" | "confirmationSmsAt" | "reminderSmsAt">>,
  ): Promise<Appointment | null>;

  // Commandes
  createOrder(input: NewOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  findOrder(code: string, phone: string): Promise<Order | null>;
  listOrders(opts: { status?: OrderStatus | "active" }): Promise<Order[]>;
  updateOrder(
    id: string,
    patch: Partial<Pick<Order, "status" | "readyAt" | "collectedAt" | "readySmsAt" | "notes">>,
  ): Promise<Order | null>;

  // SMS
  logSms(entry: Omit<SmsLog, "id" | "createdAt">): Promise<SmsLog>;
  listSms(limit?: number): Promise<SmsLog[]>;
}
