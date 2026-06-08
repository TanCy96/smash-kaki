# My Sessions Recovery — Design

**Date:** 2026-06-08
**Status:** Approved, ready for plan

## Problem

A session is controlled entirely by its secret `manage_token`, and a guest sees
it via `guest_token`. If a logged-in user loses one of these links, there is no
way to get it back — sessions have no association with a user account. The only
existing account link is `participants.player_id` (and `time_option_votes.player_id`),
set when a logged-in user RSVPs or votes.

## Goal

Give logged-in users a **"My sessions"** page that recovers the links for:

- **Sessions they organize** — recover the *manage* link.
- **Sessions they joined** (RSVP'd to, or voted in a poll) — recover the *guest* link.

Scope is **active (non-cancelled) sessions only**, grouped into two sections.

## Data model

Add an owner column to `sessions` (applied manually in the Supabase SQL editor):

```sql
alter table sessions
  add column manager_id uuid references profiles(id) on delete set null;

create index sessions_manager_idx on sessions (manager_id);
```

- Nullable. `on delete set null` keeps sessions alive if the owner account is deleted.
- Set in `createSessionAction` to `currentPlayerId()` (already fetched there for the
  organizer's poll vote). Anonymous creators → `null`, behavior unchanged.
- **Existing sessions** stay `manager_id = null` and cannot be backfilled (no account
  link exists). They won't appear under "Organizing" for their creators. Accepted.

No other table changes. "Joined" reuses existing `player_id` columns.

## Queries (`src/lib/db.ts`)

- `listSessionsManagedBy(playerId)` → `sessions` where `manager_id = playerId` and
  `status = 'active'`, ordered `created_at desc`.
- `listSessionsJoinedBy(playerId)` → active sessions where the user appears as a
  **participant** (`participants.player_id = playerId`) **or** a **poll voter**
  (`time_option_votes.player_id = playerId`), **minus** sessions they manage (so a
  session never shows in both sections). Ordered `created_at desc`, de-duplicated by
  session id. Including poll voters means a draft poll the user voted in still recovers
  its guest link.

## Page `/sessions`

New server component at `src/app/sessions/page.tsx`.

- Resolve `currentPlayerId()`. If `null` → `redirect("/login")`.
- Renders inside `PageShell` with `<AuthNav />`, consistent with other pages.
- **Organizing** section: for each managed session — title, `Poll`/`Confirmed`
  badge, date (if finalized) + location, a link to `/m/{manage_token}`, and a
  `CopyLinkButton` for the manage URL. Empty state: "You're not organizing any
  active sessions yet."
- **Joined** section: same row layout, linking to `/s/{guest_token}` with a copy
  button for the guest URL. Empty state: "You haven't joined any active sessions yet."
- URLs built from `NEXT_PUBLIC_BASE_URL`, matching the manage page's `ShareLinks`.

## Nav

`AuthNav`: when `playerId` is set, add a **"My sessions"** link (to `/sessions`)
alongside the signed-in name / log-out control.

## Auth / deployment notes

- `/sessions` is an ordinary authenticated route, **not** an auth callback. It does
  **not** need to be added to Supabase's redirect-URL allowlist (that list only governs
  post-auth redirects like `/auth/callback`, `/update-password`). No Vercel config change.
- Logged-out access is handled by an internal `redirect("/login")`. (Login currently
  always returns to `/`; redirecting back to `/sessions` after login is out of scope.)

## Testing

- `db.test.ts`: `listSessionsManagedBy` filters by owner + active; `listSessionsJoinedBy`
  unions participant and poll-voter sources, de-dupes, excludes managed, filters active.
- `actions.test.ts`: `createSessionAction` sets `manager_id` to the current player when
  logged in, and `null` when anonymous.

## Out of scope (YAGNI)

- Backfilling `manager_id` on existing sessions.
- A past/cancelled archive or collapsed history view.
- "Recently visited" tracking for pages the user neither created nor joined.
- Redirecting back to `/sessions` after login.
