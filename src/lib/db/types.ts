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

export interface Store extends CatalogStore, CatalogModelStore {
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

// ---- Catalogue de montures (géré dans l'espace équipe) ----

export interface CatalogFrameRecord {
  id: string;
  slug: string;
  name: string;
  collection: string;
  shape: string;
  material: string;
  color: string;
  gender: string;
  priceFcfa: number;
  sizeLens: number;
  sizeBridge: number;
  sizeTemple: number;
  description: string;
  tags: string[];
  /** Type MIME de la photo (null si aucune photo). */
  imageMime: string | null;
  imageWidth: number;
  imageHeight: number;
  anchorLx: number;
  anchorLy: number;
  anchorRx: number;
  anchorRy: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Date du modèle 3D (GLB) associé, null si aucun. */
  modelUpdatedAt: string | null;
}

export type CatalogFrameInput = Omit<CatalogFrameRecord, "id" | "createdAt" | "updatedAt" | "imageMime" | "modelUpdatedAt">;

export interface FrameImageBlob {
  mime: string;
  bytes: Uint8Array;
  updatedAt: string;
}

export interface CatalogStore {
  listFrames(opts?: { includeInactive?: boolean }): Promise<CatalogFrameRecord[]>;
  getFrame(id: string): Promise<CatalogFrameRecord | null>;
  getFrameBySlug(slug: string): Promise<CatalogFrameRecord | null>;
  createFrame(input: CatalogFrameInput, image: { mime: string; bytes: Uint8Array } | null): Promise<CatalogFrameRecord>;
  updateFrame(
    id: string,
    patch: Partial<CatalogFrameInput>,
    image?: { mime: string; bytes: Uint8Array } | null,
  ): Promise<CatalogFrameRecord | null>;
  deleteFrame(id: string): Promise<boolean>;
  getFrameImage(id: string): Promise<FrameImageBlob | null>;
}

// ---- Modèles 3D des montures (GLB) ----

export interface FrameModelBlob {
  mime: string;
  bytes: Uint8Array;
  updatedAt: string;
}

export interface CatalogModelStore {
  setFrameModel(frameId: string, model: { mime: string; bytes: Uint8Array }): Promise<void>;
  deleteFrameModel(frameId: string): Promise<void>;
  getFrameModel(frameId: string): Promise<FrameModelBlob | null>;
}
