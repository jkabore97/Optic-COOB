import postgres, { type Sql } from "postgres";
import { newId } from "../ids";
import { rowToFrame } from "./frame-rows";
import { PG_SCHEMA } from "./schema";
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

/** Stockage PostgreSQL (Supabase, Neon…). Le schéma est créé automatiquement au premier accès. */
export class PgStore implements Store {
  private readonly sql: Sql;
  private schemaReady: Promise<void> | null = null;

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

  /** Crée les tables manquantes (instructions idempotentes), une fois par processus. */
  ready(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.sql
        .unsafe(PG_SCHEMA)
        .then(() => undefined)
        .catch((err) => {
          this.schemaReady = null;
          throw err;
        });
    }
    return this.schemaReady;
  }

  // ---- Rendez-vous ----

  async createAppointment(input: NewAppointment): Promise<Appointment> {
    await this.ready();
    const id = newId();
    const [row] = await this.sql`
      insert into appointments (id, code, name, phone, agency, date, time, reason, notes, status)
      values (${id}, ${input.code}, ${input.name}, ${input.phone}, ${input.agency}, ${input.date}, ${input.time},
              ${input.reason}, ${input.notes}, 'confirmed')
      returning *`;
    return rowToAppointment(row);
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    await this.ready();
    const [row] = await this.sql`select * from appointments where id = ${id}`;
    return row ? rowToAppointment(row) : null;
  }

  async listAppointments(opts: { from?: string; to?: string }): Promise<Appointment[]> {
    await this.ready();
    const rows = await this.sql`
      select * from appointments
      where (${opts.from ?? null}::date is null or date >= ${opts.from ?? null}::date)
        and (${opts.to ?? null}::date is null or date <= ${opts.to ?? null}::date)
      order by date, time`;
    return rows.map(rowToAppointment);
  }

  async bookedTimes(date: string, agency: string): Promise<string[]> {
    await this.ready();
    const rows = await this.sql`
      select time from appointments
      where date = ${date}::date and agency = ${agency} and status <> 'cancelled'`;
    return rows.map((r) => String(r.time));
  }

  async updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "status" | "confirmationSmsAt" | "reminderSmsAt">>,
  ): Promise<Appointment | null> {
    await this.ready();
    const [row] = await this.sql`
      update appointments set
        status = coalesce(${patch.status ?? null}, status),
        confirmation_sms_at = coalesce(${patch.confirmationSmsAt ?? null}::timestamptz, confirmation_sms_at),
        reminder_sms_at = coalesce(${patch.reminderSmsAt ?? null}::timestamptz, reminder_sms_at)
      where id = ${id} returning *`;
    return row ? rowToAppointment(row) : null;
  }

  // ---- Commandes ----

  async createOrder(input: NewOrder): Promise<Order> {
    await this.ready();
    const id = newId();
    const [row] = await this.sql`
      insert into orders (id, code, customer_name, phone, agency, frame, lenses, notes, total_fcfa, paid_fcfa, status)
      values (${id}, ${input.code}, ${input.customerName}, ${input.phone}, ${input.agency}, ${input.frame}, ${input.lenses},
              ${input.notes}, ${input.totalFcfa}, ${input.paidFcfa}, 'received')
      returning *`;
    return rowToOrder(row);
  }

  async getOrder(id: string): Promise<Order | null> {
    await this.ready();
    const [row] = await this.sql`select * from orders where id = ${id}`;
    return row ? rowToOrder(row) : null;
  }

  async findOrder(code: string, phone: string): Promise<Order | null> {
    await this.ready();
    const [row] = await this.sql`
      select * from orders where code = ${code.trim().toUpperCase()} and phone = ${phone}`;
    return row ? rowToOrder(row) : null;
  }

  async listOrders(opts: { status?: OrderStatus | "active" }): Promise<Order[]> {
    await this.ready();
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
    await this.ready();
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

  // ---- SMS ----

  async logSms(entry: Omit<SmsLog, "id" | "createdAt">): Promise<SmsLog> {
    await this.ready();
    const id = newId();
    const [row] = await this.sql`
      insert into sms_log (id, "to", body, provider, status, provider_id, error, related_type, related_id)
      values (${id}, ${entry.to}, ${entry.body}, ${entry.provider}, ${entry.status},
              ${entry.providerId}, ${entry.error}, ${entry.relatedType}, ${entry.relatedId})
      returning *`;
    return rowToSms(row);
  }

  async listSms(limit = 50): Promise<SmsLog[]> {
    await this.ready();
    const rows = await this.sql`select * from sms_log order by created_at desc limit ${limit}`;
    return rows.map(rowToSms);
  }

  // ---- Catalogue ----

  async listFrames(opts: { includeInactive?: boolean } = {}): Promise<CatalogFrameRecord[]> {
    await this.ready();
    const rows = opts.includeInactive
      ? await this.sql`select * from frames order by sort_order, created_at`
      : await this.sql`select * from frames where active order by sort_order, created_at`;
    return rows.map(rowToFrame);
  }

  async getFrame(id: string): Promise<CatalogFrameRecord | null> {
    await this.ready();
    const [row] = await this.sql`select * from frames where id = ${id}`;
    return row ? rowToFrame(row) : null;
  }

  async getFrameBySlug(slug: string): Promise<CatalogFrameRecord | null> {
    await this.ready();
    const [row] = await this.sql`select * from frames where slug = ${slug}`;
    return row ? rowToFrame(row) : null;
  }

  async createFrame(input: CatalogFrameInput, image: ImageInput): Promise<CatalogFrameRecord> {
    await this.ready();
    const id = newId();
    const imageBuf = image ? Buffer.from(image.bytes) : null;
    const [row] = await this.sql`
      insert into frames (id, slug, name, collection, shape, material, color, gender, price_fcfa,
        size_lens, size_bridge, size_temple, description, tags, image, image_mime, image_width, image_height,
        anchor_lx, anchor_ly, anchor_rx, anchor_ry, active, sort_order)
      values (${id}, ${input.slug}, ${input.name}, ${input.collection}, ${input.shape}, ${input.material},
        ${input.color}, ${input.gender}, ${input.priceFcfa}, ${input.sizeLens}, ${input.sizeBridge}, ${input.sizeTemple},
        ${input.description}, ${input.tags.join(",")}, ${imageBuf}, ${image?.mime ?? null},
        ${input.imageWidth}, ${input.imageHeight}, ${input.anchorLx}, ${input.anchorLy}, ${input.anchorRx}, ${input.anchorRy},
        ${input.active}, ${input.sortOrder})
      returning *`;
    return rowToFrame(row);
  }

  async updateFrame(id: string, patch: Partial<CatalogFrameInput>, image?: ImageInput): Promise<CatalogFrameRecord | null> {
    await this.ready();
    const imageBuf = image ? Buffer.from(image.bytes) : null;
    const tags = patch.tags ? patch.tags.join(",") : null;
    const [row] = await this.sql`
      update frames set
        slug = coalesce(${patch.slug ?? null}, slug),
        name = coalesce(${patch.name ?? null}, name),
        collection = coalesce(${patch.collection ?? null}, collection),
        shape = coalesce(${patch.shape ?? null}, shape),
        material = coalesce(${patch.material ?? null}, material),
        color = coalesce(${patch.color ?? null}, color),
        gender = coalesce(${patch.gender ?? null}, gender),
        price_fcfa = coalesce(${patch.priceFcfa ?? null}, price_fcfa),
        size_lens = coalesce(${patch.sizeLens ?? null}, size_lens),
        size_bridge = coalesce(${patch.sizeBridge ?? null}, size_bridge),
        size_temple = coalesce(${patch.sizeTemple ?? null}, size_temple),
        description = coalesce(${patch.description ?? null}, description),
        tags = coalesce(${tags}, tags),
        image = coalesce(${imageBuf}, image),
        image_mime = coalesce(${image?.mime ?? null}, image_mime),
        image_width = coalesce(${patch.imageWidth ?? null}, image_width),
        image_height = coalesce(${patch.imageHeight ?? null}, image_height),
        anchor_lx = coalesce(${patch.anchorLx ?? null}, anchor_lx),
        anchor_ly = coalesce(${patch.anchorLy ?? null}, anchor_ly),
        anchor_rx = coalesce(${patch.anchorRx ?? null}, anchor_rx),
        anchor_ry = coalesce(${patch.anchorRy ?? null}, anchor_ry),
        active = coalesce(${patch.active ?? null}, active),
        sort_order = coalesce(${patch.sortOrder ?? null}, sort_order),
        updated_at = now()
      where id = ${id} returning *`;
    return row ? rowToFrame(row) : null;
  }

  async deleteFrame(id: string): Promise<boolean> {
    await this.ready();
    const rows = await this.sql`delete from frames where id = ${id} returning id`;
    return rows.length > 0;
  }

  async getFrameImage(id: string): Promise<FrameImageBlob | null> {
    await this.ready();
    const [row] = await this.sql`select image, image_mime, updated_at from frames where id = ${id}`;
    if (!row || !row.image || !row.image_mime) return null;
    return { mime: String(row.image_mime), bytes: row.image as Uint8Array, updatedAt: iso(row.updated_at)! };
  }
}
