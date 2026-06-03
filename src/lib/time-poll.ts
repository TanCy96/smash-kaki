export type PollVoteIdentity = {
  id: string;
  name: string;
  participantToken: string | null;
  playerId: string | null;
};

export type PollVoterMatch =
  | { kind: "logged-in"; voterId: string }
  | { kind: "device"; voterId: string }
  | { kind: "duplicate-name"; voterId: string }
  | { kind: "new" };

export function resolvePollVoter(args: {
  loggedInPlayerId: string | null;
  deviceToken: string | null;
  name: string;
  existing: PollVoteIdentity[];
}): PollVoterMatch {
  const { loggedInPlayerId, deviceToken, name, existing } = args;

  if (loggedInPlayerId) {
    const match = existing.find((voter) => voter.playerId === loggedInPlayerId);
    if (match) return { kind: "logged-in", voterId: match.id };
  }

  if (deviceToken) {
    const match = existing.find(
      (voter) => voter.participantToken === deviceToken
    );
    if (match) return { kind: "device", voterId: match.id };
  }

  const normalizedName = name.trim().toLowerCase();
  const duplicate = existing.find(
    (voter) => voter.name.trim().toLowerCase() === normalizedName
  );
  if (duplicate) {
    return { kind: "duplicate-name", voterId: duplicate.id };
  }

  return { kind: "new" };
}

export function selectedOptionIds(
  requestedOptionIds: string[],
  validOptionIds: string[]
): string[] {
  const valid = new Set(validOptionIds);
  const selected = new Set<string>();

  for (const optionId of requestedOptionIds) {
    if (valid.has(optionId)) {
      selected.add(optionId);
    }
  }

  return [...selected];
}
