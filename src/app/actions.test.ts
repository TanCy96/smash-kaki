import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const currentPlayerIdMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  getSessionByGuestToken: vi.fn(),
  getSessionByManageToken: vi.fn(),
  listParticipants: vi.fn(),
  insertParticipant: vi.fn(),
  updateParticipant: vi.fn(),
  deleteGuestsOf: vi.fn(),
  listSessionTimeOptions: vi.fn(),
  listTimePollVoters: vi.fn(),
  replaceTimeOptionVotes: vi.fn(),
  getSessionTimeOption: vi.fn(),
  listVotesForTimeOption: vi.fn(),
  updateSessionDetails: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
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
      },
      {
        id: "vote-2",
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Alex Updated",
        participant_token: "device-1",
        player_id: null,
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
