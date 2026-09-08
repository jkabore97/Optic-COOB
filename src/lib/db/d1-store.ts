import type { D1Database } from "@cloudflare/workers-types";
import { newId } from "../ids";
import { rowToFrame } from "./frame-rows";
import { SQLITE_SCHEMA, splitStatements } from "./schema";
import type {
  Appointment,
  CatalogFrameInput,
  CatalogFrameRecord,
  FrameImageBlob,
  NewAppointment,
  NewOrder,
  Order,
  OrderStatus,
  SmsLog,
  Store,
} from "./types";

type Row = Record<string, unknown>;
type ImageInput = { mime: string; bytes: Uint8Array } | null | undefined;

const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const nullableStr = (v: unknown): string | null => (v == null ? null : String(v));
const toArrayBuffer = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

function rowToAppointment(r: Row): Appointment {
  return {
    id: str(r.id),
    code: str(r.code),
    name: str(r.name),
    phone: str(r.phone),
    agency: str(r.agency),
    date: str(r.date).slice(0, 10),
    time: str(r.time),
    reason: str(r.reason),
    notes: str(r.notes),
    status: r.status as Appointment["status"],
    createdAt: str(r.created_at),
    confirmationSmsAt: nullableStr(r.confirmation_sms_at),
    reminderSmsAt: nullableStr(r.reminder_sms_at),
  };
}

function rowToOrder(r: Row): Order {
  return {
    id: str(r.id),
    code: str(r.code),
    customerName: str(r.customer_name),
    phone: str(r.phone),
    agency: str(r.agency),
    frame: str(r.frame),
    lenses: str(r.lenses),
    notes: str(r.notes),
    totalFcfa: r.total_fcfa == null ? null : Number(r.total_fcfa),
    paidFcfa: r.paid_fcfa == null ? null : Number(r.paid_fcfa),
    status: r.status as OrderStatus,
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    readyAt: nullableStr(r.ready_at),
    collectedAt: nullableStr(r.collected_at),
    readySmsAt: nullableStr(r.ready_sms_at),
  };
}

function rowToSms(r: Row): SmsLog {
  return {
    id: str(r.id),
    to: str(r.to),
    body: str(r.body),
    provider: str(r.provider),
    status: r.status as SmsLog["status"],
    providerId: nullableStr(r.provider_id),
    error: nullableStr(r.error),
    relatedType: (r.related_type as SmsLog["relatedType"]) ?? null,
    relatedId: nullableStr(r.related_id),
    createdAt: str(r.created_at),
  };
}

/** Stockage Cloudflare D1 (SQLite). Le schéma est créé automatiquement au premier accès. */
export class D1Store implements Store {
  private static schemaReady = new WeakMap<D1Database, Promise<void>>();

  constructor(private readonly db: D1Database) {}

  ready(): Promise<void> {
    let p = D1Store.schemaReady.get(this.db);
    if (!p) {
      p = this.db.batch(splitStatements(SQLITE_SCHEMA).map((s) => this.db.prepare(s))).then(() => undefined);
      D1Store.schemaReady.set(this.db, p);
      p.catch(() => D1Store.schemaReady.delete(this.db));
    }
    return p;
  }

  // ---- Rendez-vous ----

  async createAppointment(input: NewAppointment): Promise<Appointment> {
    await this.ready();
    const id = newId();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `insert into appointments (id, code, name, phone, agency, date, time, reason, notes, status, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
      )
      .bind(id, input.code, input.name, input.phone, input.agency, input.date, input.time, input.reason, input.notes, now)
      .run();
    return (await this.getAppointment(id))!;
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    await this.ready();
    const row = await this.db.prepare(`select * from appointments where id = ?`).bind(id).first<Row>();
    return row ? rowToAppointment(row) : null;
  }

  async listAppointments(opts: { from?: string; to?: string }): Promise<Appointment[]> {
    await this.ready();
    const { results } = await this.db
      .prepare(
        `select * from appointments
         where (? is null or date >= ?) and (? is null or date <= ?)
         order by date, time`,
      )
      .bind(opts.from ?? null, opts.from ?? null, opts.to ?? null, opts.to ?? null)
      .all<Row>();
    return results.map(rowToAppointment);
  }

  async bookedTimes(date: string, agency: string): Promise<string[]> {
    await this.ready();
    const { results } = await this.db
      .prepare(`select time from appointments where date = ? and agency = ? and status <> 'cancelled'`)
      .bind(date, agency)
      .all<Row>();
    return results.map((r) => str(r.time));
  }

  async updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "status" | "confirmationSmsAt" | "reminderSmsAt">>,
  ): Promise<Appointment | null> {
    await this.ready();
    await this.db
      .prepare(
        `update appointments set
           status = coalesce(?, status),
           confirmation_sms_at = coalesce(?, confirmation_sms_at),
           reminder_sms_at = coalesce(?, reminder_sms_at)
         where id = ?`,
      )
      .bind(patch.status ?? null, patch.confirmationSmsAt ?? null, patch.reminderSmsAt ?? null, id)
      .run();
    return this.getAppointment(id);
  }

  // ---- Commandes ----

  async createOrder(input: NewOrder): Promise<Order> {
    await this.ready();
    const id = newId();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `insert into orders (id, code, customer_name, phone, agency, frame, lenses, notes, total_fcfa, paid_fcfa, status, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)`,
      )
      .bind(id, input.code, input.customerName, input.phone, input.agency, input.frame, input.lenses, input.notes, input.totalFcfa, input.paidFcfa, now, now)
      .run();
    return (await this.getOrder(id))!;
  }

  async getOrder(id: string): Promise<Order | null> {
    await this.ready();
    const row = await this.db.prepare(`select * from orders where id = ?`).bind(id).first<Row>();
    return row ? rowToOrder(row) : null;
  }

  async findOrder(code: string, phone: string): Promise<Order | null> {
    await this.ready();
    const row = await this.db
      .prepare(`select * from orders where code = ? and phone = ?`)
      .bind(code.trim().toUpperCase(), phone)
      .first<Row>();
    return row ? rowToOrder(row) : null;
  }

  async listOrders(opts: { status?: OrderStatus | "active" }): Promise<Order[]> {
    await this.ready();
    const stmt =
      opts.status === "active"
        ? this.db.prepare(`select * from orders where status <> 'collected' order by created_at desc`)
        : opts.status
          ? this.db.prepare(`select * from orders where status = ? order by created_at desc`).bind(opts.status)
          : this.db.prepare(`select * from orders order by created_at desc`);
    const { results } = await stmt.all<Row>();
    return results.map(rowToOrder);
  }

  async updateOrder(
    id: string,
    patch: Partial<Pick<Order, "status" | "readyAt" | "collectedAt" | "readySmsAt" | "notes">>,
  ): Promise<Order | null> {
    await this.ready();
    await this.db
      .prepare(
        `update orders set
           status = coalesce(?, status),
           notes = coalesce(?, notes),
           ready_at = coalesce(?, ready_at),
           collected_at = coalesce(?, collected_at),
           ready_sms_at = coalesce(?, ready_sms_at),
           updated_at = ?
         where id = ?`,
      )
      .bind(patch.status ?? null, patch.notes ?? null, patch.readyAt ?? null, patch.collectedAt ?? null, patch.readySmsAt ?? null, new Date().toISOString(), id)
      .run();
    return this.getOrder(id);
  }

  // ---- SMS ----

  async logSms(entry: Omit<SmsLog, "id" | "createdAt">): Promise<SmsLog> {
    await this.ready();
    const id = newId();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `insert into sms_log (id, "to", body, provider, status, provider_id, error, related_type, related_id, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, entry.to, entry.body, entry.provider, entry.status, entry.providerId, entry.error, entry.relatedType, entry.relatedId, now)
      .run();
    return { ...entry, id, createdAt: now };
  }

  async listSms(limit = 50): Promise<SmsLog[]> {
    await this.ready();
    const { results } = await this.db.prepare(`select * from sms_log order by created_at desc limit ?`).bind(limit).all<Row>();
    return results.map(rowToSms);
  }

  // ---- Catalogue ----

  async listFrames(opts: { includeInactive?: boolean } = {}): Promise<CatalogFrameRecord[]> {
    await this.ready();
    const { results } = await this.db
      .prepare(`select * from frames where (? = 1 or active = 1) order by sort_order, created_at`)
      .bind(opts.includeInactive ? 1 : 0)
      .all<Row>();
    return results.map(rowToFrame);
  }

  async getFrame(id: string): Promise<CatalogFrameRecord | null> {
    await this.ready();
    const row = await this.db.prepare(`select * from frames where id = ?`).bind(id).first<Row>();
    return row ? rowToFrame(row) : null;
  }

  async getFrameBySlug(slug: string): Promise<CatalogFrameRecord | null> {
    await this.ready();
    const row = await this.db.prepare(`select * from frames where slug = ?`).bind(slug).first<Row>();
    return row ? rowToFrame(row) : null;
  }

  async createFrame(input: CatalogFrameInput, image: ImageInput): Promise<CatalogFrameRecord> {
    await this.ready();
    const id = newId();
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `insert into frames (id, slug, name, collection, shape, material, color, gender, price_fcfa,
           size_lens, size_bridge, size_temple, description, tags, image, image_mime, image_width, image_height,
           anchor_lx, anchor_ly, anchor_rx, anchor_ry, active, sort_order, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id, input.slug, input.name, input.collection, input.shape, input.material, input.color, input.gender,
        input.priceFcfa, input.sizeLens, input.sizeBridge, input.sizeTemple, input.description, input.tags.join(","),
        image ? toArrayBuffer(image.bytes) : null, image?.mime ?? null, input.imageWidth, input.imageHeight,
        input.anchorLx, input.anchorLy, input.anchorRx, input.anchorRy, input.active ? 1 : 0, input.sortOrder, now, now,
      )
      .run();
    return (await this.getFrame(id))!;
  }

  async updateFrame(id: string, patch: Partial<CatalogFrameInput>, image?: ImageInput): Promise<CatalogFrameRecord | null> {
    await this.ready();
    const current = await this.getFrame(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await this.db
      .prepare(
        `update frames set slug = ?, name = ?, collection = ?, shape = ?, material = ?, color = ?, gender = ?,
           price_fcfa = ?, size_lens = ?, size_bridge = ?, size_temple = ?, description = ?, tags = ?,
           image = coalesce(?, image), image_mime = coalesce(?, image_mime), image_width = ?, image_height = ?,
           anchor_lx = ?, anchor_ly = ?, anchor_rx = ?, anchor_ry = ?, active = ?, sort_order = ?, updated_at = ?
         where id = ?`,
      )
      .bind(
        next.slug, next.name, next.collection, next.shape, next.material, next.color, next.gender, next.priceFcfa,
        next.sizeLens, next.sizeBridge, next.sizeTemple, next.description, next.tags.join(","),
        image ? toArrayBuffer(image.bytes) : null, image?.mime ?? null, next.imageWidth, next.imageHeight,
        next.anchorLx, next.anchorLy, next.anchorRx, next.anchorRy, next.active ? 1 : 0, next.sortOrder,
        new Date().toISOString(), id,
      )
      .run();
    return this.getFrame(id);
  }

  async deleteFrame(id: string): Promise<boolean> {
    await this.ready();
    const res = await this.db.prepare(`delete from frames where id = ?`).bind(id).run();
    return (res.meta.changes ?? 0) > 0;
  }

  async getFrameImage(id: string): Promise<FrameImageBlob | null> {
    await this.ready();
    const row = await this.db.prepare(`select image, image_mime, updated_at from frames where id = ?`).bind(id).first<Row>();
    if (!row || !row.image || !row.image_mime) return null;
    const raw = row.image as ArrayBuffer | Uint8Array;
    return { mime: String(row.image_mime), bytes: raw instanceof Uint8Array ? raw : new Uint8Array(raw), updatedAt: String(row.updated_at) };
  }
}
