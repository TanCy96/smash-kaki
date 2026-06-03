import { describe, expect, it } from "vitest";
import { formatMalaysiaDateTime } from "./datetime";

describe("formatMalaysiaDateTime", () => {
  it("formats ISO timestamps in Malaysia time", () => {
    expect(formatMalaysiaDateTime("2026-06-03T12:30:00.000Z")).toBe(
      "3 Jun 2026, 8:30 pm"
    );
  });
});
