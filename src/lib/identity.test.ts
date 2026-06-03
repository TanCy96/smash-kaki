import { describe, expect, it } from "vitest";
import { resolveIdentity } from "./identity";
import type { Participant } from "./types";

const p = (over: Partial<Participant>): Participant => ({
  id: "x",
  session_id: "s",
  name: "Alex",
  rsvp: "going",
  attended: false,
  participant_token: "dev1",
  player_id: null,
  created_at: "",
  ...over,
});

describe("resolveIdentity", () => {
  it("matches a logged-in player to their existing participant row", () => {
    const existing = [p({ id: "1", player_id: "player-7" })];
    const r = resolveIdentity({
      loggedInPlayerId: "player-7",
      deviceToken: null,
      name: "Alex",
      existing,
    });
    expect(r).toEqual({ kind: "logged-in", participantId: "1" });
  });

  it("matches a returning device token", () => {
    const existing = [p({ id: "2", participant_token: "dev-abc" })];
    const r = resolveIdentity({
      loggedInPlayerId: null,
      deviceToken: "dev-abc",
      name: "Sam",
      existing,
    });
    expect(r).toEqual({ kind: "device", participantId: "2" });
  });

  it("warns on duplicate name (case-insensitive) when no token/login match", () => {
    const existing = [p({ id: "3", name: "Alex" })];
    const r = resolveIdentity({
      loggedInPlayerId: null,
      deviceToken: "new-dev",
      name: "alex",
      existing,
    });
    expect(r).toEqual({ kind: "duplicate-name", participantId: "3" });
  });

  it("treats as new when nothing matches", () => {
    const r = resolveIdentity({
      loggedInPlayerId: null,
      deviceToken: "new-dev",
      name: "Jo",
      existing: [],
    });
    expect(r).toEqual({ kind: "new" });
  });

  it("prefers login over device token", () => {
    const existing = [
      p({ id: "4", player_id: "player-7" }),
      p({ id: "5", participant_token: "dev-x" }),
    ];
    const r = resolveIdentity({
      loggedInPlayerId: "player-7",
      deviceToken: "dev-x",
      name: "Alex",
      existing,
    });
    expect(r).toEqual({ kind: "logged-in", participantId: "4" });
  });
});
