import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FileStore } from "../src/lib/db/file-store";

const dir = mkdtempSync(path.join(tmpdir(), "coob-"));
const store = new FileStore(path.join(dir, "store.json"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("FileStore", () => {
  it("crée et retrouve une commande", async () => {
    const o = await store.createOrder({
      code: "COOB-TEST1", customerName: "Awa", phone: "+22670123456", agency: "koulouba", frame: "Kadiogo", lenses: "", notes: "", totalFcfa: 25000, paidFcfa: 10000,
    });
    expect(o.status).toBe("received");
    expect(await store.findOrder("coob-test1", "+22670123456")).toMatchObject({ id: o.id });
    expect(await store.findOrder("COOB-TEST1", "+22670000000")).toBeNull();
    const updated = await store.updateOrder(o.id, { status: "ready", readyAt: "2026-09-14T10:00:00.000Z" });
    expect(updated?.status).toBe("ready");
    expect((await store.listOrders({ status: "active" })).length).toBe(1);
    await store.updateOrder(o.id, { status: "collected" });
    expect((await store.listOrders({ status: "active" })).length).toBe(0);
  });

  it("gère les rendez-vous et les créneaux pris", async () => {
    const a = await store.createAppointment({ code: "RDV-TEST1", name: "Awa", phone: "+22670123456", agency: "koulouba", date: "2026-09-14", time: "10:00", reason: "examen", notes: "" });
    expect(await store.bookedTimes("2026-09-14", "koulouba")).toEqual(["10:00"]);
    expect(await store.bookedTimes("2026-09-14", "gounghin")).toEqual([]);
    await store.updateAppointment(a.id, { status: "cancelled" });
    expect(await store.bookedTimes("2026-09-14", "koulouba")).toEqual([]);
  });

  it("sérialise les écritures concurrentes", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.logSms({ to: "+22670123456", body: `msg ${i}`, provider: "console", status: "sent", providerId: null, error: null, relatedType: null, relatedId: null }),
      ),
    );
    expect((await store.listSms(100)).length).toBe(10);
  });
});
