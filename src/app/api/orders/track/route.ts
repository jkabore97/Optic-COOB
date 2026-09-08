import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgency } from "@/lib/config";
import { ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, getStore } from "@/lib/db";
import { normalizeBurkinaPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const Body = z.object({
  code: z.string().trim().min(4),
  phone: z.string().trim().min(8),
});

/** POST /api/orders/track { code, phone } → état de la commande (sans données sensibles). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Indiquez la référence et le numéro de téléphone." }, { status: 400 });
  }
  const phone = normalizeBurkinaPhone(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Numéro de téléphone invalide." }, { status: 400 });
  }
  const order = await getStore().findOrder(parsed.data.code, phone);
  if (!order) {
    return NextResponse.json(
      { error: "Aucune commande trouvée avec cette référence et ce numéro. Vérifiez le SMS reçu ou appelez-nous." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    code: order.code,
    customerName: order.customerName,
    agency: getAgency(order.agency),
    frame: order.frame,
    lenses: order.lenses,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    stepIndex: ORDER_STATUS_FLOW.indexOf(order.status),
    steps: ORDER_STATUS_FLOW.map((s) => ORDER_STATUS_LABELS[s]),
    createdAt: order.createdAt,
    readyAt: order.readyAt,
    collectedAt: order.collectedAt,
  });
}
