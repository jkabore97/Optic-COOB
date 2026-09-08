import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { addDays, todayISO } from "@/lib/slots";
import { appointmentReminderSms, sendSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/reminders — envoie un SMS de rappel pour les rendez-vous du lendemain.
 * Protégé par CRON_SECRET (en-tête `Authorization: Bearer …`). Planifié via vercel.json,
 * ou par n'importe quel cron externe.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const store = getStore();
  const tomorrow = addDays(todayISO(), 1);
  const appts = (await store.listAppointments({ from: tomorrow, to: tomorrow })).filter(
    (a) => a.status === "confirmed" && !a.reminderSmsAt,
  );

  let sent = 0;
  for (const a of appts) {
    const res = await sendSms(a.phone, appointmentReminderSms(a), { relatedType: "appointment", relatedId: a.id });
    if (res.ok) {
      sent++;
      await store.updateAppointment(a.id, { reminderSmsAt: new Date().toISOString() });
    }
  }
  return NextResponse.json({ date: tomorrow, candidates: appts.length, sent });
}
