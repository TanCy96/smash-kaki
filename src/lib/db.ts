import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { PollVoteIdentity } from "./time-poll";
import type {
  Participant,
  Profile,
  Rsvp,
  Session,
  SessionTimeOption,
  SessionTimeOptionWithVotes,
  TimeOptionVote,
} from "./types";

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function createSession(input: {
  manage_token: string;
  guest_token: string;
  title: string;
  starts_at: string | null;
  duration_min: number | null;
  location: string;
  court_numbers: string | null;
  notes: string | null;
  lifecycle?: "draft" | "finalized";
}): Promise<Session> {
  const { data, error } = await admin
    .from("sessions")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Session;
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await admin.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

export async function getSessionByGuestToken(
  token: string
): Promise<Session | null> {
  const { data } = await admin
    .from("sessions")
    .select("*")
    .eq("guest_token", token)
    .maybeSingle();
  return (data as Session) ?? null;
}

export async function getSessionByManageToken(
  token: string
): Promise<Session | null> {
  const { data } = await admin
    .from("sessions")
    .select("*")
    .eq("manage_token", token)
    .maybeSingle();
  return (data as Session) ?? null;
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function updateSessionDetails(
  id: string,
  patch: Partial<
    Pick<
      Session,
      | "title"
      | "starts_at"
      | "duration_min"
      | "location"
      | "court_numbers"
      | "notes"
      | "status"
      | "lifecycle"
    >
  >
): Promise<void> {
  const { error } = await admin.from("sessions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setSessionCost(
  id: string,
  cost: {
    court_cost: number | null;
    shuttles_used: number | null;
    price_per_shuttle: number | null;
  }
): Promise<void> {
  const { error } = await admin.from("sessions").update(cost).eq("id", id);
  if (error) throw error;
}

export async function listParticipants(
  sessionId: string
): Promise<Participant[]> {
  const { data } = await admin
    .from("participants")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return (data as Participant[]) ?? [];
}

export async function insertParticipant(input: {
  session_id: string;
  name: string;
  rsvp: Rsvp;
  participant_token: string | null;
  player_id: string | null;
  added_by_token?: string | null;
}): Promise<Participant> {
  const { data, error } = await admin
    .from("participants")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Participant;
}

export async function updateParticipant(
  id: string,
  patch: Partial<Pick<Participant, "name" | "rsvp" | "attended" | "player_id">>
): Promise<void> {
  const { error } = await admin.from("participants").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteParticipant(
  id: string,
  sessionId: string
): Promise<void> {
  const { error } = await admin
    .from("participants")
    .delete()
    .eq("id", id)
    .eq("session_id", sessionId);
  if (error) throw error;
}

export async function deleteGuestsOf(
  sessionId: string,
  addedByToken: string
): Promise<void> {
  const { error } = await admin
    .from("participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("added_by_token", addedByToken);
  if (error) throw error;
}

export async function setAttendance(
  sessionId: string,
  attendedIds: string[]
): Promise<void> {
  await admin
    .from("participants")
    .update({ attended: false })
    .eq("session_id", sessionId);

  if (attendedIds.length) {
    const { error } = await admin
      .from("participants")
      .update({ attended: true })
      .in("id", attendedIds);
    if (error) throw error;
  }
}

export async function createSessionTimeOptions(
  sessionId: string,
  options: {
    starts_at: string;
    duration_min: number;
    label: string | null;
  }[]
): Promise<SessionTimeOption[]> {
  if (options.length === 0) return [];

  const { data, error } = await admin
    .from("session_time_options")
    .insert(
      options.map((option) => ({
        session_id: sessionId,
        ...option,
      }))
    )
    .select()
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data as SessionTimeOption[]) ?? [];
}

export async function listSessionTimeOptions(
  sessionId: string
): Promise<SessionTimeOptionWithVotes[]> {
  const { data: options, error: optionError } = await admin
    .from("session_time_options")
    .select("*")
    .eq("session_id", sessionId)
    .order("starts_at", { ascending: true });

  if (optionError) throw optionError;

  const { data: votes, error: voteError } = await admin
    .from("time_option_votes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (voteError) throw voteError;

  const allVotes = (votes as TimeOptionVote[]) ?? [];

  return ((options as SessionTimeOption[]) ?? []).map((option) => ({
    ...option,
    votes: allVotes.filter(
      (vote) => vote.session_time_option_id === option.id
    ),
  }));
}

export async function listTimePollVoters(sessionId: string): Promise<
  PollVoteIdentity[]
> {
  const { data, error } = await admin
    .from("time_option_votes")
    .select("id, name, participant_token, player_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const seen = new Set<string>();
  return (
    (data as {
      id: string;
      name: string;
      participant_token: string | null;
      player_id: string | null;
    }[]) ?? []
  )
    .map((identity) => ({
      id: identity.id,
      name: identity.name,
      participantToken: identity.participant_token,
      playerId: identity.player_id,
    }))
    .filter((identity) => {
      const key = identity.playerId
        ? `player:${identity.playerId}`
        : identity.participantToken
          ? `device:${identity.participantToken}`
          : `vote:${identity.id}`;
      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}

export async function replaceTimeOptionVotes(input: {
  session_id: string;
  name: string;
  participant_token: string;
  player_id: string | null;
  previous_identity: PollVoteIdentity | null;
  session_time_option_ids: string[];
}): Promise<void> {
  const selectedOptionIds = [...new Set(input.session_time_option_ids)];

  if (selectedOptionIds.length > 0) {
    const { data, error } = await admin
      .from("session_time_options")
      .select("id")
      .eq("session_id", input.session_id)
      .in("id", selectedOptionIds);

    if (error) throw error;

    const validOptionIds = new Set(
      ((data as { id: string }[]) ?? []).map((option) => option.id)
    );
    const hasInvalidSelection = selectedOptionIds.some(
      (optionId) => !validOptionIds.has(optionId)
    );

    if (hasInvalidSelection) {
      throw new Error("Invalid time option selection.");
    }
  }

  const previous = input.previous_identity;

  if (previous?.playerId) {
    const { error } = await admin
      .from("time_option_votes")
      .delete()
      .eq("session_id", input.session_id)
      .eq("player_id", previous.playerId);
    if (error) throw error;
  } else if (previous?.participantToken) {
    const { error } = await admin
      .from("time_option_votes")
      .delete()
      .eq("session_id", input.session_id)
      .eq("participant_token", previous.participantToken);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("time_option_votes")
      .delete()
      .eq("session_id", input.session_id)
      .eq("participant_token", input.participant_token);
    if (error) throw error;
  }

  if (selectedOptionIds.length === 0) return;

  const { error } = await admin.from("time_option_votes").insert(
    selectedOptionIds.map((optionId) => ({
      session_id: input.session_id,
      session_time_option_id: optionId,
      name: input.name,
      participant_token: input.participant_token,
      player_id: input.player_id,
    }))
  );

  if (error) throw error;
}

export async function getSessionTimeOption(
  optionId: string
): Promise<SessionTimeOption | null> {
  const { data } = await admin
    .from("session_time_options")
    .select("*")
    .eq("id", optionId)
    .maybeSingle();

  return (data as SessionTimeOption) ?? null;
}

export async function listVotesForTimeOption(
  optionId: string
): Promise<TimeOptionVote[]> {
  const { data, error } = await admin
    .from("time_option_votes")
    .select("*")
    .eq("session_time_option_id", optionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as TimeOptionVote[]) ?? [];
}
