import { describe, expect, it } from "vitest";
import { defaultWeekendPollSlots, formatDateTimeLocal } from "./poll-defaults";

const SLOT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(09|16):00$/;

/** Parse the date portion of a datetime-local slot back into a local Date. */
function dateOf(slot: string): Date {
  const [, y, m, d] = SLOT_PATTERN.exec(slot)!;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

describe("formatDateTimeLocal", () => {
  it("zero-pads month, day, and hour to a datetime-local string", () => {
    const date = new Date(2026, 0, 3); // 3 Jan 2026
    expect(formatDateTimeLocal(date, 9)).toBe("2026-01-03T09:00");
    expect(formatDateTimeLocal(date, 16)).toBe("2026-01-03T16:00");
  });
});

describe("defaultWeekendPollSlots", () => {
  it("returns four slots: Sat 09:00, Sat 16:00, Sun 09:00, Sun 16:00", () => {
    const slots = defaultWeekendPollSlots(new Date(2026, 5, 3)); // a Wednesday
    expect(slots).toHaveLength(4);
    slots.forEach((slot) => expect(slot).toMatch(SLOT_PATTERN));

    // Two slots per day, same date within a day
    expect(dateOf(slots[0]).getTime()).toBe(dateOf(slots[1]).getTime());
    expect(dateOf(slots[2]).getTime()).toBe(dateOf(slots[3]).getTime());

    // Hours are 9am and 4pm
    expect(slots[0].endsWith("T09:00")).toBe(true);
    expect(slots[1].endsWith("T16:00")).toBe(true);
    expect(slots[2].endsWith("T09:00")).toBe(true);
    expect(slots[3].endsWith("T16:00")).toBe(true);
  });

  it("anchors to Saturday (day 6) and the following Sunday (day 0)", () => {
    const slots = defaultWeekendPollSlots(new Date(2026, 5, 3));
    const sat = dateOf(slots[0]);
    const sun = dateOf(slots[2]);
    expect(sat.getDay()).toBe(6);
    expect(sun.getDay()).toBe(0);
    // Sunday is the day after Saturday
    expect(sun.getTime() - sat.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("picks the upcoming Saturday on or after the base date", () => {
    const base = new Date(2026, 5, 3); // Wed 3 Jun 2026
    const sat = dateOf(defaultWeekendPollSlots(base)[0]);
    expect(sat.getTime()).toBeGreaterThanOrEqual(
      new Date(2026, 5, 3).getTime()
    );
    // within the next 7 days
    expect(sat.getTime() - base.getTime()).toBeLessThanOrEqual(
      7 * 24 * 60 * 60 * 1000
    );
  });

  it("uses the same day when the base date is already a Saturday", () => {
    const saturday = new Date(2026, 5, 6); // 6 Jun 2026 is a Saturday
    expect(saturday.getDay()).toBe(6); // guard the fixture
    const sat = dateOf(defaultWeekendPollSlots(saturday)[0]);
    expect(sat.getTime()).toBe(saturday.getTime());
  });
});
