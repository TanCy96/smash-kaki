import { beforeEach, describe, expect, it, vi } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: fromMock }),
}));

import { deleteSession, listSessionsJoinedBy, listSessionsManagedBy, listTimePollVoters, replaceTimeOptionVotes } from "./db";

function query(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    insert: vi.fn(() => result),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => result),
    order: vi.fn(() => result),
  };

  return chain;
}

describe("listTimePollVoters", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns canonical poll voter identities", async () => {
    fromMock.mockReturnValue(
      query({
        data: [
          {
            id: "vote-1",
            name: "Alex",
            participant_token: "device-1",
            player_id: null,
          },
        ],
        error: null,
      })
    );

    await expect(listTimePollVoters("session-1")).resolves.toEqual([
      {
        id: "vote-1",
        name: "Alex",
        participantToken: "device-1",
        playerId: null,
      },
    ]);
  });
});

describe("replaceTimeOptionVotes", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("deduplicates selected option ids before validating and inserting", async () => {
    const optionQuery = query({
      data: [{ id: "option-1" }, { id: "option-2" }],
      error: null,
    });
    const voteQuery = query({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "session_time_options") return optionQuery;
      if (table === "time_option_votes") return voteQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    await replaceTimeOptionVotes({
      session_id: "session-1",
      name: "Alex",
      participant_token: "device-1",
      player_id: null,
      previous_identity: null,
      session_time_option_ids: ["option-1", "option-1", "option-2"],
    });

    expect(optionQuery.in).toHaveBeenCalledWith("id", [
      "option-1",
      "option-2",
    ]);
    expect(voteQuery.insert).toHaveBeenCalledWith([
      {
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Alex",
        participant_token: "device-1",
        player_id: null,
      },
      {
        session_id: "session-1",
        session_time_option_id: "option-2",
        name: "Alex",
        participant_token: "device-1",
        player_id: null,
      },
    ]);
  });

  it("throws on invalid option ids before deleting existing votes", async () => {
    const optionQuery = query({
      data: [{ id: "option-1" }],
      error: null,
    });
    const deleteQuery = query({ error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "session_time_options") return optionQuery;
      if (table === "time_option_votes") return deleteQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      replaceTimeOptionVotes({
        session_id: "session-1",
        name: "Alex",
        participant_token: "device-1",
        player_id: null,
        previous_identity: {
          id: "vote-1",
          name: "Alex",
          participantToken: "device-1",
          playerId: null,
        },
        session_time_option_ids: ["option-1", "stale-option"],
      })
    ).rejects.toThrow("Invalid time option selection.");

    expect(deleteQuery.delete).not.toHaveBeenCalled();
  });
});

describe("deleteSession", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("deletes a single session by id", async () => {
    const sessionQuery = query({ error: null });
    fromMock.mockReturnValue(sessionQuery);

    await deleteSession("session-1");

    expect(fromMock).toHaveBeenCalledWith("sessions");
    expect(sessionQuery.delete).toHaveBeenCalled();
    expect(sessionQuery.eq).toHaveBeenCalledWith("id", "session-1");
  });
});

describe("listSessionsManagedBy", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns active sessions owned by the player", async () => {
    const chain = query({
      data: [{ id: "s1", manager_id: "player-1", status: "active" }],
      error: null,
    });
    fromMock.mockReturnValue(chain);

    await expect(listSessionsManagedBy("player-1")).resolves.toEqual([
      { id: "s1", manager_id: "player-1", status: "active" },
    ]);
    expect(fromMock).toHaveBeenCalledWith("sessions");
    expect(chain.eq).toHaveBeenCalledWith("manager_id", "player-1");
    expect(chain.eq).toHaveBeenCalledWith("status", "active");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("hides sessions that ended more than 24h ago", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T00:00:00Z"));
    fromMock.mockReturnValue(
      query({
        data: [
          // ended 2h before now -> kept
          { id: "live", manager_id: "player-1", status: "active", starts_at: "2026-06-09T20:00:00Z", duration_min: 120 },
          // ended ~34h before now -> hidden
          { id: "stale", manager_id: "player-1", status: "active", starts_at: "2026-06-08T12:00:00Z", duration_min: 120 },
        ],
        error: null,
      })
    );

    const result = await listSessionsManagedBy("player-1");
    expect(result.map((s) => s.id)).toEqual(["live"]);
    vi.useRealTimers();
  });
});

describe("listSessionsJoinedBy", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("unions participant and voter sessions, drops managed and cancelled", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "participants") {
        return query({ data: [{ session_id: "s1" }, { session_id: "s2" }], error: null });
      }
      if (table === "time_option_votes") {
        return query({ data: [{ session_id: "s2" }, { session_id: "s3" }], error: null });
      }
      // sessions
      return query({
        data: [
          { id: "s1", status: "active", manager_id: null, created_at: "2026-06-01" },
          { id: "s2", status: "cancelled", manager_id: null, created_at: "2026-06-02" },
          { id: "s3", status: "active", manager_id: "player-1", created_at: "2026-06-03" },
        ],
        error: null,
      });
    });

    const result = await listSessionsJoinedBy("player-1");
    expect(result.map((s) => s.id)).toEqual(["s1"]); // s2 cancelled, s3 managed
  });

  it("returns empty without querying sessions when no joins exist", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "sessions") throw new Error("should not query sessions");
      return query({ data: [], error: null });
    });

    await expect(listSessionsJoinedBy("player-1")).resolves.toEqual([]);
  });

  it("hides joined sessions that ended more than 24h ago", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T00:00:00Z"));
    fromMock.mockImplementation((table: string) => {
      if (table === "participants") {
        return query({ data: [{ session_id: "live" }, { session_id: "stale" }], error: null });
      }
      if (table === "time_option_votes") {
        return query({ data: [], error: null });
      }
      return query({
        data: [
          { id: "live", status: "active", manager_id: null, starts_at: "2026-06-09T20:00:00Z", duration_min: 120, created_at: "2026-06-01" },
          { id: "stale", status: "active", manager_id: null, starts_at: "2026-06-08T12:00:00Z", duration_min: 120, created_at: "2026-06-02" },
        ],
        error: null,
      });
    });

    const result = await listSessionsJoinedBy("player-1");
    expect(result.map((s) => s.id)).toEqual(["live"]);
    vi.useRealTimers();
  });
});
