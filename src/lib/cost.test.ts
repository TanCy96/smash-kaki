import { describe, expect, it } from "vitest";
import { computeCost } from "./cost";

describe("computeCost", () => {
  it("sums court cost and shuttle cost into total", () => {
    const r = computeCost({
      courtCost: 40,
      shuttlesUsed: 3,
      pricePerShuttle: 5,
      attendedCount: 4,
    });
    expect(r.total).toBe(55);
  });

  it("splits equally per attendee, rounded to 2 dp", () => {
    const r = computeCost({
      courtCost: 40,
      shuttlesUsed: 3,
      pricePerShuttle: 5,
      attendedCount: 4,
    });
    expect(r.perHead).toBe(13.75);
  });

  it("returns null perHead when nobody attended", () => {
    const r = computeCost({
      courtCost: 40,
      shuttlesUsed: 3,
      pricePerShuttle: 5,
      attendedCount: 0,
    });
    expect(r.perHead).toBeNull();
    expect(r.remainder).toBe(0);
  });

  it("reports the rounding remainder", () => {
    const r = computeCost({
      courtCost: 10,
      shuttlesUsed: 0,
      pricePerShuttle: 0,
      attendedCount: 3,
    });
    expect(r.perHead).toBe(3.33);
    expect(r.remainder).toBeCloseTo(0.01, 5);
  });

  it("treats missing cost components as zero", () => {
    const r = computeCost({
      courtCost: null,
      shuttlesUsed: null,
      pricePerShuttle: null,
      attendedCount: 2,
    });
    expect(r.total).toBe(0);
    expect(r.perHead).toBe(0);
  });
});
