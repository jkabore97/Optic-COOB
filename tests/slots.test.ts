import { describe, expect, it } from "vitest";
import { addDays, allSlotsForDate, availableSlots, isValidISODate, todayISO, weekdayOf } from "../src/lib/slots";

// Lundi 14 septembre 2026
const MONDAY = "2026-09-14";
const SUNDAY = "2026-09-13";
const SATURDAY = "2026-09-19";

describe("slots", () => {
  it("valide les dates ISO", () => {
    expect(isValidISODate("2026-09-14")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("14/09/2026")).toBe(false);
  });

  it("connaît le jour de la semaine", () => {
    expect(weekdayOf(MONDAY)).toBe(1);
    expect(weekdayOf(SUNDAY)).toBe(0);
    expect(addDays(MONDAY, 5)).toBe(SATURDAY);
  });

  it("génère les créneaux selon les horaires", () => {
    const monday = allSlotsForDate(MONDAY);
    expect(monday[0]).toBe("08:00");
    expect(monday).toContain("12:00");
    expect(monday).not.toContain("12:30");
    expect(monday).not.toContain("14:30");
    expect(monday).toContain("15:00");
    expect(monday.at(-1)).toBe("17:30");
    expect(allSlotsForDate(SUNDAY)).toEqual([]);
    expect(allSlotsForDate(SATURDAY).at(-1)).toBe("12:30");
  });

  it("marque les créneaux réservés et passés", () => {
    const now = new Date("2026-09-14T09:05:00Z"); // 9h05 à Ouagadougou (UTC+0)
    const slots = availableSlots(MONDAY, ["10:00"], now);
    const byTime = Object.fromEntries(slots.map((s) => [s.time, s.available]));
    expect(byTime["08:00"]).toBe(false); // passé
    expect(byTime["09:30"]).toBe(false); // trop proche
    expect(byTime["10:00"]).toBe(false); // réservé
    expect(byTime["10:30"]).toBe(true);
    expect(byTime["15:00"]).toBe(true);
  });

  it("refuse les dates hors horizon", () => {
    const now = new Date("2026-09-14T09:00:00Z");
    expect(availableSlots("2026-09-13", [], now)).toEqual([]);
    expect(availableSlots("2026-12-01", [], now)).toEqual([]);
    expect(todayISO(now)).toBe(MONDAY);
  });
});
