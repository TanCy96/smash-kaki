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

const malaysiaOffsetMinutes = 8 * 60;
const dateTimeLocalPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function malaysiaDateTimeLocalToIso(value: string): string | null {
  const match = dateTimeLocalPattern.exec(value);
  if (!match) return null;

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (
    month < 1 ||
    month > 12 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const malaysiaWallClockTime = Date.UTC(year, month - 1, day, hour, minute);
  const utcTime = malaysiaWallClockTime - malaysiaOffsetMinutes * 60_000;
  const malaysiaLocal = new Date(utcTime + malaysiaOffsetMinutes * 60_000);

  if (
    malaysiaLocal.getUTCFullYear() !== year ||
    malaysiaLocal.getUTCMonth() !== month - 1 ||
    malaysiaLocal.getUTCDate() !== day ||
    malaysiaLocal.getUTCHours() !== hour ||
    malaysiaLocal.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return new Date(utcTime).toISOString();
}
