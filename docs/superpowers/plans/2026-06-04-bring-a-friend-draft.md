# Bring Friends During Draft/Poll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a guest bring friends while voting in a poll (ride-along on the host's ticked slots), and let the organizer add/remove players on the draft manage page — before the session is finalized.

**Architecture:** Brought friends become `time_option_votes` rows with a synthetic per-friend `participant_token`; a new `added_by_token` column records the owner (host device token for guest-brought friends, the `"manager"` sentinel for organizer-added). Guests replace their whole friend set on re-submit; the manager adds/removes individual friends. The existing vote→participant finalize pipeline carries them into the session unchanged (plus `added_by_token` propagation).

**Tech Stack:** Next.js 15 App Router (server actions), TypeScript, Supabase (service-role server-side), zod, Vitest.

---

## File structure

- `supabase/migrations/2026-06-04-bring-a-friend-draft.sql` — **create** — manual DDL (add `added_by_token` to votes).
- `supabase/schema.sql` — **modify** — fold column + index into canonical schema.
- `src/lib/types.ts` — **modify** — `TimeOptionVote.added_by_token`.
- `src/lib/time-poll.ts` — **modify** — export `MANAGER_OWNER` constant.
- `src/lib/db.ts` — **modify** — `deletePollVotesAddedBy`, `deletePollVotesByToken`, `insertTimeOptionVotes`, `listManagerPollFriends`; import `MANAGER_OWNER`.
- `src/app/actions.ts` — **modify** — `getMyPollFriends`; friend-replace in `timePollVoteAction`; `addPollFriendAction`, `removePollFriendAction`; `added_by_token` carry in `finalizeTimeOptionAction`.
- `src/app/actions.test.ts` — **modify** — tests for the above (+ update the existing finalize test).
- `src/components/TimePollForm.tsx` — **modify** — friends name list + prefill.
- `src/app/s/[guestToken]/page.tsx` — **modify** — strip `added_by_token` from client vote payload.
- `src/app/m/[manageToken]/page.tsx` — **modify** — draft "Add a player" form + "Players you've added" list (inline server forms).

---

## Task 1: Migration, schema, type, and `MANAGER_OWNER` constant

**Files:**
- Create: `supabase/migrations/2026-06-04-bring-a-friend-draft.sql`
- Modify: `supabase/schema.sql`
- Modify: `src/lib/types.ts` (`TimeOptionVote`)
- Modify: `src/lib/time-poll.ts`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/2026-06-04-bring-a-friend-draft.sql`:

```sql
-- Bring friends during a draft/poll: brought friends are votes owned by someone.
-- Owner is the host's device token (guest-brought) or the literal 'manager'.
alter table time_option_votes add column added_by_token text;
create index time_option_votes_added_by_idx
  on time_option_votes (session_id, added_by_token);
```

- [ ] **Step 2: Update the canonical schema**

In `supabase/schema.sql`, in the `create table time_option_votes (...)` block, add `added_by_token text,` immediately after the `player_id ...` line. The block becomes:

```sql
create table time_option_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  session_time_option_id uuid not null,
  name text not null,
  participant_token text not null,
  player_id uuid references profiles(id) on delete set null,
  added_by_token text,
  created_at timestamptz not null default now(),
  foreign key (session_time_option_id, session_id)
    references session_time_options(id, session_id)
    on delete cascade
);
```

Then add this index next to the other `time_option_votes_*_idx` index lines:

```sql
create index time_option_votes_added_by_idx on time_option_votes (session_id, added_by_token);
```

- [ ] **Step 3: Update the `TimeOptionVote` type**

In `src/lib/types.ts`, the `TimeOptionVote` interface currently is:

```ts
export interface TimeOptionVote {
  id: string;
  session_id: string;
  session_time_option_id: string;
  name: string;
  participant_token: string;
  player_id: string | null;
  created_at: string;
}
```

Add `added_by_token: string | null;` after `player_id`:

```ts
export interface TimeOptionVote {
  id: string;
  session_id: string;
  session_time_option_id: string;
  name: string;
  participant_token: string;
  player_id: string | null;
  added_by_token: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Add the `MANAGER_OWNER` constant**

At the top of `src/lib/time-poll.ts` (before `export type PollVoteIdentity`), add:

```ts
/** Sentinel stored in time_option_votes.added_by_token for organizer-added poll friends. */
export const MANAGER_OWNER = "manager";
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. (If anything errors on the new required `added_by_token` field in a test fixture, that fixture is updated in the task that owns it — but `tsc` should pass since reads only widen.)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/2026-06-04-bring-a-friend-draft.sql supabase/schema.sql src/lib/types.ts src/lib/time-poll.ts
git commit -m "feat(db): add added_by_token to votes + MANAGER_OWNER for draft friends"
```

- [ ] **Step 7: Apply the migration in Supabase (USER STEP)**

The user runs `supabase/migrations/2026-06-04-bring-a-friend-draft.sql` in the Supabase dashboard SQL editor. Do not attempt DDL from code. Pause and confirm it is applied before runtime smoke-testing the write paths.

---

## Task 2: DB functions for poll-friend votes

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Import the `MANAGER_OWNER` constant**

`src/lib/db.ts` currently has `import type { PollVoteIdentity } from "./time-poll";`. Add a value import directly below it:

```ts
import { MANAGER_OWNER } from "./time-poll";
```

- [ ] **Step 2: Add the four functions**

Append these to `src/lib/db.ts` (anywhere among the other exported functions, e.g. after `replaceTimeOptionVotes`):

```ts
export async function deletePollVotesAddedBy(
  sessionId: string,
  addedByToken: string
): Promise<void> {
  const { error } = await admin
    .from("time_option_votes")
    .delete()
    .eq("session_id", sessionId)
    .eq("added_by_token", addedByToken);
  if (error) throw error;
}

export async function deletePollVotesByToken(
  sessionId: string,
  friendToken: string
): Promise<void> {
  const { error } = await admin
    .from("time_option_votes")
    .delete()
    .eq("session_id", sessionId)
    .eq("participant_token", friendToken)
    .eq("added_by_token", MANAGER_OWNER);
  if (error) throw error;
}

export async function insertTimeOptionVotes(
  rows: {
    session_id: string;
    session_time_option_id: string;
    name: string;
    participant_token: string;
    player_id: string | null;
    added_by_token: string | null;
  }[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await admin.from("time_option_votes").insert(rows);
  if (error) throw error;
}

export async function listManagerPollFriends(
  sessionId: string
): Promise<{ friendToken: string; name: string; optionIds: string[] }[]> {
  const { data, error } = await admin
    .from("time_option_votes")
    .select("session_time_option_id, name, participant_token")
    .eq("session_id", sessionId)
    .eq("added_by_token", MANAGER_OWNER)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows =
    (data as {
      session_time_option_id: string;
      name: string;
      participant_token: string;
    }[]) ?? [];

  const byToken = new Map<
    string,
    { friendToken: string; name: string; optionIds: string[] }
  >();
  for (const row of rows) {
    const existing = byToken.get(row.participant_token);
    if (existing) {
      existing.optionIds.push(row.session_time_option_id);
    } else {
      byToken.set(row.participant_token, {
        friendToken: row.participant_token,
        name: row.name,
        optionIds: [row.session_time_option_id],
      });
    }
  }
  return [...byToken.values()];
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(db): poll-friend vote insert/delete/list helpers"
```

---

## Task 3: `getMyPollFriends` + friend-replace in `timePollVoteAction`

**Files:**
- Modify: `src/app/actions.ts`
- Modify: `src/app/actions.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/app/actions.test.ts`:

(a) Add a hoisted mock for `generateToken` near the other `vi.hoisted` mocks at the top:

```ts
const generateTokenMock = vi.hoisted(() => vi.fn());
```

(b) Add the module mock alongside the other `vi.mock(...)` calls:

```ts
vi.mock("@/lib/tokens", () => ({
  generateToken: generateTokenMock,
}));
```

(c) Add `deletePollVotesAddedBy: vi.fn(),` and `insertTimeOptionVotes: vi.fn(),` to the hoisted `dbMock` object.

(d) In the existing `describe("timePollVoteAction", ...)` `beforeEach`, add:

```ts
    dbMock.deletePollVotesAddedBy.mockReset();
    dbMock.insertTimeOptionVotes.mockReset();
    generateTokenMock.mockReset();
```

(e) Add this test inside the `describe("timePollVoteAction", ...)` block:

```ts
  it("creates ride-along friend votes on the host's selected slots", async () => {
    const { timePollVoteAction } = await import("./actions");
    generateTokenMock.mockReturnValueOnce("ft-1").mockReturnValueOnce("ft-2");

    const formData = new FormData();
    formData.set("guest_token", "guest-1");
    formData.set("name", "Alex");
    formData.set("device_token", "device-1");
    formData.append("time_option_id", "option-2");
    formData.append("friend_name", " Ali ");
    formData.append("friend_name", "Siti");

    dbMock.getSessionByGuestToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.listSessionTimeOptions.mockResolvedValue([
      { id: "option-1", votes: [] },
      { id: "option-2", votes: [] },
    ]);
    dbMock.listTimePollVoters.mockResolvedValue([]);
    dbMock.replaceTimeOptionVotes.mockResolvedValue(undefined);
    dbMock.deletePollVotesAddedBy.mockResolvedValue(undefined);
    dbMock.insertTimeOptionVotes.mockResolvedValue(undefined);
    currentPlayerIdMock.mockResolvedValue(null);

    await expect(timePollVoteAction(formData)).rejects.toThrow(
      "redirect:/s/guest-1?submitted=1"
    );

    expect(dbMock.deletePollVotesAddedBy).toHaveBeenCalledWith(
      "session-1",
      "device-1"
    );
    expect(dbMock.insertTimeOptionVotes).toHaveBeenCalledWith([
      {
        session_id: "session-1",
        session_time_option_id: "option-2",
        name: "Ali",
        participant_token: "ft-1",
        player_id: null,
        added_by_token: "device-1",
      },
      {
        session_id: "session-1",
        session_time_option_id: "option-2",
        name: "Siti",
        participant_token: "ft-2",
        player_id: null,
        added_by_token: "device-1",
      },
    ]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/actions.test.ts -t "ride-along friend votes"`
Expected: FAIL — `deletePollVotesAddedBy` not called / not a function.

- [ ] **Step 3: Implement**

In `src/app/actions.ts`:

(a) The imports already include `generateToken` (from `@/lib/tokens`), `normalizePlayerNames`, `selectedOptionIds`, `db`. No new imports needed for this step.

(b) In `timePollVoteAction`, after the existing `await db.replaceTimeOptionVotes({ ... });` call and **before** the `revalidatePath(`/s/${value.guest_token}`);` line, insert the friend-replace block. Note `optionIds` is already computed earlier in this action:

```ts
  const friendNames = normalizePlayerNames(
    formData.getAll("friend_name").map(String),
    { max: 10 }
  );

  await db.deletePollVotesAddedBy(session.id, value.device_token);

  if (optionIds.length > 0 && friendNames.length > 0) {
    const rows = friendNames.flatMap((friendName) => {
      const friendToken = generateToken();
      return optionIds.map((optionId) => ({
        session_id: session.id,
        session_time_option_id: optionId,
        name: friendName,
        participant_token: friendToken,
        player_id: null,
        added_by_token: value.device_token,
      }));
    });
    await db.insertTimeOptionVotes(rows);
  }
```

(c) Add the read action directly after `timePollVoteAction`:

```ts
export async function getMyPollFriends(
  guestToken: string,
  deviceToken: string
): Promise<string[]> {
  const session = await db.getSessionByGuestToken(guestToken);
  if (!session) return [];

  const options = await db.listSessionTimeOptions(session.id);
  const names: string[] = [];
  const seen = new Set<string>();
  for (const option of options) {
    for (const vote of option.votes) {
      if (vote.added_by_token === deviceToken && !seen.has(vote.participant_token)) {
        seen.add(vote.participant_token);
        names.push(vote.name);
      }
    }
  }
  return names;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/actions.test.ts -t "ride-along friend votes"`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run src/app/actions.test.ts`
Expected: PASS (existing tests unaffected — the existing `timePollVoteAction` test has no `friend_name`, so `insertTimeOptionVotes` is never called; `deletePollVotesAddedBy` is called and is a harmless no-op mock).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions.ts src/app/actions.test.ts
git commit -m "feat: ride-along poll friends in timePollVoteAction + getMyPollFriends"
```

---

## Task 4: `TimePollForm` friends UI + guest-page token strip

**Files:**
- Modify: `src/components/TimePollForm.tsx`
- Modify: `src/app/s/[guestToken]/page.tsx`

- [ ] **Step 1: Add the friends UI and prefill to `TimePollForm`**

Replace the entire contents of `src/components/TimePollForm.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getMyPollFriends, timePollVoteAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";
import { formatMalaysiaDateTime } from "@/lib/datetime";
import type { SessionTimeOptionWithVotes } from "@/lib/types";
import { deviceToken } from "./device-token";

export function TimePollForm({
  guestToken,
  options,
  disabled,
}: {
  guestToken: string;
  options: SessionTimeOptionWithVotes[];
  disabled: boolean;
}) {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<string[]>([]);

  // On load, recognise a returning guest by their device token and prefill
  // their previous name, ticked availability, and brought-friend names.
  useEffect(() => {
    const current = deviceToken();
    setToken(current);

    const mine = options.filter((option) =>
      option.votes.some((vote) => vote.participant_token === current)
    );
    if (mine.length > 0) {
      setChecked(new Set(mine.map((option) => option.id)));
      const priorName = mine
        .flatMap((option) => option.votes)
        .find((vote) => vote.participant_token === current)?.name;
      if (priorName) setName(priorName);
    }

    getMyPollFriends(guestToken, current).then((names) => {
      if (names.length > 0) setFriends(names);
    });
    // Runs once on mount; options is stable for the mounted form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (disabled) {
    return <p className="text-sm text-muted">Voting closed.</p>;
  }

  return (
    <form action={timePollVoteAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <Field label="Your name">
        <Input
          name="name"
          placeholder="Alex"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm text-ink"
          >
            <input
              name="time_option_id"
              type="checkbox"
              value={option.id}
              checked={checked.has(option.id)}
              onChange={() => toggle(option.id)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-heading">
                {formatMalaysiaDateTime(option.starts_at)}
              </span>
              <span className="block text-muted">{option.duration_min} min</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">
          Bringing friends? (optional) They&apos;ll join for the times you tick.
        </p>
        {friends.map((friend, index) => (
          <div key={index} className="flex gap-2">
            <Input
              name="friend_name"
              placeholder="Friend's name"
              value={friend}
              onChange={(e) =>
                setFriends((prev) =>
                  prev.map((value, i) => (i === index ? e.target.value : value))
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setFriends((prev) => prev.filter((_, i) => i !== index))
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setFriends((prev) => [...prev, ""])}
        >
          + Add another
        </Button>
      </div>

      <Button disabled={!token}>Save availability</Button>
    </form>
  );
}
```

- [ ] **Step 2: Strip `added_by_token` from the client vote payload on the guest page**

In `src/app/s/[guestToken]/page.tsx`, in the `if (session.lifecycle === "draft")` branch, the line is currently:

```tsx
    const options = await listSessionTimeOptions(session.id);
```

Add a sanitized copy immediately below it:

```tsx
    const clientOptions = options.map((option) => ({
      ...option,
      votes: option.votes.map((vote) => ({ ...vote, added_by_token: null })),
    }));
```

Then change the two consumers in that branch to use `clientOptions`:
- `<TimePollForm guestToken={guestToken} options={clientOptions} disabled={...} />`
- `<TimePollSummary options={clientOptions} />`

(Leave the server-side `options` variable name elsewhere untouched; only those two props change.)

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (confirms `getMyPollFriends` is callable from the client component and no server-only import leaks).

- [ ] **Step 4: Commit**

```bash
git add src/components/TimePollForm.tsx "src/app/s/[guestToken]/page.tsx"
git commit -m "feat(ui): bring-a-friend section on the poll form; strip owner token from client"
```

---

## Task 5: Manager poll-friend actions

**Files:**
- Modify: `src/app/actions.ts`
- Modify: `src/app/actions.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/app/actions.test.ts`:

(a) Add `deletePollVotesByToken: vi.fn(),` to the hoisted `dbMock` object. (`insertTimeOptionVotes` was already added in Task 3.)

(b) Append these two describe blocks at the END of the file:

```ts
describe("addPollFriendAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.listSessionTimeOptions.mockReset();
    dbMock.insertTimeOptionVotes.mockReset();
    generateTokenMock.mockReset();
  });

  it("inserts one manager-owned vote per selected slot", async () => {
    const { addPollFriendAction } = await import("./actions");
    generateTokenMock.mockReturnValue("mft-1");

    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("name", " Bob ");
    formData.append("time_option_id", "option-1");
    formData.append("time_option_id", "option-2");
    formData.append("time_option_id", "bogus");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.listSessionTimeOptions.mockResolvedValue([
      { id: "option-1", votes: [] },
      { id: "option-2", votes: [] },
    ]);
    dbMock.insertTimeOptionVotes.mockResolvedValue(undefined);

    await expect(addPollFriendAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=players"
    );

    expect(dbMock.insertTimeOptionVotes).toHaveBeenCalledWith([
      {
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Bob",
        participant_token: "mft-1",
        player_id: null,
        added_by_token: "manager",
      },
      {
        session_id: "session-1",
        session_time_option_id: "option-2",
        name: "Bob",
        participant_token: "mft-1",
        player_id: null,
        added_by_token: "manager",
      },
    ]);
  });

  it("redirects without inserting when the session is not a draft", async () => {
    const { addPollFriendAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("name", "Bob");
    formData.append("time_option_id", "option-1");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "finalized",
    });

    await expect(addPollFriendAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1"
    );

    expect(dbMock.insertTimeOptionVotes).not.toHaveBeenCalled();
  });
});

describe("removePollFriendAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.deletePollVotesByToken.mockReset();
  });

  it("deletes the friend's votes by their synthetic token", async () => {
    const { removePollFriendAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("friend_token", "mft-1");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.deletePollVotesByToken.mockResolvedValue(undefined);

    await expect(removePollFriendAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=players"
    );

    expect(dbMock.deletePollVotesByToken).toHaveBeenCalledWith(
      "session-1",
      "mft-1"
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/actions.test.ts -t "manager-owned vote"`
Expected: FAIL — `addPollFriendAction` is not exported.

- [ ] **Step 3: Implement the two actions**

In `src/app/actions.ts`, add a value import for `MANAGER_OWNER` to the existing `@/lib/time-poll` import. The import currently reads:

```ts
import {
  malaysiaDateTimeLocalToIso,
  resolvePollVoter,
  selectedOptionIds,
} from "@/lib/time-poll";
```

Change it to:

```ts
import {
  malaysiaDateTimeLocalToIso,
  MANAGER_OWNER,
  resolvePollVoter,
  selectedOptionIds,
} from "@/lib/time-poll";
```

Then append the two actions to `src/app/actions.ts`:

```ts
export async function addPollFriendAction(formData: FormData) {
  const manageToken = String(formData.get("manage_token"));
  const name = String(formData.get("name") ?? "").trim();
  const session = await db.getSessionByManageToken(manageToken);
  if (
    !session ||
    session.status === "cancelled" ||
    session.lifecycle !== "draft"
  ) {
    redirect(`/m/${manageToken}`);
  }

  const options = await db.listSessionTimeOptions(session.id);
  const optionIds = selectedOptionIds(
    formData.getAll("time_option_id").map(String),
    options.map((option) => option.id)
  );

  if (name && optionIds.length > 0) {
    const friendToken = generateToken();
    await db.insertTimeOptionVotes(
      optionIds.map((optionId) => ({
        session_id: session.id,
        session_time_option_id: optionId,
        name,
        participant_token: friendToken,
        player_id: null,
        added_by_token: MANAGER_OWNER,
      }))
    );
  }

  revalidatePath(`/m/${manageToken}`);
  revalidatePath(`/s/${session.guest_token}`);
  redirect(`/m/${manageToken}?saved=players`);
}

export async function removePollFriendAction(formData: FormData) {
  const manageToken = String(formData.get("manage_token"));
  const friendToken = String(formData.get("friend_token"));
  const session = await db.getSessionByManageToken(manageToken);
  if (
    !session ||
    session.status === "cancelled" ||
    session.lifecycle !== "draft"
  ) {
    redirect(`/m/${manageToken}`);
  }

  await db.deletePollVotesByToken(session.id, friendToken);

  revalidatePath(`/m/${manageToken}`);
  revalidatePath(`/s/${session.guest_token}`);
  redirect(`/m/${manageToken}?saved=players`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/actions.test.ts`
Expected: PASS (all suites).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts src/app/actions.test.ts
git commit -m "feat: addPollFriendAction and removePollFriendAction"
```

---

## Task 6: Draft manage page — Add a player + Players you've added

**Files:**
- Modify: `src/app/m/[manageToken]/page.tsx`

- [ ] **Step 1: Wire imports**

In `src/app/m/[manageToken]/page.tsx`, update the actions import (currently `cancelSessionAction, editSessionAction, removeParticipantAction`) to also include the two new actions:

```tsx
import {
  addPollFriendAction,
  cancelSessionAction,
  editSessionAction,
  removeParticipantAction,
  removePollFriendAction,
} from "@/app/actions";
```

Add `listManagerPollFriends` to the `@/lib/db` import (which currently imports `getSessionByManageToken, listParticipants, listSessionTimeOptions`):

```tsx
import {
  getSessionByManageToken,
  listManagerPollFriends,
  listParticipants,
  listSessionTimeOptions,
} from "@/lib/db";
```

- [ ] **Step 2: Load manager friends in the draft branch**

In the `if (session.lifecycle === "draft")` branch, the line is currently:

```tsx
    const options = await listSessionTimeOptions(session.id);
```

Add below it:

```tsx
    const managerFriends = await listManagerPollFriends(session.id);
```

- [ ] **Step 3: Add the two cards to the draft branch**

In the draft branch's returned JSX, immediately AFTER the existing `<Card title="Current preferences"> ... </Card>` (the one rendering the options/votes list) and before the closing `</PageShell>`, insert:

```tsx
        {managerFriends.length > 0 && (
          <Card title="Players you've added">
            <ul className="flex flex-col gap-2">
              {managerFriends.map((friend) => (
                <li
                  key={friend.friendToken}
                  className="flex items-center justify-between gap-2 text-sm text-ink"
                >
                  <span>
                    {friend.name}{" "}
                    <span className="text-xs text-muted">
                      ({friend.optionIds.length} slot
                      {friend.optionIds.length === 1 ? "" : "s"})
                    </span>
                  </span>
                  {!cancelled && (
                    <form action={removePollFriendAction}>
                      <input type="hidden" name="manage_token" value={manageToken} />
                      <input type="hidden" name="friend_token" value={friend.friendToken} />
                      <Button variant="ghost">Remove</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {!cancelled && (
          <Card title="Add a player">
            <form action={addPollFriendAction} className="flex flex-col gap-3">
              <input type="hidden" name="manage_token" value={manageToken} />
              <Field label="Player's name">
                <Input name="name" placeholder="Player's name" required />
              </Field>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-ink">Available for</p>
                {options.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      name="time_option_id"
                      value={option.id}
                      className="size-4 rounded border-border text-primary"
                    />
                    {formatMalaysiaDateTime(option.starts_at)} ({option.duration_min} min)
                  </label>
                ))}
              </div>
              <Button>Add player</Button>
            </form>
          </Card>
        )}
```

(`Card`, `Button`, `Field`, `Input`, and `formatMalaysiaDateTime` are already imported in this file. `cancelled` and `manageToken` are already in scope in this branch.)

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/m/[manageToken]/page.tsx"
git commit -m "feat(ui): draft manage page add/remove poll players"
```

---

## Task 7: Carry `added_by_token` through finalize

**Files:**
- Modify: `src/app/actions.ts` (`finalizeTimeOptionAction`)
- Modify: `src/app/actions.test.ts` (update existing finalize test + add one)

- [ ] **Step 1: Update the existing finalize test and add a friend-carry test**

In `src/app/actions.test.ts`, in the `describe("finalizeTimeOptionAction", ...)` block:

(a) In the existing test ("finalizes a draft option and avoids duplicate participants from matching votes"), add `added_by_token: null,` to BOTH vote objects in the `listVotesForTimeOption.mockResolvedValue([...])`, and add `added_by_token: null,` to the expected `insertParticipant` call object. After editing, the first vote and the expected insert look like:

```ts
      {
        id: "vote-1",
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Alex",
        participant_token: "device-1",
        player_id: null,
        added_by_token: null,
      },
```

```ts
    expect(dbMock.insertParticipant).toHaveBeenCalledWith({
      session_id: "session-1",
      name: "Alex",
      rsvp: "going",
      participant_token: "device-1",
      player_id: null,
      added_by_token: null,
    });
```

(b) Add this new test to the same describe block:

```ts
  it("carries added_by_token when a ride-along friend wins", async () => {
    const { finalizeTimeOptionAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("time_option_id", "option-1");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "draft",
    });
    dbMock.getSessionTimeOption.mockResolvedValue({
      id: "option-1",
      session_id: "session-1",
      starts_at: "2026-06-03T12:00:00.000Z",
      duration_min: 120,
    });
    dbMock.listVotesForTimeOption.mockResolvedValue([
      {
        id: "vote-9",
        session_id: "session-1",
        session_time_option_id: "option-1",
        name: "Ali",
        participant_token: "ft-1",
        player_id: null,
        added_by_token: "device-1",
      },
    ]);
    dbMock.listParticipants.mockResolvedValue([]);
    dbMock.insertParticipant.mockResolvedValue({ id: "participant-9" });
    dbMock.updateParticipant.mockResolvedValue(undefined);
    dbMock.updateSessionDetails.mockResolvedValue(undefined);

    await expect(finalizeTimeOptionAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=finalized"
    );

    expect(dbMock.insertParticipant).toHaveBeenCalledWith({
      session_id: "session-1",
      name: "Ali",
      rsvp: "going",
      participant_token: "ft-1",
      player_id: null,
      added_by_token: "device-1",
    });
  });
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `npx vitest run src/app/actions.test.ts -t "carries added_by_token"`
Expected: FAIL — `insertParticipant` called without `added_by_token`.

- [ ] **Step 3: Implement**

In `src/app/actions.ts`, in `finalizeTimeOptionAction`, the `insertParticipant` call inside the `if (match.kind === "new")` branch currently is:

```ts
      const inserted = await db.insertParticipant({
        session_id: session.id,
        name: vote.name,
        rsvp: "going",
        participant_token: vote.participant_token,
        player_id: vote.player_id,
      });
```

Add `added_by_token: vote.added_by_token,`:

```ts
      const inserted = await db.insertParticipant({
        session_id: session.id,
        name: vote.name,
        rsvp: "going",
        participant_token: vote.participant_token,
        player_id: vote.player_id,
        added_by_token: vote.added_by_token,
      });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/actions.test.ts`
Expected: PASS (the updated existing finalize test and the new one both green).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts src/app/actions.test.ts
git commit -m "feat: carry added_by_token from winning votes into participants"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: PASS — all Vitest suites green.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test (requires BOTH migrations applied)**

Run `npm run dev`, then:
1. Create a poll session (draft, ≥2 time options).
2. As a guest, tick one slot, enter name "Alex", add friends "Ali" and "Siti", save. Confirm "Ali" and "Siti" appear under that slot in Current preferences, and the slot count rises by 3.
3. Reload the guest page → confirm the form prefills name, the ticked slot, and the two friend names.
4. Remove "Siti" in the form and re-save → confirm Siti disappears from the slot.
5. On the draft manage page, add a player "Bob" available for one slot → confirm Bob appears under that slot and in "Players you've added".
6. Remove "Bob" from "Players you've added" → confirm Bob disappears.
7. Finalize on the slot where "Ali" was marked → confirm Ali appears in the finalized session's Going list and Players card.

- [ ] **Step 5: Confirm clean tree**

```bash
git status   # clean
```

---

## Self-review notes

- **Spec coverage:** migration + `added_by_token` + `MANAGER_OWNER` (Task 1); DB helpers (Task 2); `getMyPollFriends` + guest friend-replace (Task 3); poll form UI + token strip (Task 4); manager add/remove actions (Task 5); draft manage UI (Task 6); finalize carry (Task 7); verification (Task 8). All spec sections map to a task.
- **Type consistency:** `insertTimeOptionVotes` row shape (`participant_token: string`, `added_by_token: string | null`) is used identically in `timePollVoteAction`, `addPollFriendAction`, and the tests. `listManagerPollFriends` returns `{ friendToken, name, optionIds }` consumed verbatim by the manage page. `MANAGER_OWNER = "manager"` matches the literal `"manager"` asserted in tests.
- **Token-leak guard:** Task 4 Step 2 nulls `added_by_token` in the client payload; friend prefill uses the `getMyPollFriends` server action. `participant_token` exposure is pre-existing and out of scope.
- **Known accepted edges** (name-merge at finalize, guest/manager asymmetry, tally nudge) are inherited/intended per the spec.
