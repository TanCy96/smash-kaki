import { describe, expect, it } from "vitest";
import {
  formatMalaysiaDateTime,
  formatMalaysiaDateTimeLocalInput,
} from "./datetime";

describe("formatMalaysiaDateTime", () => {
  it("formats ISO timestamps in Malaysia time with the weekday", () => {
    expect(formatMalaysiaDateTime("2026-06-03T12:30:00.000Z")).toBe(
      "Wednesday, 3 Jun 2026, 8:30 pm"
    );
  });

  it("names weekend days", () => {
    expect(formatMalaysiaDateTime("2026-06-06T12:30:00.000Z")).toBe(
      "Saturday, 6 Jun 2026, 8:30 pm"
    );
  });
});

describe("formatMalaysiaDateTimeLocalInput", () => {
  it("formats ISO timestamps as Malaysia-local datetime input values", () => {
    expect(formatMalaysiaDateTimeLocalInput("2026-06-03T12:30:00.000Z")).toBe(
      "2026-06-03T20:30"
    );
  });
});
