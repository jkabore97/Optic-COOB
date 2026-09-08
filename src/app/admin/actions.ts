"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkPassword, clearAdminCookie, requireAdmin, setAdminCookie } from "@/lib/auth";
import { AGENCIES, MAIN_AGENCY } from "@/lib/config";
import { ORDER_STATUS_FLOW, getStore, type AppointmentStatus, type OrderStatus } from "@/lib/db";
import { COLOR_LABELS, GENDER_LABELS, MATERIAL_LABELS, SHAPE_LABELS, type FrameColor } from "@/lib/frames";
import { orderCode } from "@/lib/ids";
import { slugify } from "@/lib/slug";
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

// ---- Catalogue de montures ----

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Limite des fonctions Vercel (4,5 Mo par requête, base64 compris). */
const MAX_MODEL_BYTES = 3 * 1024 * 1024;

const FrameSchema = z.object({
  id: z.string().optional().default(""),
  name: z.string().min(2).max(120),
  collection: z.string().max(80).default(""),
  shape: z.enum(Object.keys(SHAPE_LABELS) as [string, ...string[]]),
  material: z.enum(Object.keys(MATERIAL_LABELS) as [string, ...string[]]),
  color: z.enum(Object.keys(COLOR_LABELS) as [string, ...string[]]),
  gender: z.enum(Object.keys(GENDER_LABELS) as [string, ...string[]]),
  priceFcfa: z.coerce.number().int().nonnegative(),
  sizeLens: z.coerce.number().int().nonnegative().default(0),
  sizeBridge: z.coerce.number().int().nonnegative().default(0),
  sizeTemple: z.coerce.number().int().nonnegative().default(0),
  description: z.string().max(1000).default(""),
  tags: z.string().max(200).default(""),
  sortOrder: z.coerce.number().int().default(0),
  active: z.string().optional(),
  imageData: z.string().default(""),
  imageWidth: z.coerce.number().int().nonnegative().default(0),
  imageHeight: z.coerce.number().int().nonnegative().default(0),
  anchorLx: z.coerce.number().default(0),
  anchorLy: z.coerce.number().default(0),
  anchorRx: z.coerce.number().default(0),
  anchorRy: z.coerce.number().default(0),
  modelData: z.string().default(""),
  removeModel: z.string().optional(),
  modelRotation: z.string().default("0,0,0"),
});

function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], bytes: new Uint8Array(Buffer.from(m[2], "base64")) };
}

/** Décode un GLB envoyé en data URL (le navigateur peut l'étiqueter en octet-stream). */
function decodeModelDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;]*);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
  // Signature GLB : "glTF" en tête de fichier
  if (bytes.length < 12 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "glTF") return null;
  return { mime: "model/gltf-binary", bytes };
}

async function uniqueSlug(base: string, ownId: string | null): Promise<string> {
  const store = getStore();
  let slug = base || "monture";
  for (let i = 2; i < 100; i++) {
    const existing = await store.getFrameBySlug(slug);
    if (!existing || existing.id === ownId) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function saveFrameAction(_prev: { error?: string } | undefined, fd: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(
    [...fd.entries()].filter(([, v]) => typeof v === "string").map(([k, v]) => [k, (v as string).trim()]),
  );
  const parsed = FrameSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: `Vérifiez le formulaire : ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}` };
  }
  const d = parsed.data;
  const image = d.imageData ? decodeDataUrl(d.imageData) : null;
  if (d.imageData && !image) return { error: "Format d'image non pris en charge (PNG, JPEG ou WebP)." };
  if (image && image.bytes.byteLength > MAX_IMAGE_BYTES) return { error: "Photo trop lourde (4 Mo maximum)." };
  if (!d.id && !image) return { error: "Ajoutez une photo de la monture." };
  const model = d.modelData ? decodeModelDataUrl(d.modelData) : null;
  if (d.modelData && !model) return { error: "Le modèle 3D doit être un fichier .glb (glTF binaire)." };
  if (model && model.bytes.byteLength > MAX_MODEL_BYTES) return { error: "Modèle 3D trop lourd (3 Mo maximum). Compressez-le avec gltf-transform ou Blender." };
  if (d.imageWidth && (d.anchorLx === d.anchorRx && d.anchorLy === d.anchorRy)) {
    return { error: "Calibrez les deux centres de verres sur la photo." };
  }

  const store = getStore();
  const slug = await uniqueSlug(slugify(`${d.name} ${COLOR_LABELS[d.color as FrameColor] ?? d.color}`), d.id || null);
  const input = {
    slug,
    name: d.name,
    collection: d.collection,
    shape: d.shape,
    material: d.material,
    color: d.color,
    gender: d.gender,
    priceFcfa: d.priceFcfa,
    sizeLens: d.sizeLens,
    sizeBridge: d.sizeBridge,
    sizeTemple: d.sizeTemple,
    description: d.description,
    tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
    imageWidth: d.imageWidth,
    imageHeight: d.imageHeight,
    anchorLx: d.anchorLx,
    anchorLy: d.anchorLy,
    anchorRx: d.anchorRx,
    anchorRy: d.anchorRy,
    active: d.active === "1",
    sortOrder: d.sortOrder,
  };

  let message: string;
  let frameId: string;
  if (d.id) {
    const updated = await store.updateFrame(d.id, input, image);
    if (!updated) return { error: "Monture introuvable." };
    frameId = updated.id;
    message = `« ${updated.name} » mise à jour.`;
  } else {
    const created = await store.createFrame(input, image);
    frameId = created.id;
    message = `« ${created.name} » ajoutée au catalogue.`;
  }
  if (model) await store.setFrameModel(frameId, model);
  else if (d.removeModel === "1") await store.deleteFrameModel(frameId);
  if (d.removeModel !== "1") {
    const rot = d.modelRotation.split(",").map(Number);
    if (rot.length === 3 && rot.every(Number.isFinite)) await store.setFrameModelRotation(frameId, [rot[0], rot[1], rot[2]]);
  }
  revalidatePath("/");
  revalidatePath("/montures");
  revalidatePath("/essayage");
  redirect(`/admin/montures?ok=${encodeURIComponent(message)}`);
}

export async function deleteFrameAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  if (id) await getStore().deleteFrame(id);
  revalidatePath("/");
  revalidatePath("/montures");
  revalidatePath("/admin/montures");
}

export async function toggleFrameActiveAction(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const active = str(fd, "active") === "1";
  if (id) await getStore().updateFrame(id, { active });
  revalidatePath("/");
  revalidatePath("/montures");
  revalidatePath("/admin/montures");
}
