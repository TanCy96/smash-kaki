import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const currentPlayerIdMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  getSessionByGuestToken: vi.fn(),
  listParticipants: vi.fn(),
  insertParticipant: vi.fn(),
  updateParticipant: vi.fn(),
  listSessionTimeOptions: vi.fn(),
  listTimePollVoters: vi.fn(),
  replaceTimeOptionVotes: vi.fn(),
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
    dbMock.listParticipants.mockReset();
    dbMock.insertParticipant.mockReset();
    dbMock.updateParticipant.mockReset();
    dbMock.listSessionTimeOptions.mockReset();
    dbMock.listTimePollVoters.mockReset();
    dbMock.replaceTimeOptionVotes.mockReset();
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
});
