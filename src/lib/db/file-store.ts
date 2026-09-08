import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
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

interface FileData {
  appointments: Appointment[];
  orders: Order[];
  sms: SmsLog[];
}

const EMPTY: FileData = { appointments: [], orders: [], sms: [] };

/**
 * Stockage JSON sur disque, pour le développement local et les petites installations
 * sur un serveur unique. En production sur Vercel (système de fichiers éphémère),
 * utilisez DATABASE_URL → PgStore.
 */
export class FileStore implements Store {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async read(): Promise<FileData> {
    try {
      const raw = await readFile(this.file, "utf8");
      return { ...EMPTY, ...(JSON.parse(raw) as Partial<FileData>) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY };
      throw err;
    }
  }

  private async write(data: FileData): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await rename(tmp, this.file);
  }

  /** Sérialise les écritures pour éviter les pertes de mise à jour concurrentes. */
  private mutate<T>(fn: (data: FileData) => T): Promise<T> {
    const run = async () => {
      const data = await this.read();
      const result = fn(data);
      await this.write(data);
      return result;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async createAppointment(input: NewAppointment): Promise<Appointment> {
    return this.mutate((data) => {
      const appt: Appointment = {
        ...input,
        id: newId(),
        status: "confirmed",
        createdAt: new Date().toISOString(),
        confirmationSmsAt: null,
        reminderSmsAt: null,
      };
      data.appointments.push(appt);
      return appt;
    });
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    const data = await this.read();
    return data.appointments.find((a) => a.id === id) ?? null;
  }

  async listAppointments(opts: { from?: string; to?: string }): Promise<Appointment[]> {
    const data = await this.read();
    return data.appointments
      .filter((a) => (!opts.from || a.date >= opts.from) && (!opts.to || a.date <= opts.to))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }

  async bookedTimes(date: string, agency: string): Promise<string[]> {
    const data = await this.read();
    return data.appointments
      .filter((a) => a.date === date && a.agency === agency && a.status !== "cancelled")
      .map((a) => a.time);
  }

  async updateAppointment(
    id: string,
    patch: Partial<Pick<Appointment, "status" | "confirmationSmsAt" | "reminderSmsAt">>,
  ): Promise<Appointment | null> {
    return this.mutate((data) => {
      const appt = data.appointments.find((a) => a.id === id);
      if (!appt) return null;
      Object.assign(appt, patch);
      return appt;
    });
  }

  async createOrder(input: NewOrder): Promise<Order> {
    return this.mutate((data) => {
      const now = new Date().toISOString();
      const order: Order = {
        ...input,
        id: newId(),
        status: "received",
        createdAt: now,
        updatedAt: now,
        readyAt: null,
        collectedAt: null,
        readySmsAt: null,
      };
      data.orders.push(order);
      return order;
    });
  }

  async getOrder(id: string): Promise<Order | null> {
    const data = await this.read();
    return data.orders.find((o) => o.id === id) ?? null;
  }

  async findOrder(code: string, phone: string): Promise<Order | null> {
    const data = await this.read();
    const c = code.trim().toUpperCase();
    return data.orders.find((o) => o.code === c && o.phone === phone) ?? null;
  }

  async listOrders(opts: { status?: OrderStatus | "active" }): Promise<Order[]> {
    const data = await this.read();
    return data.orders
      .filter((o) => {
        if (!opts.status) return true;
        if (opts.status === "active") return o.status !== "collected";
        return o.status === opts.status;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateOrder(
    id: string,
    patch: Partial<Pick<Order, "status" | "readyAt" | "collectedAt" | "readySmsAt" | "notes">>,
  ): Promise<Order | null> {
    return this.mutate((data) => {
      const order = data.orders.find((o) => o.id === id);
      if (!order) return null;
      Object.assign(order, patch, { updatedAt: new Date().toISOString() });
      return order;
    });
  }

  async logSms(entry: Omit<SmsLog, "id" | "createdAt">): Promise<SmsLog> {
    return this.mutate((data) => {
      const log: SmsLog = { ...entry, id: newId(), createdAt: new Date().toISOString() };
      data.sms.push(log);
      if (data.sms.length > 2000) data.sms.splice(0, data.sms.length - 2000);
      return log;
    });
  }

  async listSms(limit = 50): Promise<SmsLog[]> {
    const data = await this.read();
    return data.sms.slice(-limit).reverse();
  }
}
