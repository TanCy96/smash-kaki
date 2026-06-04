# Bring-a-friend — add players to a session

**Date:** 2026-06-04
**Status:** Approved design, pre-implementation

## Goal

Let a guest bring along one or more friends when they RSVP, and let the
organizer add players directly from the manage page. Brought-along friends and
manager-added players are named entries that have no device or login of their
own, yet count toward the **Going** list, **attendance verification**, and the
**cost split** like any other participant.

## Scope

- **In:** Guest "bringing friends" section on the RSVP form (owned by the host,
  editable on re-submit). Manager "add players" + "remove player" on the manage
  page. Both apply to **finalized** sessions only.
- **Out:** Friends with their own RSVP status (friends are always `going`),
  per-friend device identity, adding players to a draft/poll session,
  invitations or notifications.

## Decisions (from brainstorming)

1. **Scenario:** Bring-a-friend. One person RSVPs and adds friends who lack the
   link/device.
2. **Linkage:** Friends are *owned by the host* — attached to the host's device,
   editable when the host re-submits, removed if the host row is deleted.
3. **Per-friend detail:** A name each (own Going entry, individually verifiable),
   not a head count.
4. **Placement:** Guest RSVP form **and** a manage-page add/remove control.
5. **Edit model:** Approach A — the RSVP form fetches the host's current row and
   friends on mount, prefills them, and submit *replaces* the host-owned set.

## Data model

`participants` must hold entries with no device of their own.

### Migration (manual — applied in Supabase SQL editor)

```sql
alter table participants alter column participant_token drop not null;
alter table participants add column added_by_token text;
create index participants_added_by_idx on participants (session_id, added_by_token);
```

Saved to `supabase/migrations/2026-06-04-bring-a-friend.sql` and folded into the
canonical `supabase/schema.sql`.

### Entry kinds

| Kind            | `participant_token` | `added_by_token`   | `player_id` | `rsvp`  |
| --------------- | ------------------- | ------------------ | ----------- | ------- |
| Self-RSVP       | set                 | NULL               | maybe       | any     |
| Brought friend  | NULL                | host's device token| NULL        | `going` |
| Manager-added   | NULL                | NULL               | NULL        | `going` |

All friend/manager entries start `attended = false`.

### Type changes (`src/lib/types.ts`)

```ts
export interface Participant {
  // ...existing fields...
  participant_token: string | null; // was string
  added_by_token: string | null;    // new
}
```

## Guest flow (Approach A)

- **New read action `getMyRsvp(guestToken, deviceToken)`** — returns only the
  caller's own `{ name, rsvp }` (resolved by `player_id` then `participant_token`)
  and the **names** of their friends (`added_by_token === deviceToken`). It must
  never return any other participant's token or another caller's data. Computed
  server-side from `listParticipants`; only the safe subset is returned.
- **`RsvpForm` becomes identity-aware.** On mount it reads the device token,
  calls `getMyRsvp`, and prefills the host's name, status, and friend rows. A new
  **"Bringing friends? (optional)"** dynamic list renders friend-name inputs with
  an "+ Add another" button and a ✕ per row.
- **`rsvpAction` extended.** After the existing host upsert, it reads the
  submitted friend names (`formData.getAll("friend_name")`), normalizes them, and
  **replaces** the host-owned friend set: delete
  `where session_id = X and added_by_token = deviceToken`, then re-insert.
  The host's own row has `added_by_token = NULL`, so the replace never touches it.

## Manager flow

- **`addPlayersAction(formData)`** — gated by manage token; finalized sessions
  only. Inserts each normalized name as a manager-added `going` entry
  (`participant_token = null`, `added_by_token = null`, `player_id = null`).
- **`removeParticipantAction(formData)`** — gated by manage token. Deletes one
  participant by id after verifying it belongs to this session. Works for any
  participant, which also closes the current gap (no way to remove anyone from
  `/m/`).
- **Manage page (finalized) "Players" card** — an `AddPlayersForm` (dynamic name
  rows) plus the roster list with a ✕ remove on each row. The existing **Verify
  attendance** and **Cost** cards are unchanged and automatically include the new
  people.

## DB functions (`src/lib/db.ts`)

- Update `insertParticipant` to accept `participant_token: string | null` and a
  new `added_by_token: string | null`.
- `listParticipants` select includes `added_by_token` (via `select("*")`).
- New `deleteParticipant(id, sessionId)` — delete by id scoped to session.
- New `deleteGuestsOf(sessionId, addedByToken)` — delete the host's friend rows
  (used by the replace step in `rsvpAction`).

## Shared rules

- **Friends are always `going`.**
- **Name normalization** (`normalizePlayerNames`): trim, drop blanks, dedupe
  case-insensitively within the submission, cap at **10 per submit**.
- Forms are hidden/disabled when the session is `cancelled`, consistent with
  existing forms.
- **Known, accepted edge:** `resolveIdentity` matches by name as a last resort.
  If a real person later RSVPs with the exact name of a brought friend, the rows
  merge into one (the friend row gains the new device/login). Acceptable for a
  casual app; not fixed.

## Testing (TDD for pure logic, per AGENTS.md)

- **New pure module `src/lib/players.ts`** → `normalizePlayerNames(raw, { max })`.
  Write the failing Vitest test first (trim, drop-empty, dedupe, cap, ordering),
  then implement.
- Extend `src/app/actions.test.ts` to cover the friend-replace path in
  `rsvpAction` and the `addPlayersAction` / `removeParticipantAction` paths, in
  the existing mocked-`db` style.
- `npm run build`, `npx tsc --noEmit`, and `npm run test` must all pass.

## Out of scope / future

- Friends choosing their own going/maybe/can't.
- Adding players to draft/poll sessions.
- Notifying brought friends or generating per-friend links.

## Hard-rule compliance

- Service-role `db.ts` stays server-only; `getMyRsvp` returns no tokens to the
  client. Guest pages never render manage or other devices' tokens.
- Standard Next.js Node runtime, standard Postgres — vendor-portable.
- TDD for the new pure logic module.
