import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const currentPlayerIdMock = vi.hoisted(() => vi.fn());
const generateTokenMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  getSessionByGuestToken: vi.fn(),
  getSessionByManageToken: vi.fn(),
  listParticipants: vi.fn(),
  insertParticipant: vi.fn(),
  updateParticipant: vi.fn(),
  deleteGuestsOf: vi.fn(),
  deleteParticipant: vi.fn(),
  listSessionTimeOptions: vi.fn(),
  listTimePollVoters: vi.fn(),
  replaceTimeOptionVotes: vi.fn(),
  getSessionTimeOption: vi.fn(),
  listVotesForTimeOption: vi.fn(),
  updateSessionDetails: vi.fn(),
  deletePollVotesAddedBy: vi.fn(),
  insertTimeOptionVotes: vi.fn(),
  deletePollVotesByToken: vi.fn(),
  createSession: vi.fn(),
  createSessionTimeOptions: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/tokens", () => ({
  generateToken: generateTokenMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase-auth", () => ({
  currentPlayerId: currentPlayerIdMock,
  serverAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => dbMock);

describe("timePollVoteAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    currentPlayerIdMock.mockReset();
    dbMock.getSessionByGuestToken.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.listParticipants.mockReset();
    dbMock.insertParticipant.mockReset();
    dbMock.updateParticipant.mockReset();
    dbMock.listSessionTimeOptions.mockReset();
    dbMock.listTimePollVoters.mockReset();
    dbMock.replaceTimeOptionVotes.mockReset();
    dbMock.getSessionTimeOption.mockReset();
    dbMock.listVotesForTimeOption.mockReset();
    dbMock.updateSessionDetails.mockReset();
    dbMock.deletePollVotesAddedBy.mockReset();
    dbMock.insertTimeOptionVotes.mockReset();
    generateTokenMock.mockReset();
  });

  it("replaces a returning voter's draft poll choices with canonical previous identity", async () => {
    const { timePollVoteAction } = await import("./actions");
    const previousIdentity = {
      id: "vote-1",
      name: "Alex",
      participantToken: "device-1",
      playerId: null,
    };
    const formData = new FormData();
    formData.set("guest_token", "guest-1");
    formData.set("name", " Alex Updated ");
    formData.set("device_token", "device-1");
    formData.append("time_option_id", "option-2");
    formData.append("time_option_id", "stale-option");
    formData.append("time_option_id", "option-2");

    dbMock.getSessionByGuestToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.listSessionTimeOptions.mockResolvedValue([
      { id: "option-1", votes: [] },
      { id: "option-2", votes: [] },
    ]);
    dbMock.listTimePollVoters.mockResolvedValue([previousIdentity]);
    dbMock.replaceTimeOptionVotes.mockResolvedValue(undefined);
    currentPlayerIdMock.mockResolvedValue(null);

    await expect(timePollVoteAction(formData)).rejects.toThrow(
      "redirect:/s/guest-1?submitted=1"
    );

    expect(dbMock.replaceTimeOptionVotes).toHaveBeenCalledWith({
      session_id: "session-1",
      name: "Alex Updated",
      participant_token: "device-1",
      player_id: null,
      previous_identity: previousIdentity,
      session_time_option_ids: ["option-2"],
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/s/guest-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/m/manage-1");
  });

  it("creates ride-along friend votes on the host's selected slots", async () => {
    const { timePollVoteAction } = await import("./actions");
    generateTokenMock.mockReturnValueOnce("ft-1").mockReturnValueOnce("ft-2");

    const formData = new FormData();
    formData.set("guest_token", "guest-1");
    formData.set("name", "Alex");
    formData.set("device_token", "device-1");
    formData.append("time_option_id", "option-2");
    formData.append("friend_name", " Ali ");
    formData.append("friend_name", "Siti");

    dbMock.getSessionByGuestToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.listSessionTimeOptions.mockResolvedValue([
      { id: "option-1", votes: [] },
      { id: "option-2", votes: [] },
    ]);
    dbMock.listTimePollVoters.mockResolvedValue([]);
    dbMock.replaceTimeOptionVotes.mockResolvedValue(undefined);
    dbMock.deletePollVotesAddedBy.mockResolvedValue(undefined);
    dbMock.insertTimeOptionVotes.mockResolvedValue(undefined);
    currentPlayerIdMock.mockResolvedValue(null);

    await expect(timePollVoteAction(formData)).rejects.toThrow(
      "redirect:/s/guest-1?submitted=1"
    );

    expect(dbMock.deletePollVotesAddedBy).toHaveBeenCalledWith(
      "session-1",
      "device-1"
    );
    expect(dbMock.insertTimeOptionVotes).toHaveBeenCalledWith([
      {
        session_id: "session-1",
        session_time_option_id: "option-2",
        name: "Ali",
        participant_token: "ft-1",
        player_id: null,
        added_by_token: "device-1",
      },
      {
        session_id: "session-1",
        session_time_option_id: "option-2",
        name: "Siti",
        participant_token: "ft-2",
        player_id: null,
        added_by_token: "device-1",
      },
    ]);
  });
});

describe("finalizeTimeOptionAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    currentPlayerIdMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.getSessionTimeOption.mockReset();
    dbMock.listVotesForTimeOption.mockReset();
    dbMock.listParticipants.mockReset();
    dbMock.insertParticipant.mockReset();
    dbMock.updateParticipant.mockReset();
    dbMock.updateSessionDetails.mockReset();
  });

  it("finalizes a draft option and avoids duplicate participants from matching votes", async () => {
    const { finalizeTimeOptionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("time_option_id", "option-1");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.getSessionTimeOption.mockResolvedValue({
      id: "option-1",
      session_id: "session-1",
      starts_at: "2026-06-03T12:00:00.000Z",
      duration_min: 120,
    });
    dbMock.listVotesForTimeOption.mockResolvedValue([
      {
        id: "vote-1",
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Alex",
        participant_token: "device-1",
        player_id: null,
        added_by_token: null,
      },
      {
        id: "vote-2",
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Alex Updated",
        participant_token: "device-1",
        player_id: null,
        added_by_token: null,
      },
    ]);
    dbMock.listParticipants.mockResolvedValue([]);
    dbMock.insertParticipant.mockResolvedValue({
      id: "participant-1",
      session_id: "session-1",
      name: "Alex",
      rsvp: "going",
      attended: false,
      participant_token: "device-1",
      player_id: null,
      created_at: "2026-06-03T00:00:00.000Z",
    });
    dbMock.updateParticipant.mockResolvedValue(undefined);
    dbMock.updateSessionDetails.mockResolvedValue(undefined);

    await expect(finalizeTimeOptionAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=finalized"
    );

    expect(dbMock.insertParticipant).toHaveBeenCalledTimes(1);
    expect(dbMock.insertParticipant).toHaveBeenCalledWith({
      session_id: "session-1",
      name: "Alex",
      rsvp: "going",
      participant_token: "device-1",
      player_id: null,
      added_by_token: null,
    });
    expect(dbMock.updateParticipant).toHaveBeenCalledWith("participant-1", {
      name: "Alex Updated",
      rsvp: "going",
      player_id: null,
    });
    expect(dbMock.updateSessionDetails).toHaveBeenCalledWith("session-1", {
      starts_at: "2026-06-03T12:00:00.000Z",
      duration_min: 120,
      lifecycle: "finalized",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/m/manage-1");
    expect(revalidatePathMock).toHaveBeenCalledWith("/s/guest-1");
  });

  it("carries added_by_token when a ride-along friend wins", async () => {
    const { finalizeTimeOptionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("time_option_id", "option-1");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.getSessionTimeOption.mockResolvedValue({
      id: "option-1",
      session_id: "session-1",
      starts_at: "2026-06-03T12:00:00.000Z",
      duration_min: 120,
    });
    dbMock.listVotesForTimeOption.mockResolvedValue([
      {
        id: "vote-9",
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Ali",
        participant_token: "ft-1",
        player_id: null,
        added_by_token: "device-1",
      },
    ]);
    dbMock.listParticipants.mockResolvedValue([]);
    dbMock.insertParticipant.mockResolvedValue({ id: "participant-9" });
    dbMock.updateParticipant.mockResolvedValue(undefined);
    dbMock.updateSessionDetails.mockResolvedValue(undefined);

    await expect(finalizeTimeOptionAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=finalized"
    );

    expect(dbMock.insertParticipant).toHaveBeenCalledWith({
      session_id: "session-1",
      name: "Ali",
      rsvp: "going",
      participant_token: "ft-1",
      player_id: null,
      added_by_token: "device-1",
    });
  });
});

describe("editSessionAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.updateSessionDetails.mockReset();
  });

  it("updates only non-time details for draft sessions", async () => {
    const { editSessionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("title", "Friday Smash");
    formData.set("starts_at", "1970-01-01T00:00");
    formData.set("duration_min", "1");
    formData.set("location", "ABC Sports Hall");
    formData.set("court_numbers", "3");
    formData.set("notes", "Bring shuttles");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.updateSessionDetails.mockResolvedValue(undefined);

    await expect(editSessionAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=details"
    );

    expect(dbMock.updateSessionDetails).toHaveBeenCalledWith("session-1", {
      title: "Friday Smash",
      location: "ABC Sports Hall",
      court_numbers: "3",
      notes: "Bring shuttles",
    });
  });

  it("updates time details for finalized sessions", async () => {
    const { editSessionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("title", "Friday Smash");
    formData.set("starts_at", "2026-06-05T20:00");
    formData.set("duration_min", "120");
    formData.set("location", "ABC Sports Hall");
    formData.set("court_numbers", "");
    formData.set("notes", "");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "finalized",
    });
    dbMock.updateSessionDetails.mockResolvedValue(undefined);

    await expect(editSessionAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=details"
    );

    expect(dbMock.updateSessionDetails).toHaveBeenCalledWith("session-1", {
      title: "Friday Smash",
      starts_at: "2026-06-05T12:00:00.000Z",
      duration_min: 120,
      location: "ABC Sports Hall",
      court_numbers: null,
      notes: null,
    });
  });
});

describe("rsvpAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    currentPlayerIdMock.mockReset();
    dbMock.getSessionByGuestToken.mockReset();
    dbMock.listParticipants.mockReset();
    dbMock.insertParticipant.mockReset();
    dbMock.updateParticipant.mockReset();
    dbMock.deleteGuestsOf.mockReset();
  });

  it("redirects without writing an RSVP when the session is still a draft poll", async () => {
    const { rsvpAction } = await import("./actions");
    const formData = new FormData();
    formData.set("guest_token", "guest-1");
    formData.set("name", "Alex");
    formData.set("device_token", "device-1");
    formData.set("rsvp", "going");

    dbMock.getSessionByGuestToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });

    await expect(rsvpAction(formData)).rejects.toThrow("redirect:/s/guest-1");

    expect(dbMock.listParticipants).not.toHaveBeenCalled();
    expect(dbMock.insertParticipant).not.toHaveBeenCalled();
    expect(dbMock.updateParticipant).not.toHaveBeenCalled();
  });

  it("inserts the host RSVP and replaces their brought friends", async () => {
    const { rsvpAction } = await import("./actions");
    const formData = new FormData();
    formData.set("guest_token", "guest-1");
    formData.set("name", "Alex");
    formData.set("device_token", "device-1");
    formData.set("rsvp", "going");
    formData.append("friend_name", " Ali ");
    formData.append("friend_name", "");
    formData.append("friend_name", "ali");
    formData.append("friend_name", "Siti");

    dbMock.getSessionByGuestToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "finalized",
    });
    dbMock.listParticipants.mockResolvedValue([]);
    dbMock.insertParticipant.mockResolvedValue({ id: "participant-1" });
    dbMock.deleteGuestsOf.mockResolvedValue(undefined);
    currentPlayerIdMock.mockResolvedValue(null);

    await expect(rsvpAction(formData)).rejects.toThrow(
      "redirect:/s/guest-1?submitted=1"
    );

    expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(1, {
      session_id: "session-1",
      name: "Alex",
      rsvp: "going",
      participant_token: "device-1",
      player_id: null,
    });
    expect(dbMock.deleteGuestsOf).toHaveBeenCalledWith("session-1", "device-1");
    expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(2, {
      session_id: "session-1",
      name: "Ali",
      rsvp: "going",
      participant_token: null,
      player_id: null,
      added_by_token: "device-1",
    });
    expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(3, {
      session_id: "session-1",
      name: "Siti",
      rsvp: "going",
      participant_token: null,
      player_id: null,
      added_by_token: "device-1",
    });
  });
});

describe("addPlayersAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.insertParticipant.mockReset();
  });

  it("inserts each normalized name as a going manager-added player", async () => {
    const { addPlayersAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.append("player_name", " Ali ");
    formData.append("player_name", "ali");
    formData.append("player_name", "Siti");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "finalized",
    });
    dbMock.insertParticipant.mockResolvedValue({ id: "participant-1" });

    await expect(addPlayersAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=players"
    );

    expect(dbMock.insertParticipant).toHaveBeenCalledTimes(2);
    expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(1, {
      session_id: "session-1",
      name: "Ali",
      rsvp: "going",
      participant_token: null,
      player_id: null,
      added_by_token: null,
    });
    expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(2, {
      session_id: "session-1",
      name: "Siti",
      rsvp: "going",
      participant_token: null,
      player_id: null,
      added_by_token: null,
    });
  });

  it("redirects without inserting when the session is not finalized", async () => {
    const { addPlayersAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.append("player_name", "Ali");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });

    await expect(addPlayersAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1"
    );

    expect(dbMock.insertParticipant).not.toHaveBeenCalled();
  });
});

describe("removeParticipantAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.deleteParticipant.mockReset();
  });

  it("deletes the participant scoped to the session", async () => {
    const { removeParticipantAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("participant_id", "participant-9");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "finalized",
    });
    dbMock.deleteParticipant.mockResolvedValue(undefined);

    await expect(removeParticipantAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=players"
    );

    expect(dbMock.deleteParticipant).toHaveBeenCalledWith(
      "participant-9",
      "session-1"
    );
  });

  it("redirects without deleting when the session is cancelled", async () => {
    const { removeParticipantAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("participant_id", "participant-9");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "cancelled",
      lifecycle: "finalized",
    });

    await expect(removeParticipantAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1"
    );

    expect(dbMock.deleteParticipant).not.toHaveBeenCalled();
  });
});

describe("getMyPollFriends", () => {
  beforeEach(() => {
    dbMock.getSessionByGuestToken.mockReset();
    dbMock.listSessionTimeOptions.mockReset();
  });

  it("returns the caller's friend names, deduped by token across slots, with no tokens", async () => {
    const { getMyPollFriends } = await import("./actions");

    dbMock.getSessionByGuestToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.listSessionTimeOptions.mockResolvedValue([
      {
        id: "option-1",
        votes: [
          { id: "v1", name: "Host", participant_token: "device-1", added_by_token: null },
          { id: "v2", name: "Ali", participant_token: "ft-1", added_by_token: "device-1" },
          { id: "v3", name: "Other's friend", participant_token: "ft-9", added_by_token: "device-2" },
        ],
      },
      {
        id: "option-2",
        votes: [
          { id: "v4", name: "Ali", participant_token: "ft-1", added_by_token: "device-1" },
          { id: "v5", name: "Siti", participant_token: "ft-2", added_by_token: "device-1" },
        ],
      },
    ]);

    const result = await getMyPollFriends("guest-1", "device-1");

    expect(result).toEqual(["Ali", "Siti"]);
  });

  it("returns an empty array when the session is missing", async () => {
    const { getMyPollFriends } = await import("./actions");
    dbMock.getSessionByGuestToken.mockResolvedValue(null);

    const result = await getMyPollFriends("guest-x", "device-1");

    expect(result).toEqual([]);
    expect(dbMock.listSessionTimeOptions).not.toHaveBeenCalled();
  });
});

describe("addPollFriendAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.listSessionTimeOptions.mockReset();
    dbMock.insertTimeOptionVotes.mockReset();
    generateTokenMock.mockReset();
  });

  it("inserts one manager-owned vote per selected slot", async () => {
    const { addPollFriendAction } = await import("./actions");
    generateTokenMock.mockReturnValue("mft-1");

    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("name", " Bob ");
    formData.append("time_option_id", "option-1");
    formData.append("time_option_id", "option-2");
    formData.append("time_option_id", "bogus");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.listSessionTimeOptions.mockResolvedValue([
      { id: "option-1", votes: [] },
      { id: "option-2", votes: [] },
    ]);
    dbMock.insertTimeOptionVotes.mockResolvedValue(undefined);

    await expect(addPollFriendAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=players"
    );

    expect(dbMock.insertTimeOptionVotes).toHaveBeenCalledWith([
      {
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Bob",
        participant_token: "mft-1",
        player_id: null,
        added_by_token: "manager",
      },
      {
        session_id: "session-1",
        session_time_option_id: "option-2",
        name: "Bob",
        participant_token: "mft-1",
        player_id: null,
        added_by_token: "manager",
      },
    ]);
  });

  it("redirects without inserting when the session is not a draft", async () => {
    const { addPollFriendAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("name", "Bob");
    formData.append("time_option_id", "option-1");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "finalized",
    });

    await expect(addPollFriendAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1"
    );

    expect(dbMock.insertTimeOptionVotes).not.toHaveBeenCalled();
  });
});

describe("removePollFriendAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.deletePollVotesByToken.mockReset();
  });

  it("deletes the friend's votes by their synthetic token", async () => {
    const { removePollFriendAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("friend_token", "mft-1");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.deletePollVotesByToken.mockResolvedValue(undefined);

    await expect(removePollFriendAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=players"
    );

    expect(dbMock.deletePollVotesByToken).toHaveBeenCalledWith(
      "session-1",
      "mft-1"
    );
  });
});

describe("createSessionAction manager_id", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    currentPlayerIdMock.mockReset();
    generateTokenMock.mockReset();
    generateTokenMock.mockReturnValueOnce("manage-tok").mockReturnValueOnce("guest-tok");
    dbMock.createSession = vi.fn().mockResolvedValue({
      id: "session-1",
      manage_token: "manage-tok",
    });
    dbMock.createSessionTimeOptions = vi.fn().mockResolvedValue([]);
    dbMock.replaceTimeOptionVotes.mockReset().mockResolvedValue(undefined);
  });

  function form(): FormData {
    const fd = new FormData();
    fd.set("organizer_name", "Alex");
    fd.set("title", "Friday smash");
    fd.set("location", "Court Centre");
    fd.set("device_token", "device-1");
    fd.append("option_starts_at", "2026-06-12T19:00");
    fd.append("option_duration_min", "120");
    fd.append("option_starts_at", "2026-06-13T19:00");
    fd.append("option_duration_min", "120");
    return fd;
  }

  it("sets manager_id to the current player when logged in", async () => {
    const { createSessionAction } = await import("./actions");
    currentPlayerIdMock.mockResolvedValue("player-1");

    await expect(createSessionAction(form())).rejects.toThrow("redirect:/m/manage-tok?created=1");
    expect(dbMock.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ manager_id: "player-1" })
    );
  });

  it("sets manager_id to null when anonymous", async () => {
    const { createSessionAction } = await import("./actions");
    currentPlayerIdMock.mockResolvedValue(null);

    await expect(createSessionAction(form())).rejects.toThrow("redirect:/m/manage-tok?created=1");
    expect(dbMock.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ manager_id: null })
    );
  });
});
