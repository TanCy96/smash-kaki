"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import * as db from "@/lib/db";
import { authErrorMessage, authErrorRedirectPath } from "@/lib/auth-errors";
import { resolveIdentity } from "@/lib/identity";
import { currentPlayerId, serverAuth } from "@/lib/supabase-auth";
import {
  malaysiaDateTimeLocalToIso,
  resolvePollVoter,
  selectedOptionIds,
} from "@/lib/time-poll";
import { generateToken } from "@/lib/tokens";
import { normalizePlayerNames } from "@/lib/players";
import type { Rsvp } from "@/lib/types";

const createSchema = z.object({
  organizer_name: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  court_numbers: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  device_token: z.string().min(1),
});

export async function createSessionAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const value = createSchema.parse(raw);
  const optionStarts = formData.getAll("option_starts_at").map(String);
  const optionDurations = formData.getAll("option_duration_min").map(Number);
  const availableIndexes = new Set(
    formData
      .getAll("organizer_available_index")
      .map((item) => Number(item))
      .filter(Number.isInteger)
  );
  const options = optionStarts
    .flatMap((startsAt, index) => {
      const startsAtIso = malaysiaDateTimeLocalToIso(startsAt);
      const duration = optionDurations[index];

      if (!startsAtIso || !Number.isInteger(duration) || duration <= 0) {
        return [];
      }

      return [
        {
          starts_at: startsAtIso,
          duration_min: duration,
          index,
          label: `Option ${index + 1}`,
        },
      ];
    });

  if (options.length < 2) redirect("/?error=options");

  const playerId = await currentPlayerId();
  const session = await db.createSession({
    manage_token: generateToken(),
    guest_token: generateToken(),
    title: value.title,
    starts_at: null,
    duration_min: null,
    location: value.location,
    court_numbers: value.court_numbers || null,
    notes: value.notes || null,
    lifecycle: "draft",
  });

  try {
    const createdOptions = await db.createSessionTimeOptions(
      session.id,
      options.map((option) => ({
        starts_at: option.starts_at,
        duration_min: option.duration_min,
        label: option.label,
      }))
    );
    const optionIdsByLabel = new Map(
      createdOptions.map((option) => [option.label, option.id])
    );
    const selectedOptionIds = options
      .filter((option) => availableIndexes.has(option.index))
      .map((option) => optionIdsByLabel.get(option.label))
      .filter((optionId): optionId is string => Boolean(optionId));

    if (selectedOptionIds.length > 0) {
      await db.replaceTimeOptionVotes({
        session_id: session.id,
        name: value.organizer_name,
        participant_token: value.device_token,
        player_id: playerId,
        previous_identity: null,
        session_time_option_ids: selectedOptionIds,
      });
    }
  } catch (error) {
    try {
      await db.deleteSession(session.id);
    } catch {
      // Preserve the child-write failure for the caller; cleanup is best effort.
    }
    throw error;
  }

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
  if (
    !session ||
    session.status === "cancelled" ||
    session.lifecycle !== "finalized"
  ) {
    redirect(`/s/${value.guest_token}`);
  }

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

  const friendNames = normalizePlayerNames(
    formData.getAll("friend_name").map(String),
    { max: 10 }
  );

  await db.deleteGuestsOf(session.id, value.device_token);
  for (const name of friendNames) {
    await db.insertParticipant({
      session_id: session.id,
      name,
      rsvp: "going",
      participant_token: null,
      player_id: null,
      added_by_token: value.device_token,
    });
  }

  revalidatePath(`/s/${value.guest_token}`);
  redirect(`/s/${value.guest_token}?submitted=1`);
}

export async function getMyRsvp(
  guestToken: string,
  deviceToken: string
): Promise<{ name: string; rsvp: Rsvp; friends: string[] } | null> {
  const session = await db.getSessionByGuestToken(guestToken);
  if (!session) return null;

  const playerId = await currentPlayerId();
  const participants = await db.listParticipants(session.id);

  const self =
    (playerId
      ? participants.find((p) => p.player_id === playerId)
      : undefined) ??
    participants.find((p) => p.participant_token === deviceToken) ??
    null;

  const friends = participants
    .filter((p) => p.added_by_token === deviceToken)
    .map((p) => p.name);

  if (!self && friends.length === 0) return null;

  return {
    name: self?.name ?? "",
    rsvp: self?.rsvp ?? "going",
    friends,
  };
}

const timePollVoteSchema = z.object({
  guest_token: z.string(),
  name: z.string().trim().min(1),
  device_token: z.string().min(1),
});

export async function timePollVoteAction(formData: FormData) {
  const value = timePollVoteSchema.parse(Object.fromEntries(formData));
  const session = await db.getSessionByGuestToken(value.guest_token);
  if (
    !session ||
    session.status === "cancelled" ||
    session.lifecycle !== "draft"
  ) {
    redirect(`/s/${value.guest_token}`);
  }

  const playerId = await currentPlayerId();
  const options = await db.listSessionTimeOptions(session.id);
  const validOptionIds = options.map((option) => option.id);
  const optionIds = selectedOptionIds(
    formData.getAll("time_option_id").map(String),
    validOptionIds
  );
  const existing = await db.listTimePollVoters(session.id);
  const match = resolvePollVoter({
    loggedInPlayerId: playerId,
    deviceToken: value.device_token,
    name: value.name,
    existing,
  });
  const previousIdentity =
    match.kind === "new"
      ? null
      : (existing.find((voter) => voter.id === match.voterId) ?? null);

  await db.replaceTimeOptionVotes({
    session_id: session.id,
    name: value.name,
    participant_token: value.device_token,
    player_id: playerId,
    previous_identity: previousIdentity,
    session_time_option_ids: optionIds,
  });

  revalidatePath(`/s/${value.guest_token}`);
  revalidatePath(`/m/${session.manage_token}`);
  redirect(`/s/${value.guest_token}?submitted=1`);
}

const finalizeTimeOptionSchema = z.object({
  manage_token: z.string(),
  time_option_id: z.string(),
});

export async function finalizeTimeOptionAction(formData: FormData) {
  const value = finalizeTimeOptionSchema.parse(Object.fromEntries(formData));
  const session = await db.getSessionByManageToken(value.manage_token);
  if (
    !session ||
    session.status === "cancelled" ||
    session.lifecycle !== "draft"
  ) {
    redirect(`/m/${value.manage_token}`);
  }

  const option = await db.getSessionTimeOption(value.time_option_id);
  if (!option || option.session_id !== session.id) {
    redirect(`/m/${value.manage_token}`);
  }

  const votes = await db.listVotesForTimeOption(option.id);
  const participants = await db.listParticipants(session.id);
  let knownParticipants = participants;

  for (const vote of votes) {
    const match = resolveIdentity({
      loggedInPlayerId: vote.player_id,
      deviceToken: vote.participant_token,
      name: vote.name,
      existing: knownParticipants,
    });

    if (match.kind === "new") {
      const inserted = await db.insertParticipant({
        session_id: session.id,
        name: vote.name,
        rsvp: "going",
        participant_token: vote.participant_token,
        player_id: vote.player_id,
      });
      knownParticipants = [...knownParticipants, inserted];
    } else {
      await db.updateParticipant(match.participantId, {
        name: vote.name,
        rsvp: "going",
        player_id: vote.player_id,
      });
      knownParticipants = knownParticipants.map((participant) =>
        participant.id === match.participantId
          ? {
              ...participant,
              name: vote.name,
              rsvp: "going",
              player_id: vote.player_id,
            }
          : participant
      );
    }
  }

  await db.updateSessionDetails(session.id, {
    starts_at: option.starts_at,
    duration_min: option.duration_min,
    lifecycle: "finalized",
  });

  revalidatePath(`/m/${value.manage_token}`);
  revalidatePath(`/s/${session.guest_token}`);
  redirect(`/m/${value.manage_token}?saved=finalized`);
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
  if (!session) redirect(`/m/${value.manage_token}`);

  let patch: Parameters<typeof db.updateSessionDetails>[1];
  if (session.lifecycle === "draft") {
    patch = {
      title: value.title,
      location: value.location,
      court_numbers: value.court_numbers || null,
      notes: value.notes || null,
    };
  } else {
    const startsAt = malaysiaDateTimeLocalToIso(value.starts_at);
    if (!startsAt) redirect(`/m/${value.manage_token}`);
    patch = {
      title: value.title,
      starts_at: startsAt,
      duration_min: value.duration_min,
      location: value.location,
      court_numbers: value.court_numbers || null,
      notes: value.notes || null,
    };
  }

  await db.updateSessionDetails(session.id, patch);

  revalidatePath(`/m/${value.manage_token}`);
  revalidatePath(`/s/${session.guest_token}`);
  redirect(`/m/${value.manage_token}?saved=details`);
}

export async function cancelSessionAction(formData: FormData) {
  const manageToken = String(formData.get("manage_token"));
  const session = await db.getSessionByManageToken(manageToken);
  if (session) {
    await db.updateSessionDetails(session.id, { status: "cancelled" });
    revalidatePath(`/m/${manageToken}`);
    revalidatePath(`/s/${session.guest_token}`);
  }

  redirect(`/m/${manageToken}?saved=cancelled`);
}

export async function verifyAttendanceAction(formData: FormData) {
  const manageToken = String(formData.get("manage_token"));
  const session = await db.getSessionByManageToken(manageToken);
  if (!session) redirect(`/m/${manageToken}`);

  const attendedIds = formData.getAll("attended").map(String);
  await db.setAttendance(session.id, attendedIds);
  revalidatePath(`/m/${manageToken}`);
  revalidatePath(`/s/${session.guest_token}`);
  redirect(`/m/${manageToken}?saved=attendance`);
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
  if (!session) redirect(`/m/${value.manage_token}`);

  await db.setSessionCost(session.id, {
    court_cost: value.court_cost ?? null,
    shuttles_used: value.shuttles_used ?? null,
    price_per_shuttle: value.price_per_shuttle ?? null,
  });

  revalidatePath(`/m/${value.manage_token}`);
  revalidatePath(`/s/${session.guest_token}`);
  redirect(`/m/${value.manage_token}?saved=cost`);
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const displayName = String(formData.get("display_name"));
  const supabase = await serverAuth();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    redirect(authErrorRedirectPath("/register", authErrorMessage(error)));
  }

  if (data.user) {
    const { error: profileError } = await db.admin
      .from("profiles")
      .insert({ id: data.user.id, display_name: displayName });
    if (profileError) {
      redirect(
        authErrorRedirectPath("/register", authErrorMessage(profileError))
      );
    }
  }

  revalidatePath("/");
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const supabase = await serverAuth();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) {
    redirect(authErrorRedirectPath("/login", authErrorMessage(error)));
  }

  revalidatePath("/");
  redirect("/");
}

export async function logoutAction() {
  const supabase = await serverAuth();
  await supabase.auth.signOut();

  revalidatePath("/");
  redirect("/");
}

export async function forgotPasswordAction(formData: FormData) {
  const supabase = await serverAuth();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(
    String(formData.get("email")),
    {
      redirectTo: `${base}/auth/callback?next=/update-password`,
    }
  );
  if (error) {
    redirect(authErrorRedirectPath("/forgot-password", authErrorMessage(error)));
  }

  redirect("/login?reset=sent");
}

const updatePasswordSchema = z.object({
  password: z.string().min(6),
});

export async function updatePasswordAction(formData: FormData) {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(
      authErrorRedirectPath(
        "/update-password",
        "Password must be at least 6 characters."
      )
    );
  }

  const supabase = await serverAuth();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    redirect(authErrorRedirectPath("/update-password", authErrorMessage(error)));
  }

  revalidatePath("/");
  redirect("/");
}

export async function addPlayersAction(formData: FormData) {
  const manageToken = String(formData.get("manage_token"));
  const session = await db.getSessionByManageToken(manageToken);
  if (
    !session ||
    session.status === "cancelled" ||
    session.lifecycle !== "finalized"
  ) {
    redirect(`/m/${manageToken}`);
  }

  const names = normalizePlayerNames(
    formData.getAll("player_name").map(String),
    { max: 10 }
  );

  for (const name of names) {
    await db.insertParticipant({
      session_id: session.id,
      name,
      rsvp: "going",
      participant_token: null,
      player_id: null,
      added_by_token: null,
    });
  }

  revalidatePath(`/m/${manageToken}`);
  revalidatePath(`/s/${session.guest_token}`);
  redirect(`/m/${manageToken}?saved=players`);
}

export async function removeParticipantAction(formData: FormData) {
  const manageToken = String(formData.get("manage_token"));
  const participantId = String(formData.get("participant_id"));
  const session = await db.getSessionByManageToken(manageToken);
  if (!session) redirect(`/m/${manageToken}`);

  await db.deleteParticipant(participantId, session.id);

  revalidatePath(`/m/${manageToken}`);
  revalidatePath(`/s/${session.guest_token}`);
  redirect(`/m/${manageToken}?saved=players`);
}
