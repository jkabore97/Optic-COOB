import { describe, expect, it } from "vitest";
import type { Appointment, Order } from "../src/lib/db/types";
import { appointmentConfirmationSms, appointmentReminderSms, orderReadySms, orderReceivedSms } from "../src/lib/sms/templates";

const appt: Appointment = {
  id: "a1", code: "RDV-4T7PQ", name: "Awa", phone: "+22670123456", agency: "koulouba", date: "2026-09-14", time: "10:30",
  reason: "examen", notes: "", status: "confirmed", createdAt: "", confirmationSmsAt: null, reminderSmsAt: null,
};
const order: Order = {
  id: "o1", code: "COOB-7KX4M", customerName: "Awa", phone: "+22670123456", agency: "gounghin", frame: "Kadiogo Noir", lenses: "",
  notes: "", totalFcfa: null, paidFcfa: null, status: "ready", createdAt: "", updatedAt: "", readyAt: null,
  collectedAt: null, readySmsAt: null,
};

/** Un SMS GSM-7 tient en 160 caractères ; on tolère 2 segments max. */
const isGsm7 = (s: string) => /^[\x20-\x7E\n]*$/.test(s);

describe("modèles de SMS", () => {
  it("restent en GSM-7 (sans accents) et courts", () => {
    for (const body of [appointmentConfirmationSms(appt), appointmentReminderSms(appt), orderReadySms(order), orderReceivedSms(order)]) {
      expect(isGsm7(body), body).toBe(true);
      expect(body.length).toBeLessThanOrEqual(306);
    }
  });
  it("contiennent la référence et la date", () => {
    expect(appointmentConfirmationSms(appt)).toContain("RDV-4T7PQ");
    expect(appointmentConfirmationSms(appt)).toContain("14/09/2026");
    expect(appointmentConfirmationSms(appt)).toContain("10:30");
    expect(orderReadySms(order)).toContain("COOB-7KX4M");
    expect(orderReadySms(order)).toContain("pretes");
    expect(orderReadySms(order)).toContain("Gounghin");
  });
});
