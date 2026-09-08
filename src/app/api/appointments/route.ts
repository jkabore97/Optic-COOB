import { NextResponse } from "next/server";
import { z } from "zod";
import { AGENCIES, EXAM_REASONS } from "@/lib/config";
import { getStore } from "@/lib/db";
import { appointmentCode } from "@/lib/ids";
import { normalizeBurkinaPhone } from "@/lib/phone";
import { availableSlots, isValidISODate } from "@/lib/slots";
import { appointmentConfirmationSms, sendSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom").max(80),
  phone: z.string().trim().min(8, "Indiquez votre numéro"),
  agency: z.enum(AGENCIES.map((a) => a.id) as [string, ...string[]]),
  date: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide"),
  reason: z.enum(EXAM_REASONS.map((r) => r.value) as [string, ...string[]]),
  notes: z.string().trim().max(500).optional().default(""),
  /** Champ anti-spam : doit rester vide. */
  website: z.string().optional().default(""),
});

/** POST /api/appointments → crée un rendez-vous et envoie le SMS de confirmation. */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });
  }
  const input = parsed.data;
  if (input.website) {
    // Pot de miel : on répond comme si tout allait bien, sans rien enregistrer.
    return NextResponse.json({ ok: true, code: "RDV-XXXXX", date: input.date, time: input.time });
  }

  const phone = normalizeBurkinaPhone(input.phone);
  if (!phone) {
    return NextResponse.json({ error: "Numéro de téléphone invalide (8 chiffres, ex. 70 12 34 56)" }, { status: 400 });
  }
  if (!isValidISODate(input.date)) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const store = getStore();
  const booked = await store.bookedTimes(input.date, input.agency);
  const slot = availableSlots(input.date, booked).find((s) => s.time === input.time);
  if (!slot || !slot.available) {
    return NextResponse.json({ error: "Ce créneau n'est plus disponible. Choisissez-en un autre." }, { status: 409 });
  }

  const appt = await store.createAppointment({
    code: appointmentCode(),
    name: input.name,
    phone,
    agency: input.agency,
    date: input.date,
    time: input.time,
    reason: input.reason,
    notes: input.notes,
  });

  const sms = await sendSms(phone, appointmentConfirmationSms(appt), {
    relatedType: "appointment",
    relatedId: appt.id,
  });
  if (sms.ok) {
    await store.updateAppointment(appt.id, { confirmationSmsAt: new Date().toISOString() });
  }

  return NextResponse.json({
    ok: true,
    code: appt.code,
    agency: appt.agency,
    date: appt.date,
    time: appt.time,
    smsSent: sms.ok,
  });
}
