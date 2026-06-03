import type { Participant } from "./types";

export type IdentityMatch =
  | { kind: "logged-in"; participantId: string }
  | { kind: "device"; participantId: string }
  | { kind: "duplicate-name"; participantId: string }
  | { kind: "new" };

export function resolveIdentity(args: {
  loggedInPlayerId: string | null;
  deviceToken: string | null;
  name: string;
  existing: Participant[];
}): IdentityMatch {
  const { loggedInPlayerId, deviceToken, name, existing } = args;

  if (loggedInPlayerId) {
    const match = existing.find((p) => p.player_id === loggedInPlayerId);
    if (match) return { kind: "logged-in", participantId: match.id };
  }

  if (deviceToken) {
    const match = existing.find((p) => p.participant_token === deviceToken);
    if (match) return { kind: "device", participantId: match.id };
  }

  const normalizedName = name.trim().toLowerCase();
  const duplicate = existing.find(
    (p) => p.name.trim().toLowerCase() === normalizedName
  );
  if (duplicate) {
    return { kind: "duplicate-name", participantId: duplicate.id };
  }

  return { kind: "new" };
}
