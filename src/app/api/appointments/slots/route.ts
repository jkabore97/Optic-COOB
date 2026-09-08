import { NextResponse } from "next/server";
import { getAgency } from "@/lib/config";
import { getStore } from "@/lib/db";
import { availableSlots, isValidISODate } from "@/lib/slots";

export const dynamic = "force-dynamic";

/** GET /api/appointments/slots?date=YYYY-MM-DD → créneaux du jour et disponibilité. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const date = params.get("date") ?? "";
  const agency = getAgency(params.get("agence"));
  if (!isValidISODate(date)) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  const booked = await getStore().bookedTimes(date, agency.id);
  return NextResponse.json({ date, agency: agency.id, slots: availableSlots(date, booked) });
}
