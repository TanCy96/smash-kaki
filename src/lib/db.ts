import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Participant, Rsvp, Session } from "./types";

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function createSession(input: {
  manage_token: string;
  guest_token: string;
  title: string;
  starts_at: string;
  duration_min: number;
  location: string;
  court_numbers: string | null;
  notes: string | null;
}): Promise<Session> {
  const { data, error } = await admin
    .from("sessions")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Session;
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
  participant_token: string;
  player_id: string | null;
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
