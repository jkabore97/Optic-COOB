import postgres, { type Sql } from "postgres";
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

const iso = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

function rowToAppointment(r: Row): Appointment {
  return {
    id: String(r.id),
    code: String(r.code),
    name: String(r.name),
    phone: String(r.phone),
    agency: String(r.agency ?? ""),
    date: String(r.date).slice(0, 10),
    time: String(r.time),
    reason: String(r.reason ?? ""),
    notes: String(r.notes ?? ""),
    status: r.status as Appointment["status"],
    createdAt: iso(r.created_at)!,
    confirmationSmsAt: iso(r.confirmation_sms_at),
    reminderSmsAt: iso(r.reminder_sms_at),
  };
}

function rowToOrder(r: Row): Order {
  return {
    id: String(r.id),
    code: String(r.code),
    customerName: String(r.customer_name),
    phone: String(r.phone),
    agency: String(r.agency ?? ""),
    frame: String(r.frame ?? ""),
    lenses: String(r.lenses ?? ""),
    notes: String(r.notes ?? ""),
    totalFcfa: r.total_fcfa == null ? null : Number(r.total_fcfa),
    paidFcfa: r.paid_fcfa == null ? null : Number(r.paid_fcfa),
    status: r.status as OrderStatus,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    readyAt: iso(r.ready_at),
    collectedAt: iso(r.collected_at),
    readySmsAt: iso(r.ready_sms_at),
  };
}

function rowToSms(r: Row): SmsLog {
  return {
    id: String(r.id),
    to: String(r.to),
    body: String(r.body),
    provider: String(r.provider),
    status: r.status as SmsLog["status"],
    providerId: r.provider_id == null ? null : String(r.provider_id),
    error: r.error == null ? null : String(r.error),
    relatedType: (r.related_type as SmsLog["relatedType"]) ?? null,
    relatedId: r.related_id == null ? null : String(r.related_id),
    createdAt: iso(r.created_at)!,
  };
}

/** Stockage PostgreSQL (Supabase, Neon…). Schéma : src/lib/db/schema.sql */
export class PgStore implements Store {
  private readonly sql: Sql;

  constructor(url: string) {
    this.sql = postgres(url, {
      max: 5,
      prepare: false,
      // Conserver les colonnes `date` en chaînes "YYYY-MM-DD" plutôt qu'en objets Date.
      types: {
        date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v },
      },
    });
  }

  async createAppointment(input: NewAppointment): Promise<Appointment> {
    const id = newId();
    const [row] = await this.sql`
      insert into appointments (id, code, name, phone, agency, date, time, reason, notes, status)
      values (${id}, ${input.code}, ${input.name}, ${input.phone}, ${input.agency}, ${input.date}, ${input.time},
              ${input.reason}, ${input.notes}, 'confirmed')
      returning *`;
    return rowToAppointment(row);
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    const [row] = await this.sql`select * from appointments where id = ${id}`;
    return row ? rowToAppointment(row) : null;
  }

  async listAppointments(opts: { from?: string; to?: string }): Promise<Appointment[]> {
    const rows = await this.sql`
      select * from appointments
      where (${opts.from ?? null}::date is null or date >= ${opts.from ?? null}::date)
        and (${opts.to ?? null}::date is null or date <= ${opts.to ?? null}::date)
      order by date, time`;
    return rows.map(rowToAppointment);
  }

  async bookedTimes(date: string, agency: string): Promise<string[]> {
    const rows = await this.sql`
      select time from appointments
      where date = ${date}::date and agency = ${agency} and status <> 'cancelled'`;
    return rows.map((r) => String(r.time));
  }

  async updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "status" | "confirmationSmsAt" | "reminderSmsAt">>,
  ): Promise<Appointment | null> {
    const [row] = await this.sql`
      update appointments set
        status = coalesce(${patch.status ?? null}, status),
        confirmation_sms_at = coalesce(${patch.confirmationSmsAt ?? null}::timestamptz, confirmation_sms_at),
        reminder_sms_at = coalesce(${patch.reminderSmsAt ?? null}::timestamptz, reminder_sms_at)
      where id = ${id} returning *`;
    return row ? rowToAppointment(row) : null;
  }

  async createOrder(input: NewOrder): Promise<Order> {
    const id = newId();
    const [row] = await this.sql`
      insert into orders (id, code, customer_name, phone, agency, frame, lenses, notes, total_fcfa, paid_fcfa, status)
      values (${id}, ${input.code}, ${input.customerName}, ${input.phone}, ${input.agency}, ${input.frame}, ${input.lenses},
              ${input.notes}, ${input.totalFcfa}, ${input.paidFcfa}, 'received')
      returning *`;
    return rowToOrder(row);
  }

  async getOrder(id: string): Promise<Order | null> {
    const [row] = await this.sql`select * from orders where id = ${id}`;
    return row ? rowToOrder(row) : null;
  }

  async findOrder(code: string, phone: string): Promise<Order | null> {
    const [row] = await this.sql`
      select * from orders where code = ${code.trim().toUpperCase()} and phone = ${phone}`;
    return row ? rowToOrder(row) : null;
  }

  async listOrders(opts: { status?: OrderStatus | "active" }): Promise<Order[]> {
    const rows =
      opts.status === "active"
        ? await this.sql`select * from orders where status <> 'collected' order by created_at desc`
        : opts.status
          ? await this.sql`select * from orders where status = ${opts.status} order by created_at desc`
          : await this.sql`select * from orders order by created_at desc`;
    return rows.map(rowToOrder);
  }

  async updateOrder(
    id: string,
    patch: Partial<Pick<Order, "status" | "readyAt" | "collectedAt" | "readySmsAt" | "notes">>,
  ): Promise<Order | null> {
    const [row] = await this.sql`
      update orders set
        status = coalesce(${patch.status ?? null}, status),
        notes = coalesce(${patch.notes ?? null}, notes),
        ready_at = coalesce(${patch.readyAt ?? null}::timestamptz, ready_at),
        collected_at = coalesce(${patch.collectedAt ?? null}::timestamptz, collected_at),
        ready_sms_at = coalesce(${patch.readySmsAt ?? null}::timestamptz, ready_sms_at),
        updated_at = now()
      where id = ${id} returning *`;
    return row ? rowToOrder(row) : null;
  }

  async logSms(entry: Omit<SmsLog, "id" | "createdAt">): Promise<SmsLog> {
    const id = newId();
    const [row] = await this.sql`
      insert into sms_log (id, "to", body, provider, status, provider_id, error, related_type, related_id)
      values (${id}, ${entry.to}, ${entry.body}, ${entry.provider}, ${entry.status},
              ${entry.providerId}, ${entry.error}, ${entry.relatedType}, ${entry.relatedId})
      returning *`;
    return rowToSms(row);
  }

  async listSms(limit = 50): Promise<SmsLog[]> {
    const rows = await this.sql`select * from sms_log order by created_at desc limit ${limit}`;
    return rows.map(rowToSms);
  }
}
