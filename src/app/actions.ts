"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import * as db from "@/lib/db";
import { resolveIdentity } from "@/lib/identity";
import { currentPlayerId, serverAuth } from "@/lib/supabase-auth";
import { generateToken } from "@/lib/tokens";

const createSchema = z.object({
  title: z.string().min(1),
  starts_at: z.string().min(1),
  duration_min: z.coerce.number().int().positive(),
  location: z.string().min(1),
  court_numbers: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createSessionAction(formData: FormData) {
  const value = createSchema.parse(Object.fromEntries(formData));
  const session = await db.createSession({
    manage_token: generateToken(),
    guest_token: generateToken(),
    title: value.title,
    starts_at: new Date(value.starts_at).toISOString(),
    duration_min: value.duration_min,
    location: value.location,
    court_numbers: value.court_numbers || null,
    notes: value.notes || null,
  });

  redirect(`/m/${session.manage_token}?created=1`);
}

const rsvpSchema = z.object({
  guest_token: z.string(),
  name: z.string().min(1),
  rsvp: z.enum(["going", "maybe", "cant"]),
  device_token: z.string().min(1),
});

export async function rsvpAction(formData: FormData) {
  const value = rsvpSchema.parse(Object.fromEntries(formData));
  const session = await db.getSessionByGuestToken(value.guest_token);
  if (!session || session.status === "cancelled") return;

  const playerId = await currentPlayerId();
  const existing = await db.listParticipants(session.id);
  const match = resolveIdentity({
    loggedInPlayerId: playerId,
    deviceToken: value.device_token,
    name: value.name,
    existing,
  });

  if (match.kind === "new") {
    await db.insertParticipant({
      session_id: session.id,
      name: value.name,
      rsvp: value.rsvp,
      participant_token: value.device_token,
      player_id: playerId,
    });
  } else {
    await db.updateParticipant(match.participantId, {
      name: value.name,
      rsvp: value.rsvp,
      player_id: playerId,
    });
  }
}

const editSchema = z.object({
  manage_token: z.string(),
  title: z.string().min(1),
  starts_at: z.string().min(1),
  duration_min: z.coerce.number().int().positive(),
  location: z.string().min(1),
  court_numbers: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function editSessionAction(formData: FormData) {
  const value = editSchema.parse(Object.fromEntries(formData));
  const session = await db.getSessionByManageToken(value.manage_token);
  if (!session) return;

  await db.updateSessionDetails(session.id, {
    title: value.title,
    starts_at: new Date(value.starts_at).toISOString(),
    duration_min: value.duration_min,
    location: value.location,
    court_numbers: value.court_numbers || null,
    notes: value.notes || null,
  });
}

export async function cancelSessionAction(formData: FormData) {
  const manageToken = String(formData.get("manage_token"));
  const session = await db.getSessionByManageToken(manageToken);
  if (session) {
    await db.updateSessionDetails(session.id, { status: "cancelled" });
  }
}

export async function verifyAttendanceAction(formData: FormData) {
  const manageToken = String(formData.get("manage_token"));
  const session = await db.getSessionByManageToken(manageToken);
  if (!session) return;

  const attendedIds = formData.getAll("attended").map(String);
  await db.setAttendance(session.id, attendedIds);
}

const costSchema = z.object({
  manage_token: z.string(),
  court_cost: z.coerce.number().nonnegative().optional(),
  shuttles_used: z.coerce.number().int().nonnegative().optional(),
  price_per_shuttle: z.coerce.number().nonnegative().optional(),
});

export async function setCostAction(formData: FormData) {
  const value = costSchema.parse(Object.fromEntries(formData));
  const session = await db.getSessionByManageToken(value.manage_token);
  if (!session) return;

  await db.setSessionCost(session.id, {
    court_cost: value.court_cost ?? null,
    shuttles_used: value.shuttles_used ?? null,
    price_per_shuttle: value.price_per_shuttle ?? null,
  });
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const displayName = String(formData.get("display_name"));
  const supabase = await serverAuth();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  if (data.user) {
    await db.admin
      .from("profiles")
      .insert({ id: data.user.id, display_name: displayName });
  }

  redirect("/");
}

export async function loginAction(formData: FormData) {
  const supabase = await serverAuth();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) throw error;

  redirect("/");
}

export async function logoutAction() {
  const supabase = await serverAuth();
  await supabase.auth.signOut();

  redirect("/");
}

export async function forgotPasswordAction(formData: FormData) {
  const supabase = await serverAuth();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  await supabase.auth.resetPasswordForEmail(String(formData.get("email")), {
    redirectTo: `${base}/login`,
  });

  redirect("/login?reset=sent");
}
