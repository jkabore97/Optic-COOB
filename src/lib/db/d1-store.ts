import type { D1Database } from "@cloudflare/workers-types";
import { newId } from "../ids";
import type {
  Appointment,
  NewAppointment,
  NewOrder,
  Order,
  OrderStatus,
  SmsLog,
  Store,
} from "./types";

type Row = Record<string, unknown>;

const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
const nullableStr = (v: unknown): string | null => (v == null ? null : String(v));

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

/** Stockage Cloudflare D1 (SQLite). Schéma : src/lib/db/schema.sqlite.sql */
export class D1Store implements Store {
  constructor(private readonly db: D1Database) {}

  async createAppointment(input: NewAppointment): Promise<Appointment> {
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
    const row = await this.db.prepare(`select * from appointments where id = ?`).bind(id).first<Row>();
    return row ? rowToAppointment(row) : null;
  }

  async listAppointments(opts: { from?: string; to?: string }): Promise<Appointment[]> {
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

  async createOrder(input: NewOrder): Promise<Order> {
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
    const row = await this.db.prepare(`select * from orders where id = ?`).bind(id).first<Row>();
    return row ? rowToOrder(row) : null;
  }

  async findOrder(code: string, phone: string): Promise<Order | null> {
    const row = await this.db
      .prepare(`select * from orders where code = ? and phone = ?`)
      .bind(code.trim().toUpperCase(), phone)
      .first<Row>();
    return row ? rowToOrder(row) : null;
  }

  async listOrders(opts: { status?: OrderStatus | "active" }): Promise<Order[]> {
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

  async logSms(entry: Omit<SmsLog, "id" | "createdAt">): Promise<SmsLog> {
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
    const { results } = await this.db.prepare(`select * from sms_log order by created_at desc limit ?`).bind(limit).all<Row>();
    return results.map(rowToSms);
  }
}
