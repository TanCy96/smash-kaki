import { describe, expect, it } from "vitest";
import {
  malaysiaDateTimeLocalToIso,
  resolvePollVoter,
  selectedOptionIds,
} from "./time-poll";
import type { PollVoteIdentity } from "./time-poll";

const vote = (over: Partial<PollVoteIdentity>): PollVoteIdentity => ({
  id: "x",
  name: "Alex",
  participantToken: "dev1",
  playerId: null,
  ...over,
});

describe("resolvePollVoter", () => {
  it("matches a logged-in player to their existing poll voter", () => {
    const existing = [vote({ id: "1", playerId: "player-7" })];

    const r = resolvePollVoter({
      loggedInPlayerId: "player-7",
      deviceToken: null,
      name: "Alex",
      existing,
    });

    expect(r).toEqual({ kind: "logged-in", voterId: "1" });
  });

  it("matches a returning device token", () => {
    const existing = [vote({ id: "2", participantToken: "dev-abc" })];

    const r = resolvePollVoter({
      loggedInPlayerId: null,
      deviceToken: "dev-abc",
      name: "Sam",
      existing,
    });

    expect(r).toEqual({ kind: "device", voterId: "2" });
  });

  it("matches a duplicate name case-insensitively when no login or token matches", () => {
    const existing = [vote({ id: "3", name: "Alex" })];

    const r = resolvePollVoter({
      loggedInPlayerId: null,
      deviceToken: "new-dev",
      name: " alex ",
      existing,
    });

    expect(r).toEqual({ kind: "duplicate-name", voterId: "3" });
  });

  it("treats the voter as new when nothing matches", () => {
    const r = resolvePollVoter({
      loggedInPlayerId: null,
      deviceToken: "new-dev",
      name: "Jo",
      existing: [],
    });

    expect(r).toEqual({ kind: "new" });
  });

  it("prefers logged-in player over device token and duplicate name", () => {
    const existing = [
      vote({ id: "4", playerId: "player-7", name: "Taylor" }),
      vote({ id: "5", participantToken: "dev-x", name: "Alex" }),
      vote({ id: "6", name: "Alex" }),
    ];

    const r = resolvePollVoter({
      loggedInPlayerId: "player-7",
      deviceToken: "dev-x",
      name: "alex",
      existing,
    });

    expect(r).toEqual({ kind: "logged-in", voterId: "4" });
  });
});

describe("selectedOptionIds", () => {
  it("keeps only valid option ids and deduplicates selections", () => {
    const r = selectedOptionIds(
      ["opt-1", "invalid", "opt-2", "opt-1", "opt-3"],
      ["opt-1", "opt-2"]
    );

    expect(r).toEqual(["opt-1", "opt-2"]);
  });

  it("allows clearing all choices", () => {
    expect(selectedOptionIds([], ["opt-1", "opt-2"])).toEqual([]);
    expect(selectedOptionIds(["invalid"], ["opt-1", "opt-2"])).toEqual([]);
  });
});

describe("malaysiaDateTimeLocalToIso", () => {
  it("parses datetime-local input as Malaysia local time", () => {
    expect(malaysiaDateTimeLocalToIso("2026-06-03T20:30")).toBe(
      "2026-06-03T12:30:00.000Z"
    );
  });
});
