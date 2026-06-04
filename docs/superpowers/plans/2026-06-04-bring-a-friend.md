# Bring-a-friend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a guest bring named friends when they RSVP, and let the organizer add/remove players from the manage page — all counting toward Going, attendance, and the cost split.

**Architecture:** Friends and manager-added players are rows in the existing `participants` table with no device token of their own. Brought friends carry the host's device token in a new `added_by_token` column (owned-by-host); manager-added rows have all identity columns null. The RSVP form fetches the host's current row + friends on mount (Approach A) and replaces the host's friend set on submit. The manage page gains add/remove controls gated by the manage token.

**Tech Stack:** Next.js 15 App Router (server actions), TypeScript, Supabase (service-role server-side), zod, Vitest.

---

## File structure

- `supabase/migrations/2026-06-04-bring-a-friend.sql` — **create** — the manual DDL.
- `supabase/schema.sql` — **modify** — fold the new column/index into canonical schema.
- `src/lib/types.ts` — **modify** — `Participant.participant_token` nullable + new `added_by_token`.
- `src/lib/players.ts` — **create** — pure `normalizePlayerNames` helper.
- `src/lib/players.test.ts` — **create** — unit tests for the helper.
- `src/lib/db.ts` — **modify** — `insertParticipant` accepts nullable token + `added_by_token`; add `deleteParticipant`, `deleteGuestsOf`.
- `src/app/actions.ts` — **modify** — add `getMyRsvp`; extend `rsvpAction`; add `addPlayersAction`, `removeParticipantAction`.
- `src/app/actions.test.ts` — **modify** — cover friend-replace + manager add/remove.
- `src/components/RsvpForm.tsx` — **modify** — identity-aware prefill + friends UI.
- `src/components/AddPlayersForm.tsx` — **create** — manager add-players client form.
- `src/app/m/[manageToken]/page.tsx` — **modify** — add the "Players" card.

---

## Task 1: Database migration, schema, and types

**Files:**
- Create: `supabase/migrations/2026-06-04-bring-a-friend.sql`
- Modify: `supabase/schema.sql` (participants table + indexes)
- Modify: `src/lib/types.ts:46-55` (`Participant` interface)

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/2026-06-04-bring-a-friend.sql`:

```sql
-- Bring-a-friend: participants can be added without their own device/login.
-- Brought friends carry the host's device token; manager-added rows are all-null.
alter table participants alter column participant_token drop not null;
alter table participants add column added_by_token text;
create index participants_added_by_idx on participants (session_id, added_by_token);
```

- [ ] **Step 2: Update the canonical schema**

In `supabase/schema.sql`, change the `participant_token` line in the `participants` table from `participant_token text not null,` to `participant_token text,` and add the new column. The block becomes:

```sql
create table participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  rsvp text not null check (rsvp in ('going','maybe','cant')),
  attended boolean not null default false,
  participant_token text,
  player_id uuid references profiles(id) on delete set null,
  added_by_token text,
  created_at timestamptz not null default now()
);
```

Then add this index next to `participants_session_idx`:

```sql
create index participants_added_by_idx on participants (session_id, added_by_token);
```

- [ ] **Step 3: Update the `Participant` type**

In `src/lib/types.ts`, replace the `Participant` interface with:

```ts
export interface Participant {
  id: string;
  session_id: string;
  name: string;
  rsvp: Rsvp;
  attended: boolean;
  participant_token: string | null;
  player_id: string | null;
  added_by_token: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `db.ts` or other files error on the now-nullable `participant_token`, they are addressed in Task 3 — but `tsc` should still pass here because reads only widen the type.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026-06-04-bring-a-friend.sql supabase/schema.sql src/lib/types.ts
git commit -m "feat(db): add added_by_token + nullable participant_token for brought players"
```

- [ ] **Step 6: Apply the migration in Supabase**

Per the project workflow, **the user** runs the SQL from `supabase/migrations/2026-06-04-bring-a-friend.sql` in the Supabase dashboard SQL editor. Do not attempt DDL from code. Pause and confirm with the user that the migration has been applied before features that write the new column are tested against the real DB.

---

## Task 2: `normalizePlayerNames` pure helper (TDD)

**Files:**
- Create: `src/lib/players.test.ts`
- Create: `src/lib/players.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/players.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizePlayerNames } from "./players";

describe("normalizePlayerNames", () => {
  it("trims whitespace and drops blank entries", () => {
    expect(normalizePlayerNames(["  Ali ", "", "   ", "Siti"], { max: 10 })).toEqual([
      "Ali",
      "Siti",
    ]);
  });

  it("dedupes case-insensitively, keeping the first occurrence's casing", () => {
    expect(normalizePlayerNames(["Ali", "ali", "ALI"], { max: 10 })).toEqual(["Ali"]);
  });

  it("preserves input order", () => {
    expect(normalizePlayerNames(["Zoe", "Ali", "Bob"], { max: 10 })).toEqual([
      "Zoe",
      "Ali",
      "Bob",
    ]);
  });

  it("caps the result at max", () => {
    expect(normalizePlayerNames(["a", "b", "c", "d"], { max: 2 })).toEqual(["a", "b"]);
  });

  it("returns an empty array when nothing is valid", () => {
    expect(normalizePlayerNames(["", "  "], { max: 10 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/players.test.ts`
Expected: FAIL — cannot resolve `./players` / `normalizePlayerNames` is not defined.

- [ ] **Step 3: Implement the helper**

Create `src/lib/players.ts`:

```ts
/**
 * Clean a list of raw player-name inputs: trim, drop blanks, dedupe
 * case-insensitively (keeping the first occurrence's casing), preserve order,
 * and cap at `max`.
 */
export function normalizePlayerNames(
  raw: string[],
  options: { max: number }
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of raw) {
    const name = value.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(name);

    if (result.length >= options.max) break;
  }

  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/players.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/players.ts src/lib/players.test.ts
git commit -m "feat: add normalizePlayerNames helper with tests"
```

---

## Task 3: DB functions for nullable tokens and deletes

**Files:**
- Modify: `src/lib/db.ts:119-141` (`insertParticipant`, add new functions after `updateParticipant`)

- [ ] **Step 1: Widen `insertParticipant` to accept nullable token + `added_by_token`**

In `src/lib/db.ts`, replace the `insertParticipant` function with:

```ts
export async function insertParticipant(input: {
  session_id: string;
  name: string;
  rsvp: Rsvp;
  participant_token: string | null;
  player_id: string | null;
  added_by_token?: string | null;
}): Promise<Participant> {
  const { data, error } = await admin
    .from("participants")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Participant;
}
```

- [ ] **Step 2: Add `deleteParticipant` and `deleteGuestsOf`**

Immediately after `updateParticipant` in `src/lib/db.ts`, add:

```ts
export async function deleteParticipant(
  id: string,
  sessionId: string
): Promise<void> {
  const { error } = await admin
    .from("participants")
    .delete()
    .eq("id", id)
    .eq("session_id", sessionId);
  if (error) throw error;
}

export async function deleteGuestsOf(
  sessionId: string,
  addedByToken: string
): Promise<void> {
  const { error } = await admin
    .from("participants")
    .delete()
    .eq("session_id", sessionId)
    .eq("added_by_token", addedByToken);
  if (error) throw error;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(db): nullable participant token + deleteParticipant/deleteGuestsOf"
```

---

## Task 4: `getMyRsvp` read action + friend-replace in `rsvpAction`

**Files:**
- Modify: `src/app/actions.ts` (add `getMyRsvp`; extend `rsvpAction:117-155`)
- Modify: `src/app/actions.test.ts` (add to `rsvpAction` describe block)

- [ ] **Step 1: Write the failing test for friend-replace**

In `src/app/actions.test.ts`, add `deleteGuestsOf: vi.fn()` to the `dbMock` hoisted object (after `updateParticipant: vi.fn(),`). Then inside the existing `describe("rsvpAction", ...)` block, add `dbMock.deleteGuestsOf.mockReset();` to its `beforeEach`, and add this test:

```ts
it("inserts the host RSVP and replaces their brought friends", async () => {
  const { rsvpAction } = await import("./actions");
  const formData = new FormData();
  formData.set("guest_token", "guest-1");
  formData.set("name", "Alex");
  formData.set("device_token", "device-1");
  formData.set("rsvp", "going");
  formData.append("friend_name", " Ali ");
  formData.append("friend_name", "");
  formData.append("friend_name", "ali");
  formData.append("friend_name", "Siti");

  dbMock.getSessionByGuestToken.mockResolvedValue({
    id: "session-1",
    guest_token: "guest-1",
    manage_token: "manage-1",
    status: "active",
    lifecycle: "finalized",
  });
  dbMock.listParticipants.mockResolvedValue([]);
  dbMock.insertParticipant.mockResolvedValue({ id: "participant-1" });
  dbMock.deleteGuestsOf.mockResolvedValue(undefined);
  currentPlayerIdMock.mockResolvedValue(null);

  await expect(rsvpAction(formData)).rejects.toThrow(
    "redirect:/s/guest-1?submitted=1"
  );

  expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(1, {
    session_id: "session-1",
    name: "Alex",
    rsvp: "going",
    participant_token: "device-1",
    player_id: null,
  });
  expect(dbMock.deleteGuestsOf).toHaveBeenCalledWith("session-1", "device-1");
  expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(2, {
    session_id: "session-1",
    name: "Ali",
    rsvp: "going",
    participant_token: null,
    player_id: null,
    added_by_token: "device-1",
  });
  expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(3, {
    session_id: "session-1",
    name: "Siti",
    rsvp: "going",
    participant_token: null,
    player_id: null,
    added_by_token: "device-1",
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/actions.test.ts -t "replaces their brought friends"`
Expected: FAIL — `deleteGuestsOf` not called / not a function.

- [ ] **Step 3: Extend `rsvpAction` and add `getMyRsvp`**

In `src/app/actions.ts`, add `normalizePlayerNames` and the `Rsvp` type to the imports:

```ts
import { normalizePlayerNames } from "@/lib/players";
import type { Rsvp } from "@/lib/types";
```

In `rsvpAction`, after the existing `if (match.kind === "new") { ... } else { ... }` block and **before** `revalidatePath(...)`, insert the friend-replace:

```ts
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
```

Then add a new exported read action (place it directly after `rsvpAction`):

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/actions.test.ts -t "replaces their brought friends"`
Expected: PASS.

- [ ] **Step 5: Run the whole action suite to confirm no regressions**

Run: `npx vitest run src/app/actions.test.ts`
Expected: PASS (all existing tests + the new one).

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts src/app/actions.test.ts
git commit -m "feat: getMyRsvp read action and friend-replace in rsvpAction"
```

---

## Task 5: Identity-aware `RsvpForm` with friends UI

**Files:**
- Modify: `src/components/RsvpForm.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `RsvpForm`**

Replace the entire contents of `src/components/RsvpForm.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getMyRsvp, rsvpAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";
import type { Rsvp } from "@/lib/types";
import { deviceToken } from "./device-token";

export function RsvpForm({
  guestToken,
  disabled,
}: {
  guestToken: string;
  disabled: boolean;
}) {
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [rsvp, setRsvp] = useState<Rsvp>("going");
  const [friends, setFriends] = useState<string[]>([]);

  useEffect(() => {
    const current = deviceToken();
    setToken(current);
    getMyRsvp(guestToken, current).then((mine) => {
      if (!mine) return;
      setName(mine.name);
      setRsvp(mine.rsvp);
      setFriends(mine.friends);
    });
  }, [guestToken]);

  if (disabled) {
    return <p className="text-sm text-muted">RSVP closed - session cancelled.</p>;
  }

  return (
    <form action={rsvpAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <Field label="Your name">
        <Input
          name="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <div className="flex gap-4 text-sm font-medium text-ink">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="rsvp"
            value="going"
            checked={rsvp === "going"}
            onChange={() => setRsvp("going")}
          />{" "}
          Going
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="rsvp"
            value="maybe"
            checked={rsvp === "maybe"}
            onChange={() => setRsvp("maybe")}
          />{" "}
          Maybe
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="rsvp"
            value="cant"
            checked={rsvp === "cant"}
            onChange={() => setRsvp("cant")}
          />{" "}
          Can&apos;t
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">Bringing friends? (optional)</p>
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

      <Button disabled={!token}>Submit RSVP</Button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build to confirm the client/server boundary is valid**

Run: `npm run build`
Expected: PASS — `getMyRsvp` is a server action callable from this client component; no "server-only" import leaks.

- [ ] **Step 4: Commit**

```bash
git add src/components/RsvpForm.tsx
git commit -m "feat(ui): prefill RSVP form and add bring-a-friend section"
```

---

## Task 6: Manager add/remove actions

**Files:**
- Modify: `src/app/actions.ts` (add `addPlayersAction`, `removeParticipantAction`)
- Modify: `src/app/actions.test.ts` (new describe blocks)

- [ ] **Step 1: Write the failing tests**

In `src/app/actions.test.ts`, add `deleteParticipant: vi.fn()` to the `dbMock` hoisted object. Then append two new describe blocks at the end of the file:

```ts
describe("addPlayersAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.insertParticipant.mockReset();
  });

  it("inserts each normalized name as a going manager-added player", async () => {
    const { addPlayersAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.append("player_name", " Ali ");
    formData.append("player_name", "ali");
    formData.append("player_name", "Siti");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "finalized",
    });
    dbMock.insertParticipant.mockResolvedValue({ id: "participant-1" });

    await expect(addPlayersAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=players"
    );

    expect(dbMock.insertParticipant).toHaveBeenCalledTimes(2);
    expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(1, {
      session_id: "session-1",
      name: "Ali",
      rsvp: "going",
      participant_token: null,
      player_id: null,
      added_by_token: null,
    });
    expect(dbMock.insertParticipant).toHaveBeenNthCalledWith(2, {
      session_id: "session-1",
      name: "Siti",
      rsvp: "going",
      participant_token: null,
      player_id: null,
      added_by_token: null,
    });
  });
});

describe("removeParticipantAction", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    revalidatePathMock.mockReset();
    dbMock.getSessionByManageToken.mockReset();
    dbMock.deleteParticipant.mockReset();
  });

  it("deletes the participant scoped to the session", async () => {
    const { removeParticipantAction } = await import("./actions");
    const formData = new FormData();
    formData.set("manage_token", "manage-1");
    formData.set("participant_id", "participant-9");

    dbMock.getSessionByManageToken.mockResolvedValue({
      id: "session-1",
      guest_token: "guest-1",
      manage_token: "manage-1",
      status: "active",
      lifecycle: "finalized",
    });
    dbMock.deleteParticipant.mockResolvedValue(undefined);

    await expect(removeParticipantAction(formData)).rejects.toThrow(
      "redirect:/m/manage-1?saved=players"
    );

    expect(dbMock.deleteParticipant).toHaveBeenCalledWith(
      "participant-9",
      "session-1"
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/actions.test.ts -t "manager-added player"`
Expected: FAIL — `addPlayersAction` is not exported.

- [ ] **Step 3: Implement the two actions**

Append to `src/app/actions.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/actions.test.ts`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add src/app/actions.ts src/app/actions.test.ts
git commit -m "feat: manager addPlayers and removeParticipant actions"
```

---

## Task 7: Manage-page Players card

**Files:**
- Create: `src/components/AddPlayersForm.tsx`
- Modify: `src/app/m/[manageToken]/page.tsx` (imports + finalized branch)

- [ ] **Step 1: Create the add-players form**

Create `src/components/AddPlayersForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { addPlayersAction } from "@/app/actions";
import { Button, Input } from "@/components/ui";

export function AddPlayersForm({ manageToken }: { manageToken: string }) {
  const [names, setNames] = useState<string[]>([""]);

  return (
    <form action={addPlayersAction} className="flex flex-col gap-2">
      <input type="hidden" name="manage_token" value={manageToken} />
      {names.map((name, index) => (
        <Input
          key={index}
          name="player_name"
          placeholder="Player's name"
          value={name}
          onChange={(e) =>
            setNames((prev) =>
              prev.map((value, i) => (i === index ? e.target.value : value))
            )
          }
        />
      ))}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setNames((prev) => [...prev, ""])}
        >
          + Add another
        </Button>
        <Button>Add players</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Wire imports into the manage page**

In `src/app/m/[manageToken]/page.tsx`, update the actions import on line 2 to include `removeParticipantAction`:

```tsx
import {
  cancelSessionAction,
  editSessionAction,
  removeParticipantAction,
} from "@/app/actions";
```

Add the component import alongside the other component imports (after the `CostForm` import):

```tsx
import { AddPlayersForm } from "@/components/AddPlayersForm";
```

- [ ] **Step 3: Add the Players card to the finalized branch**

In the finalized `return (...)` of `ManagePage`, insert this `Card` immediately **before** the `<Card title="Verify attendance">` card:

```tsx
      <Card title="Players">
        <ul className="flex flex-col gap-2">
          {participants.length === 0 && (
            <li className="text-sm text-muted">No players yet.</li>
          )}
          {participants.map((participant) => (
            <li
              key={participant.id}
              className="flex items-center justify-between gap-2 text-sm text-ink"
            >
              <span>
                {participant.name}{" "}
                <span className="text-xs text-muted">({participant.rsvp})</span>
              </span>
              {!cancelled && (
                <form action={removeParticipantAction}>
                  <input type="hidden" name="manage_token" value={manageToken} />
                  <input
                    type="hidden"
                    name="participant_id"
                    value={participant.id}
                  />
                  <Button variant="ghost">Remove</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {!cancelled && (
          <div className="mt-3 border-t border-border pt-3">
            <AddPlayersForm manageToken={manageToken} />
          </div>
        )}
      </Card>
```

(The existing `banners` already render "Changes saved." for any `saved` value, so `?saved=players` shows a success banner with no extra wiring.)

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddPlayersForm.tsx "src/app/m/[manageToken]/page.tsx"
git commit -m "feat(ui): manage-page Players card with add and remove"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — all Vitest suites green, including `players.test.ts` and the new action tests.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual smoke test (requires the migration applied)**

Run: `npm run dev`, then:
1. Create a session and finalize it.
2. On the guest page, RSVP as "Alex" and add friends "Ali" and "Siti" → submit. Confirm all three appear in **Going**.
3. Reload the guest page → confirm the form prefills name "Alex", status, and the two friends.
4. Remove "Siti" in the form, submit → confirm Siti disappears from Going.
5. On the manage page, add a player "Bob" via the Players card → confirm Bob appears in Players, Verify attendance, and Going on the guest page.
6. Remove "Ali" from the Players card → confirm Ali disappears everywhere.

- [ ] **Step 5: Final commit (if any cleanup was needed)**

```bash
git status   # should be clean if no changes were needed
```

---

## Self-review notes

- **Spec coverage:** migration + nullable token (Task 1), entry kinds via `added_by_token` (Tasks 1/4/6), `normalizePlayerNames` (Task 2), DB deletes (Task 3), `getMyRsvp` + friend-replace (Task 4), identity-aware form + friends UI (Task 5), manager add/remove (Tasks 6/7), TDD for pure logic + action tests (Tasks 2/4/6), full verification (Task 8). All spec sections map to a task.
- **Known accepted edge** (name-based identity merge) is inherited from existing `resolveIdentity` behavior and intentionally not changed.
- **Type consistency:** `insertParticipant` input (`participant_token: string | null`, optional `added_by_token`) is used consistently in `rsvpAction`, `addPlayersAction`, and tests; `getMyRsvp` returns `{ name: string; rsvp: Rsvp; friends: string[] } | null` and `RsvpForm` consumes exactly those fields.
