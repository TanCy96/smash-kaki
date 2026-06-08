import { describe, expect, it } from "vitest";
import { isWithinRecoveryWindow } from "./session-recovery";
import type { Session } from "./types";

const NOW = Date.parse("2026-06-10T00:00:00Z");

function session(overrides: Partial<Session>): Session {
  return {
    id: "s1",
    manage_token: "m",
    guest_token: "g",
    title: "Smash",
    starts_at: null,
    duration_min: null,
    location: "Court",
    court_numbers: null,
    notes: null,
    manager_id: null,
    status: "active",
    lifecycle: "draft",
    court_cost: null,
    shuttles_used: null,
    price_per_shuttle: null,
    created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("isWithinRecoveryWindow", () => {
  it("keeps draft polls with no fixed time", () => {
    expect(isWithinRecoveryWindow(session({ starts_at: null, duration_min: null }), NOW)).toBe(true);
  });

  it("keeps a session still in the future", () => {
    expect(
      isWithinRecoveryWindow(
        session({ starts_at: "2026-06-11T19:00:00Z", duration_min: 120, lifecycle: "finalized" }),
        NOW
      )
    ).toBe(true);
  });

  it("keeps a session that ended a few hours ago", () => {
    // ends 2026-06-09T22:00Z, i.e. 2h before NOW
    expect(
      isWithinRecoveryWindow(
        session({ starts_at: "2026-06-09T20:00:00Z", duration_min: 120, lifecycle: "finalized" }),
        NOW
      )
    ).toBe(true);
  });

  it("keeps a session ending exactly 24h ago (boundary inclusive)", () => {
    // ends 2026-06-09T00:00Z, exactly 24h before NOW
    expect(
      isWithinRecoveryWindow(
        session({ starts_at: "2026-06-08T22:00:00Z", duration_min: 120, lifecycle: "finalized" }),
        NOW
      )
    ).toBe(true);
  });

  it("hides a session that ended more than 24h ago", () => {
    // ends 2026-06-08T14:00Z, ~34h before NOW
    expect(
      isWithinRecoveryWindow(
        session({ starts_at: "2026-06-08T12:00:00Z", duration_min: 120, lifecycle: "finalized" }),
        NOW
      )
    ).toBe(false);
  });
});
