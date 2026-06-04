# Bring friends during a draft/poll session

**Date:** 2026-06-04
**Status:** Approved design, pre-implementation
**Builds on:** `2026-06-04-bring-a-friend-design.md` (finalized-session bring-a-friend, already implemented on branch `feat/bring-a-friend`)

## Goal

Extend "bring a friend" to **draft/poll** sessions. Today friends can only be
added once a session is finalized. This lets a guest bring friends while voting
on times, and lets the organizer add players from the draft manage page —
before the session is finalized.

## Scope

- **In:** Guest "bringing friends" name list on the draft `TimePollForm` (friends
  ride along on the slots the host ticks). Manager "add a player" (name + chosen
  slots) and "remove a player I added" on the draft manage page. Friends flow into
  the session automatically at finalize if the winning slot was one they were
  marked for.
- **Out:** Per-friend availability for guest-brought friends (they ride along on
  the host's ticked slots, not their own). Bringing friends who are "coming
  regardless of the chosen time" (rejected in favour of ride-along). Notifying
  brought friends.

## Decisions (from brainstorming)

1. **Meaning in draft:** A brought friend *rides along on the host's poll votes* —
   marked available for the same slots, counted in the per-slot tallies, and
   converted to a participant at finalize only if the winning slot is one they
   were marked for. (Not "coming regardless of time".)
2. **Manager's friend slots:** The organizer *picks the slots* for each friend
   they add (casting votes on the friend's behalf), rather than auto-marking all
   slots.
3. **Edit/remove in draft:** *Both manage their own.* The guest re-submitting the
   poll form replaces their own friend list; the manager can remove any friend
   they added, from the draft manage page.

## Core problem

In a poll, a person is not a single row — they are a *set* of
`time_option_votes` (one row per slot they are available for). To support
guest *replace* and manager *per-friend remove*, each brought friend needs a
stable identity, and each vote must record who *owns* the friend.

## Data model (one manual migration)

`time_option_votes` gains owner tracking. `participant_token` stays **NOT NULL** —
brought friends use a synthetic server-generated token, so no nullability change
is needed on the votes table.

### Migration (manual — applied in the Supabase SQL editor)

```sql
alter table time_option_votes add column added_by_token text;
create index time_option_votes_added_by_idx
  on time_option_votes (session_id, added_by_token);
```

Saved to `supabase/migrations/2026-06-04-bring-a-friend-draft.sql` and folded into
canonical `supabase/schema.sql`.

### Vote kinds

| Vote kind                  | `participant_token`               | `added_by_token`        |
| -------------------------- | --------------------------------- | ----------------------- |
| Organic self-vote          | real device token                 | `NULL`                  |
| Guest-brought friend       | synthetic token (one per friend)  | host's device token     |
| Manager-added friend       | synthetic token (one per friend)  | `"manager"` (sentinel)  |

Three-way split: `NULL` = real voters; a device token = that guest's friends;
`"manager"` = organizer additions. Synthetic tokens are generated with
`generateToken()` (nanoid, 22 chars) and never collide with device UUIDs.

The `"manager"` sentinel is defined as a shared constant (e.g.
`MANAGER_OWNER = "manager"`) so the producing action and the listing query agree.

### Type change (`src/lib/types.ts`)

```ts
export interface TimeOptionVote {
  // ...existing fields...
  participant_token: string; // unchanged (synthetic for friends)
  added_by_token: string | null; // new
}
```

## Guest flow (ride-along)

- **`getMyPollFriends(guestToken, deviceToken): Promise<string[]>`** — new read
  action returning only the caller's brought-friend **names** (votes where
  `added_by_token === deviceToken`, distinct names). Returns no tokens to the
  client.
- **`TimePollForm`** gains a "Bringing friends? (optional)" dynamic name list
  (same UX as the finalized `RsvpForm`). On mount it calls `getMyPollFriends` and
  prefills the names. Friends have no slot pickers of their own — they ride along
  on the slots the host ticks.
- **`timePollVoteAction`** — after the existing own-vote handling
  (`replaceTimeOptionVotes`), it reads `formData.getAll("friend_name")`
  (normalized via `normalizePlayerNames`, max 10) and the host's selected
  `time_option_id` values, then **replaces** the host's friends:
  1. `deletePollVotesAddedBy(session.id, device_token)` — clear prior friend votes.
  2. For each friend name, generate a synthetic token and insert one vote per
     selected slot: `{ session_id, session_time_option_id, name, participant_token:
     <synthetic>, player_id: null, added_by_token: device_token }`.

  If the host ticked zero slots, no friend votes are inserted (a friend with no
  availability is simply not in the poll).

## Manager flow (pick slots, removable)

Both actions gated by the manage token; **draft + non-cancelled only** (mirror the
existing draft-action guards).

- **`addPollFriendAction(formData)`** — reads `manage_token`, one `name`, and the
  selected `time_option_id` values (validated against the session's options).
  Generates one synthetic token and inserts a vote per selected slot with
  `added_by_token = MANAGER_OWNER`. Redirects to `/m/{token}?saved=players`.
- **`removePollFriendAction(formData)`** — reads `manage_token` and a
  `friend_token` (the synthetic token), verifies the session, and calls
  `deletePollVotesByToken(session.id, friend_token)` scoped to
  `added_by_token = MANAGER_OWNER` (so it can only delete manager-added friends,
  not real voters or guest-brought friends). Redirects to `/m/{token}?saved=players`.
- **Draft manage page** gains:
  - An **"Add a player"** form (`AddPollFriendForm`, client): one name input +
    a checkbox per current time slot + submit.
  - A **"Players you've added"** list built from
    `listManagerPollFriends(session.id)` — votes where `added_by_token =
    MANAGER_OWNER`, grouped by `participant_token` into `{ friendToken, name,
    optionIds }` — each row showing the name and a Remove button.

## Finalize & display

- Friends already appear in per-slot tallies (`listSessionTimeOptions`) and voter
  lists because they are votes — no display changes needed.
- **`finalizeTimeOptionAction`** already converts the winning slot's votes into
  participants via `resolveIdentity`. Change: pass `added_by_token:
  vote.added_by_token` to `insertParticipant` for newly created participants, so a
  guest host can still manage their friends from the finalized `RsvpForm`
  (`getMyRsvp` matches friends by `added_by_token`), and manager-added friends
  remain editable via the finalized Players card. Friends ridden along only carry
  over if the winning slot was one they were marked for.

## Client token-leakage guard

`listSessionTimeOptions` uses `select("*")`, so `added_by_token` would otherwise
reach client components (`TimePollForm`, `TimePollSummary`) via `option.votes`.
Guest-brought friends carry a real host device token in that column. To avoid
widening the existing (pre-existing) exposure of `participant_token` in the poll
payload, the vote objects passed to client components must **omit
`added_by_token`** (strip it in the page, or have the client components ignore
it). Friend-name prefill goes through `getMyPollFriends` (server-side), not the
client payload.

## DB functions (`src/lib/db.ts`)

- `deletePollVotesAddedBy(sessionId, addedByToken)` — delete votes by owner (guest
  friend-replace).
- `deletePollVotesByToken(sessionId, friendToken)` — delete one friend's votes,
  scoped to `added_by_token = MANAGER_OWNER`.
- `insertTimeOptionVotes(rows)` — batch-insert friend vote rows.
- `listManagerPollFriends(sessionId)` — return manager-added friends grouped by
  synthetic token: `{ friendToken, name, optionIds }[]`.
- Existing `replaceTimeOptionVotes` (host's own votes) is unchanged.

## Testing (TDD where pure; mocked-db for actions)

- `timePollVoteAction`: inserts friend votes with synthetic tokens for the host's
  ticked slots only; calls `deletePollVotesAddedBy` first; normalizes/dedupes
  friend names; inserts nothing when no slots ticked.
- `addPollFriendAction`: manager gating (draft + non-cancelled), inserts one vote
  per selected slot with `MANAGER_OWNER`; ignores option ids not belonging to the
  session.
- `removePollFriendAction`: deletes by friend token scoped to `MANAGER_OWNER`;
  gated by manage token.
- `getMyPollFriends`: returns distinct names only, no tokens, for the caller's
  `added_by_token`.
- `finalizeTimeOptionAction`: a ridden-along friend on the winning slot becomes a
  participant with `added_by_token` carried.
- `npm run test`, `npx tsc --noEmit`, `npm run build` all pass.

## Known, accepted edges

- **Name-merge at finalize:** `resolveIdentity` falls back to name matching;
  inherited from the existing design, unchanged.
- **Guest/manager asymmetry:** guests bring friends as a name list (ride-along on
  ticked slots); the manager adds one friend at a time with explicit slots.
  Intentional, per the brainstorming answers.
- **Tally nudge:** a brought friend increases the count on each slot they are
  marked for — intended (they are genuinely available for those slots).

## Hard-rule compliance

- Service-role `db.ts` stays server-only; `getMyPollFriends` returns no tokens;
  client vote payloads omit `added_by_token`. Guest pages never render manage or
  other devices' tokens.
- Standard Next.js Node runtime, standard Postgres — vendor-portable.
- New pure logic (`normalizePlayerNames`) is already covered; action logic is
  tested in the mocked-db style.
