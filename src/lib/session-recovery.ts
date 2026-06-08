import type { Session } from "./types";

const RECOVERY_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a session should still appear in a user's "My sessions" recovery list.
 *
 * Draft polls have no fixed time yet, so they never count as "over" and always
 * show. A finalized session drops off 24h after it ends (`starts_at` +
 * `duration_min`), so recently-played sessions stay recoverable for a day.
 */
export function isWithinRecoveryWindow(session: Session, nowMs: number): boolean {
  if (!session.starts_at || !session.duration_min) return true;
  const endMs = Date.parse(session.starts_at) + session.duration_min * 60_000;
  return nowMs - endMs <= RECOVERY_GRACE_MS;
}
