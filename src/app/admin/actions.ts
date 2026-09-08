"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkPassword, clearAdminCookie, requireAdmin, setAdminCookie } from "@/lib/auth";
import { AGENCIES, MAIN_AGENCY } from "@/lib/config";
import { ORDER_STATUS_FLOW, getStore, type AppointmentStatus, type OrderStatus } from "@/lib/db";
import { orderCode } from "@/lib/ids";
import { normalizeBurkinaPhone } from "@/lib/phone";
import { orderReadySms, orderReceivedSms, sendSms } from "@/lib/sms";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function loginAction(_prev: { error?: string } | undefined, fd: FormData) {
  const password = str(fd, "password");
  if (!checkPassword(password)) {
    return { error: "Mot de passe incorrect." };
  }
  await setAdminCookie();
  redirect("/admin");
}

export async function logoutAction() {
  await clearAdminCookie();
  redirect("/admin/login");
}

const NewOrderSchema = z.object({
  customerName: z.string().min(2).max(80),
  phone: z.string().min(8),
  agency: z.enum(AGENCIES.map((a) => a.id) as [string, ...string[]]).default(MAIN_AGENCY.id),
  frame: z.string().max(120).default(""),
  lenses: z.string().max(200).default(""),
  notes: z.string().max(500).default(""),
  totalFcfa: z.coerce.number().int().nonnegative().optional(),
  paidFcfa: z.coerce.number().int().nonnegative().optional(),
  notify: z.string().optional(),
});

export async function createOrderAction(_prev: { error?: string } | undefined, fd: FormData) {
  await requireAdmin();
  const parsed = NewOrderSchema.safeParse({
    customerName: str(fd, "customerName"),
    phone: str(fd, "phone"),
    agency: str(fd, "agency") || undefined,
    frame: str(fd, "frame"),
    lenses: str(fd, "lenses"),
    notes: str(fd, "notes"),
    totalFcfa: str(fd, "totalFcfa") || undefined,
    paidFcfa: str(fd, "paidFcfa") || undefined,
    notify: str(fd, "notify") || undefined,
  });
  if (!parsed.success) return { error: "Vérifiez les champs : nom (2 caractères min.) et téléphone sont obligatoires." };
  const phone = normalizeBurkinaPhone(parsed.data.phone);
  if (!phone) return { error: "Numéro de téléphone invalide (8 chiffres)." };

  const store = getStore();
  const order = await store.createOrder({
    code: orderCode(),
    customerName: parsed.data.customerName,
    phone,
    agency: parsed.data.agency,
    frame: parsed.data.frame,
    lenses: parsed.data.lenses,
    notes: parsed.data.notes,
    totalFcfa: parsed.data.totalFcfa ?? null,
    paidFcfa: parsed.data.paidFcfa ?? null,
  });
  if (parsed.data.notify) {
    await sendSms(phone, orderReceivedSms(order), { relatedType: "order", relatedId: order.id });
  }
  revalidatePath("/admin");
  revalidatePath("/admin/commandes");
  redirect(`/admin/commandes?ok=${encodeURIComponent(order.code)}`);
}

/** Fait avancer (ou reculer) une commande vers un statut. "ready" déclenche le SMS. */
export async function setOrderStatusAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const status = str(fd, "status") as OrderStatus;
  if (!id || !ORDER_STATUS_FLOW.includes(status)) return;

  const store = getStore();
  const order = await store.getOrder(id);
  if (!order) return;

  const now = new Date().toISOString();
  const patch: Parameters<typeof store.updateOrder>[1] = { status };
  if (status === "ready" && !order.readyAt) patch.readyAt = now;
  if (status === "collected") patch.collectedAt = now;
  const updated = await store.updateOrder(id, patch);

  if (updated && status === "ready" && !order.readySmsAt) {
    const res = await sendSms(updated.phone, orderReadySms(updated), { relatedType: "order", relatedId: updated.id });
    if (res.ok) await store.updateOrder(id, { readySmsAt: now });
  }
  revalidatePath("/admin");
  revalidatePath("/admin/commandes");
}

/** Renvoie le SMS "lunettes prêtes" (ex. après un échec d'envoi). */
export async function resendReadySmsAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const store = getStore();
  const order = await store.getOrder(id);
  if (!order) return;
  const res = await sendSms(order.phone, orderReadySms(order), { relatedType: "order", relatedId: order.id });
  if (res.ok) await store.updateOrder(id, { readySmsAt: new Date().toISOString() });
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/sms");
}

export async function setAppointmentStatusAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const status = str(fd, "status") as AppointmentStatus;
  if (!id || !["confirmed", "cancelled", "done"].includes(status)) return;
  await getStore().updateAppointment(id, { status });
  revalidatePath("/admin");
  revalidatePath("/admin/rendez-vous");
}
