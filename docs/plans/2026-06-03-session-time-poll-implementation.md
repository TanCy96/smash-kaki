# Session Time Poll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a draft session timing poll where guests vote on candidate times, the organizer finalizes one time, and selected voters become `going` RSVPs.

**Architecture:** Keep the existing token model and routes. A `sessions` row now has a `draft` or `finalized` lifecycle; draft sessions show poll UI on the same `/s/[guestToken]` and `/m/[manageToken]` links, while finalized sessions use the current RSVP/manage/cost flow. New time option and vote tables live behind server actions and `db.ts`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase service-role data access, zod, nanoid, Vitest.

---

## Ground Rules

- Do not push commits.
- Keep `db.ts` server-only and never import it into client components.
- Write failing Vitest tests first for pure poll logic.
- Keep poll identity and vote replacement logic outside React components.
- Preserve guest-token safety: guest pages must never render the manage token.
- After each task commit, run `git status --short` and confirm only intended files changed.

---

### Task 1: Add Pure Poll Identity Logic

**Files:**
- Create: `src/lib/time-poll.ts`
- Create: `src/lib/time-poll.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/time-poll.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  resolvePollVoter,
  selectedOptionIds,
  type PollVoteIdentity,
} from "./time-poll";

const voter = (
  over: Partial<PollVoteIdentity> = {}
): PollVoteIdentity => ({
  name: "Alex",
  participant_token: "dev-1",
  player_id: null,
  ...over,
});

describe("resolvePollVoter", () => {
  it("matches logged-in player before device token", () => {
    const voters = [
      voter({ name: "Device Match", participant_token: "dev-x" }),
      voter({ name: "Player Match", player_id: "player-1" }),
    ];

    expect(
      resolvePollVoter({
        loggedInPlayerId: "player-1",
        deviceToken: "dev-x",
        name: "Alex",
        existing: voters,
      })
    ).toEqual({ kind: "logged-in", identity: voters[1] });
  });

  it("matches returning device token", () => {
    const voters = [voter({ participant_token: "dev-abc" })];

    expect(
      resolvePollVoter({
        loggedInPlayerId: null,
        deviceToken: "dev-abc",
        name: "Sam",
        existing: voters,
      })
    ).toEqual({ kind: "device", identity: voters[0] });
  });

  it("matches duplicate name case-insensitively", () => {
    const voters = [voter({ name: "Alex" })];

    expect(
      resolvePollVoter({
        loggedInPlayerId: null,
        deviceToken: "new-device",
        name: " alex ",
        existing: voters,
      })
    ).toEqual({ kind: "duplicate-name", identity: voters[0] });
  });

  it("returns new when no identity matches", () => {
    expect(
      resolvePollVoter({
        loggedInPlayerId: null,
        deviceToken: "dev-new",
        name: "Jo",
        existing: [],
      })
    ).toEqual({ kind: "new" });
  });
});

describe("selectedOptionIds", () => {
  it("keeps only valid selected option ids", () => {
    expect(selectedOptionIds(["a", "b", "x"], ["a", "b", "c"])).toEqual([
      "a",
      "b",
    ]);
  });

  it("deduplicates selected options", () => {
    expect(selectedOptionIds(["a", "a", "b"], ["a", "b"])).toEqual([
      "a",
      "b",
    ]);
  });

  it("allows clearing every choice", () => {
    expect(selectedOptionIds([], ["a", "b"])).toEqual([]);
  });
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- src/lib/time-poll.test.ts
```

Expected: FAIL because `src/lib/time-poll.ts` does not exist.

**Step 3: Implement minimal pure logic**

Create `src/lib/time-poll.ts`:

```ts
export interface PollVoteIdentity {
  name: string;
  participant_token: string;
  player_id: string | null;
}

export type PollVoterMatch =
  | { kind: "logged-in"; identity: PollVoteIdentity }
  | { kind: "device"; identity: PollVoteIdentity }
  | { kind: "duplicate-name"; identity: PollVoteIdentity }
  | { kind: "new" };

export function resolvePollVoter(args: {
  loggedInPlayerId: string | null;
  deviceToken: string | null;
  name: string;
  existing: PollVoteIdentity[];
}): PollVoterMatch {
  const { loggedInPlayerId, deviceToken, name, existing } = args;

  if (loggedInPlayerId) {
    const match = existing.find(
      (identity) => identity.player_id === loggedInPlayerId
    );
    if (match) return { kind: "logged-in", identity: match };
  }

  if (deviceToken) {
    const match = existing.find(
      (identity) => identity.participant_token === deviceToken
    );
    if (match) return { kind: "device", identity: match };
  }

  const normalized = name.trim().toLowerCase();
  const duplicate = existing.find(
    (identity) => identity.name.trim().toLowerCase() === normalized
  );
  if (duplicate) return { kind: "duplicate-name", identity: duplicate };

  return { kind: "new" };
}

export function selectedOptionIds(
  requestedOptionIds: string[],
  validOptionIds: string[]
): string[] {
  const valid = new Set(validOptionIds);
  const selected = new Set(
    requestedOptionIds.filter((optionId) => valid.has(optionId))
  );

  return Array.from(selected);
}
```

**Step 4: Run the test to verify it passes**

Run:

```bash
npm run test -- src/lib/time-poll.test.ts
```

Expected: PASS.

**Step 5: Run all unit tests**

Run:

```bash
npm run test
```

Expected: all existing tests and the new poll tests pass.

**Step 6: Commit**

```bash
git add src/lib/time-poll.ts src/lib/time-poll.test.ts
git commit -m "feat: add time poll identity logic"
```

---

### Task 2: Extend Schema and Types

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/lib/types.ts`

**Step 1: Update `supabase/schema.sql`**

Modify `sessions`:

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  manage_token text not null unique,
  guest_token  text not null unique,
  title text not null,
  starts_at timestamptz,
  duration_min int,
  location text not null,
  court_numbers text,
  notes text,
  status text not null default 'active' check (status in ('active','cancelled')),
  lifecycle text not null default 'draft' check (lifecycle in ('draft','finalized')),
  court_cost numeric,
  shuttles_used int,
  price_per_shuttle numeric,
  created_at timestamptz not null default now()
);
```

Add the new tables after `sessions`:

```sql
create table session_time_options (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int not null,
  label text,
  created_at timestamptz not null default now()
);

create table time_option_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  session_time_option_id uuid not null references session_time_options(id) on delete cascade,
  name text not null,
  participant_token text not null,
  player_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
```

Add indexes:

```sql
create index session_time_options_session_idx on session_time_options (session_id);
create index time_option_votes_session_idx on time_option_votes (session_id);
create index time_option_votes_option_idx on time_option_votes (session_time_option_id);
create unique index time_option_votes_device_option_idx
  on time_option_votes (participant_token, session_time_option_id);
create unique index time_option_votes_player_option_idx
  on time_option_votes (player_id, session_time_option_id)
  where player_id is not null;
```

Enable RLS:

```sql
alter table session_time_options enable row level security;
alter table time_option_votes    enable row level security;
```

For existing Supabase projects, prepare a manual migration equivalent:

```sql
alter table sessions add column lifecycle text not null default 'draft'
  check (lifecycle in ('draft','finalized'));
alter table sessions alter column starts_at drop not null;
alter table sessions alter column duration_min drop not null;
```

Then create the two new tables and indexes above.

**Step 2: Update `src/lib/types.ts`**

Add lifecycle and poll types:

```ts
export type Rsvp = "going" | "maybe" | "cant";
export type SessionStatus = "active" | "cancelled";
export type SessionLifecycle = "draft" | "finalized";

export interface Session {
  id: string;
  manage_token: string;
  guest_token: string;
  title: string;
  starts_at: string | null;
  duration_min: number | null;
  location: string;
  court_numbers: string | null;
  notes: string | null;
  status: SessionStatus;
  lifecycle: SessionLifecycle;
  court_cost: number | null;
  shuttles_used: number | null;
  price_per_shuttle: number | null;
  created_at: string;
}

export interface SessionTimeOption {
  id: string;
  session_id: string;
  starts_at: string;
  duration_min: number;
  label: string | null;
  created_at: string;
}

export interface TimeOptionVote {
  id: string;
  session_id: string;
  session_time_option_id: string;
  name: string;
  participant_token: string;
  player_id: string | null;
  created_at: string;
}

export interface SessionTimeOptionWithVotes extends SessionTimeOption {
  votes: TimeOptionVote[];
}
```

Keep the existing `Participant` and `Profile` interfaces unchanged.

**Step 3: Run type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: temporary type errors in pages/actions that assume non-null
`starts_at` and `duration_min`. These are acceptable at this task boundary.

**Step 4: Commit**

```bash
git add supabase/schema.sql src/lib/types.ts
git commit -m "feat: add draft session poll schema"
```

---

### Task 3: Add DB Helpers for Time Options and Votes

**Files:**
- Modify: `src/lib/db.ts`

**Step 1: Import new types**

Update the import:

```ts
import type {
  Participant,
  Profile,
  Rsvp,
  Session,
  SessionTimeOption,
  SessionTimeOptionWithVotes,
  TimeOptionVote,
} from "./types";
```

**Step 2: Allow creating draft sessions**

Update `createSession` input:

```ts
export async function createSession(input: {
  manage_token: string;
  guest_token: string;
  title: string;
  starts_at: string | null;
  duration_min: number | null;
  location: string;
  court_numbers: string | null;
  notes: string | null;
  lifecycle?: "draft" | "finalized";
}): Promise<Session> {
```

The body stays the same.

**Step 3: Allow updating lifecycle and nullable confirmed time**

Update `updateSessionDetails` pick list to include `lifecycle`:

```ts
| "lifecycle"
```

`starts_at` and `duration_min` are already in the pick list and will now accept
nullable values through the updated `Session` type.

**Step 4: Add option creation**

```ts
export async function createSessionTimeOptions(
  sessionId: string,
  options: {
    starts_at: string;
    duration_min: number;
    label: string | null;
  }[]
): Promise<SessionTimeOption[]> {
  const { data, error } = await admin
    .from("session_time_options")
    .insert(
      options.map((option) => ({
        session_id: sessionId,
        ...option,
      }))
    )
    .select()
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data as SessionTimeOption[]) ?? [];
}
```

**Step 5: Add option listing**

```ts
export async function listSessionTimeOptions(
  sessionId: string
): Promise<SessionTimeOptionWithVotes[]> {
  const { data: options, error: optionError } = await admin
    .from("session_time_options")
    .select("*")
    .eq("session_id", sessionId)
    .order("starts_at", { ascending: true });

  if (optionError) throw optionError;

  const { data: votes, error: voteError } = await admin
    .from("time_option_votes")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (voteError) throw voteError;

  const allVotes = (votes as TimeOptionVote[]) ?? [];
  return ((options as SessionTimeOption[]) ?? []).map((option) => ({
    ...option,
    votes: allVotes.filter(
      (vote) => vote.session_time_option_id === option.id
    ),
  }));
}
```

**Step 6: Add voter identity listing**

```ts
export async function listTimePollVoters(sessionId: string): Promise<
  {
    name: string;
    participant_token: string;
    player_id: string | null;
  }[]
> {
  const { data, error } = await admin
    .from("time_option_votes")
    .select("name, participant_token, player_id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const seen = new Set<string>();
  return (
    (data as {
      name: string;
      participant_token: string;
      player_id: string | null;
    }[]) ?? []
  ).filter((identity) => {
    const key = identity.player_id
      ? `player:${identity.player_id}`
      : `device:${identity.participant_token}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

**Step 7: Add vote replacement**

```ts
export async function replaceTimeOptionVotes(input: {
  session_id: string;
  name: string;
  participant_token: string;
  player_id: string | null;
  previous_identity: {
    participant_token: string;
    player_id: string | null;
    name: string;
  } | null;
  session_time_option_ids: string[];
}): Promise<void> {
  const previous = input.previous_identity;

  if (previous?.player_id) {
    const { error } = await admin
      .from("time_option_votes")
      .delete()
      .eq("session_id", input.session_id)
      .eq("player_id", previous.player_id);
    if (error) throw error;
  } else if (previous?.participant_token) {
    const { error } = await admin
      .from("time_option_votes")
      .delete()
      .eq("session_id", input.session_id)
      .eq("participant_token", previous.participant_token);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("time_option_votes")
      .delete()
      .eq("session_id", input.session_id)
      .eq("participant_token", input.participant_token);
    if (error) throw error;
  }

  if (input.session_time_option_ids.length === 0) return;

  const { error } = await admin.from("time_option_votes").insert(
    input.session_time_option_ids.map((optionId) => ({
      session_id: input.session_id,
      session_time_option_id: optionId,
      name: input.name,
      participant_token: input.participant_token,
      player_id: input.player_id,
    }))
  );

  if (error) throw error;
}
```

**Step 8: Add selected option lookup and selected votes**

```ts
export async function getSessionTimeOption(
  optionId: string
): Promise<SessionTimeOption | null> {
  const { data } = await admin
    .from("session_time_options")
    .select("*")
    .eq("id", optionId)
    .maybeSingle();

  return (data as SessionTimeOption) ?? null;
}

export async function listVotesForTimeOption(
  optionId: string
): Promise<TimeOptionVote[]> {
  const { data, error } = await admin
    .from("time_option_votes")
    .select("*")
    .eq("session_time_option_id", optionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data as TimeOptionVote[]) ?? [];
}
```

**Step 9: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: page/action errors may remain until later tasks, but no errors inside
the new DB helpers.

**Step 10: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add time poll data helpers"
```

---

### Task 4: Update Create Session Action and Form

**Files:**
- Modify: `src/app/actions.ts`
- Modify: `src/app/page.tsx`
- Create: `src/components/CreateSessionForm.tsx`
- Create: `src/components/device-token.ts`

**Step 1: Extract the client device token helper**

Create `src/components/device-token.ts`:

```ts
const key = "smashkaki_device_token";

export function deviceToken(): string {
  let token = localStorage.getItem(key);

  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }

  return token;
}
```

**Step 2: Create the client create form**

Create `src/components/CreateSessionForm.tsx`:

```tsx
"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createSessionAction } from "@/app/actions";
import { deviceToken } from "./device-token";

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-gray-700";

interface TimeOptionDraft {
  id: string;
  available: boolean;
}

function newOption(): TimeOptionDraft {
  return { id: crypto.randomUUID(), available: true };
}

export function CreateSessionForm({ displayName }: { displayName: string }) {
  const [token, setToken] = useState("");
  const [options, setOptions] = useState<TimeOptionDraft[]>([
    newOption(),
    newOption(),
  ]);

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  return (
    <form
      action={createSessionAction}
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="device_token" value={token} />
      <label className={labelClass}>
        Your name
        <input
          name="organizer_name"
          placeholder="Alex"
          defaultValue={displayName}
          required
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Session title
        <input
          name="title"
          placeholder="Friday Smash"
          required
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Location
        <input
          name="location"
          placeholder="ABC Sports Hall"
          required
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Court number(s)
        <input
          name="court_numbers"
          placeholder="Court 3, Court 4"
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Notes
        <textarea
          name="notes"
          placeholder="Optional details for the kaki"
          className={`${inputClass} min-h-24`}
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-950">Time options</h2>
          <button
            type="button"
            onClick={() => setOptions((current) => [...current, newOption()])}
            disabled={options.length >= 6}
            className="inline-flex size-9 items-center justify-center rounded-md border border-gray-300 text-gray-700 disabled:opacity-40"
            aria-label="Add time option"
            title="Add time option"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {options.map((option, index) => (
          <div
            key={option.id}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-gray-200 p-3"
          >
            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                Date and time
                <input
                  name="option_starts_at"
                  type="datetime-local"
                  required={index < 2}
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Duration (minutes)
                <input
                  name="option_duration_min"
                  type="number"
                  min="1"
                  defaultValue={120}
                  required={index < 2}
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  name="organizer_available_index"
                  type="checkbox"
                  value={index}
                  defaultChecked={option.available}
                />
                I can attend this option
              </label>
            </div>
            <button
              type="button"
              onClick={() =>
                setOptions((current) =>
                  current.length <= 2
                    ? current
                    : current.filter((item) => item.id !== option.id)
                )
              }
              disabled={options.length <= 2}
              className="inline-flex size-9 items-center justify-center rounded-md border border-gray-300 text-gray-700 disabled:opacity-40"
              aria-label="Remove time option"
              title="Remove time option"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
        Create poll
      </button>
    </form>
  );
}
```

If `lucide-react` is not installed, run `npm install lucide-react` and commit the
package file changes with this task. If avoiding a new dependency, use text
buttons and omit the icon import.

**Step 3: Replace the inline form in `src/app/page.tsx`**

Keep the auth/profile header. Import and render:

```tsx
import { CreateSessionForm } from "@/components/CreateSessionForm";
```

Replace the existing `<form action={createSessionAction}>...</form>` with:

```tsx
<CreateSessionForm displayName={displayName} />
```

Remove the no-longer-used `createSessionAction`, `inputClass`, and `labelClass`
imports/constants from the page if they are unused.

**Step 4: Update `createSessionAction`**

Replace the existing `createSchema` with:

```ts
const createSchema = z.object({
  organizer_name: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  court_numbers: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  device_token: z.string().min(1),
});
```

In `createSessionAction`, parse time option arrays:

```ts
const raw = Object.fromEntries(formData);
const value = createSchema.parse(raw);
const optionStarts = formData.getAll("option_starts_at").map(String);
const optionDurations = formData.getAll("option_duration_min").map(Number);
const availableIndexes = new Set(
  formData.getAll("organizer_available_index").map((item) => Number(item))
);

const options = optionStarts
  .map((startsAt, index) => ({
    starts_at: startsAt,
    duration_min: optionDurations[index],
    index,
  }))
  .filter(
    (option) =>
      option.starts_at &&
      Number.isInteger(option.duration_min) &&
      option.duration_min > 0
  );

if (options.length < 2) redirect("/?error=options");
```

Create the draft session:

```ts
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

const createdOptions = await db.createSessionTimeOptions(
  session.id,
  options.map((option, index) => ({
    starts_at: new Date(option.starts_at).toISOString(),
    duration_min: option.duration_min,
    label: `Option ${index + 1}`,
  }))
);
```

Insert organizer availability votes:

```ts
const selectedOptionIds = createdOptions
  .filter((_, createdIndex) => availableIndexes.has(options[createdIndex].index))
  .map((option) => option.id);

if (selectedOptionIds.length) {
  await db.replaceTimeOptionVotes({
    session_id: session.id,
    name: value.organizer_name,
    participant_token: value.device_token,
    player_id: playerId,
    previous_identity: null,
    session_time_option_ids: selectedOptionIds,
  });
}
```

Keep the redirect:

```ts
redirect(`/m/${session.manage_token}?created=1`);
```

**Step 5: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: errors may remain in guest/manage pages until they handle draft vs
finalized branches.

**Step 6: Commit**

```bash
git add src/app/actions.ts src/app/page.tsx src/components/CreateSessionForm.tsx src/components/device-token.ts package.json package-lock.json
git commit -m "feat: create draft session polls"
```

---

### Task 5: Add Draft Guest Voting UI and Action

**Files:**
- Modify: `src/app/actions.ts`
- Modify: `src/app/s/[guestToken]/page.tsx`
- Create: `src/components/TimePollForm.tsx`
- Create: `src/components/TimePollSummary.tsx`
- Modify: `src/components/RsvpForm.tsx`

**Step 1: Reuse the device-token helper in `RsvpForm`**

Remove the local `deviceToken` function from `src/components/RsvpForm.tsx` and
import:

```ts
import { deviceToken } from "./device-token";
```

**Step 2: Add vote action schema and action**

In `src/app/actions.ts`, import:

```ts
import { resolvePollVoter, selectedOptionIds } from "@/lib/time-poll";
```

Add:

```ts
const timePollVoteSchema = z.object({
  guest_token: z.string(),
  name: z.string().min(1),
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
  const requestedOptionIds = formData.getAll("time_option_id").map(String);
  const optionIds = selectedOptionIds(requestedOptionIds, validOptionIds);
  const existing = await db.listTimePollVoters(session.id);
  const match = resolvePollVoter({
    loggedInPlayerId: playerId,
    deviceToken: value.device_token,
    name: value.name,
    existing,
  });

  await db.replaceTimeOptionVotes({
    session_id: session.id,
    name: value.name,
    participant_token: value.device_token,
    player_id: playerId,
    previous_identity: match.kind === "new" ? null : match.identity,
    session_time_option_ids: optionIds,
  });

  revalidatePath(`/s/${value.guest_token}`);
  revalidatePath(`/m/${session.manage_token}`);
  redirect(`/s/${value.guest_token}?submitted=1`);
}
```

**Step 3: Add poll summary component**

Create `src/components/TimePollSummary.tsx`:

```tsx
import type { SessionTimeOptionWithVotes } from "@/lib/types";

export function TimePollSummary({
  options,
}: {
  options: SessionTimeOptionWithVotes[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => (
        <section
          key={option.id}
          className="rounded-md border border-gray-200 bg-white p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {new Date(option.starts_at).toLocaleString()}
              </h3>
              <p className="text-sm text-gray-600">
                {option.duration_min} min
              </p>
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-800">
              {option.votes.length}
            </span>
          </div>
          {option.votes.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm text-gray-700">
              {option.votes.map((vote) => (
                <li
                  key={vote.id}
                  className="rounded-md bg-gray-100 px-2 py-1"
                >
                  {vote.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
```

**Step 4: Add poll form component**

Create `src/components/TimePollForm.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { timePollVoteAction } from "@/app/actions";
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

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  if (disabled) {
    return <p className="text-sm text-gray-500">Voting closed.</p>;
  }

  return (
    <form action={timePollVoteAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <input
        name="name"
        placeholder="Your name"
        required
        className="rounded border p-2"
      />
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-start gap-2 rounded-md border border-gray-200 p-3"
          >
            <input
              name="time_option_id"
              type="checkbox"
              value={option.id}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">
                {new Date(option.starts_at).toLocaleString()}
              </span>
              <span className="block text-sm text-gray-600">
                {option.duration_min} min
              </span>
            </span>
          </label>
        ))}
      </div>
      <button className="rounded bg-emerald-600 p-2 text-white">
        Save availability
      </button>
    </form>
  );
}
```

**Step 5: Branch guest page by lifecycle**

In `src/app/s/[guestToken]/page.tsx`, import:

```ts
import { TimePollForm } from "@/components/TimePollForm";
import { TimePollSummary } from "@/components/TimePollSummary";
import { listSessionTimeOptions } from "@/lib/db";
```

After loading the session, add:

```tsx
if (session.lifecycle === "draft") {
  const options = await listSessionTimeOptions(session.id);

  return (
    <main className="mx-auto max-w-md p-4">
      {session.status === "cancelled" && (
        <div className="mb-3 rounded bg-red-100 p-2 text-red-800">
          This poll was cancelled.
        </div>
      )}
      <h1 className="text-2xl font-bold">{session.title}</h1>
      <p>{session.location}</p>
      {session.court_numbers && <p>Court {session.court_numbers}</p>}
      {session.notes && <p className="text-sm text-gray-600">{session.notes}</p>}

      <h2 className="mt-4 font-semibold">Pick your available times</h2>
      {submitted === "1" && (
        <p className="mb-2 rounded bg-emerald-100 p-2 text-sm text-emerald-900">
          Availability saved.
        </p>
      )}
      <TimePollForm
        guestToken={guestToken}
        options={options}
        disabled={session.status === "cancelled"}
      />

      <h2 className="mt-4 font-semibold">Current preferences</h2>
      <TimePollSummary options={options} />
    </main>
  );
}
```

Before the existing finalized render, guard:

```ts
if (!session.starts_at || !session.duration_min) notFound();
```

**Step 6: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: remaining errors should now be mostly in manage page/actions if any.

**Step 7: Commit**

```bash
git add src/app/actions.ts "src/app/s/[guestToken]/page.tsx" src/components/TimePollForm.tsx src/components/TimePollSummary.tsx src/components/RsvpForm.tsx
git commit -m "feat: add guest time poll voting"
```

---

### Task 6: Add Draft Manage View and Finalize Action

**Files:**
- Modify: `src/app/actions.ts`
- Modify: `src/app/m/[manageToken]/page.tsx`
- Create: `src/components/FinalizeTimeOptionForm.tsx`

**Step 1: Add finalize action**

In `src/app/actions.ts`, add:

```ts
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
```

**Step 2: Add finalize form component**

Create `src/components/FinalizeTimeOptionForm.tsx`:

```tsx
import { finalizeTimeOptionAction } from "@/app/actions";

export function FinalizeTimeOptionForm({
  manageToken,
  optionId,
}: {
  manageToken: string;
  optionId: string;
}) {
  return (
    <form action={finalizeTimeOptionAction}>
      <input type="hidden" name="manage_token" value={manageToken} />
      <input type="hidden" name="time_option_id" value={optionId} />
      <button className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
        Finalize
      </button>
    </form>
  );
}
```

**Step 3: Branch manage page by lifecycle**

In `src/app/m/[manageToken]/page.tsx`, import:

```ts
import { FinalizeTimeOptionForm } from "@/components/FinalizeTimeOptionForm";
import { TimePollSummary } from "@/components/TimePollSummary";
import { listSessionTimeOptions } from "@/lib/db";
```

After computing `guestUrl` and `manageUrl`, add a draft branch before the current
finalized form:

```tsx
if (session.lifecycle === "draft") {
  const options = await listSessionTimeOptions(session.id);

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-bold">Manage poll: {session.title}</h1>
      {created && (
        <p className="rounded bg-emerald-100 p-2 text-emerald-900">
          Poll created. Share the guest link below.
        </p>
      )}
      {saved && (
        <p className="mt-2 rounded bg-emerald-100 p-2 text-emerald-900">
          Changes saved.
        </p>
      )}

      <div className="my-3 flex flex-col gap-2 rounded bg-gray-100 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm">Guest link: {guestUrl}</span>
          <CopyLinkButton url={guestUrl} label="Copy guest link" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm">
            Manage link (keep secret): {manageUrl}
          </span>
          <CopyLinkButton url={manageUrl} label="Copy manage link" />
        </div>
      </div>

      <h2 className="mt-4 font-semibold">Current preferences</h2>
      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <section
            key={option.id}
            className="rounded-md border border-gray-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {new Date(option.starts_at).toLocaleString()}
                </h3>
                <p className="text-sm text-gray-600">
                  {option.duration_min} min - {option.votes.length} available
                </p>
              </div>
              <FinalizeTimeOptionForm
                manageToken={manageToken}
                optionId={option.id}
              />
            </div>
            <TimePollSummary options={[option]} />
          </section>
        ))}
      </div>

      {session.status !== "cancelled" && (
        <form action={cancelSessionAction} className="mt-4">
          <input type="hidden" name="manage_token" value={manageToken} />
          <button className="rounded bg-red-600 p-2 text-sm text-white">
            Cancel poll
          </button>
        </form>
      )}
    </main>
  );
}
```

Before the existing finalized render, guard:

```ts
if (!session.starts_at || !session.duration_min) notFound();
```

**Step 4: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

**Step 5: Commit**

```bash
git add src/app/actions.ts "src/app/m/[manageToken]/page.tsx" src/components/FinalizeTimeOptionForm.tsx
git commit -m "feat: finalize time poll into session"
```

---

### Task 7: Polish Draft Editing and Empty States

**Files:**
- Modify: `src/app/m/[manageToken]/page.tsx`
- Modify: `src/app/s/[guestToken]/page.tsx`
- Modify: `src/components/TimePollSummary.tsx`

**Step 1: Add empty vote copy**

In `TimePollSummary`, when an option has no votes, render:

```tsx
{option.votes.length === 0 ? (
  <p className="mt-2 text-sm text-gray-500">No one yet.</p>
) : (
  <ul className="mt-2 flex flex-wrap gap-2 text-sm text-gray-700">
    {option.votes.map((vote) => (
      <li key={vote.id} className="rounded-md bg-gray-100 px-2 py-1">
        {vote.name}
      </li>
    ))}
  </ul>
)}
```

**Step 2: Add draft details edit form on manage page**

Reuse `editSessionAction` for draft details. In the draft branch, add:

```tsx
<h2 className="mt-4 font-semibold">Edit details</h2>
<form action={editSessionAction} className="flex flex-col gap-2">
  <input type="hidden" name="manage_token" value={manageToken} />
  <input
    name="title"
    defaultValue={session.title}
    required
    className="rounded border p-2"
  />
  <input type="hidden" name="starts_at" value="1970-01-01T00:00" />
  <input type="hidden" name="duration_min" value="1" />
  <input
    name="location"
    defaultValue={session.location}
    required
    className="rounded border p-2"
  />
  <input
    name="court_numbers"
    defaultValue={session.court_numbers ?? ""}
    placeholder="Court number(s)"
    className="rounded border p-2"
  />
  <textarea
    name="notes"
    defaultValue={session.notes ?? ""}
    className="rounded border p-2"
  />
  <button className="rounded bg-emerald-600 p-2 text-white">
    Save details
  </button>
</form>
```

Then update `editSessionAction` so draft sessions ignore the hidden time values:

```ts
const patch =
  session.lifecycle === "draft"
    ? {
        title: value.title,
        location: value.location,
        court_numbers: value.court_numbers || null,
        notes: value.notes || null,
      }
    : {
        title: value.title,
        starts_at: new Date(value.starts_at).toISOString(),
        duration_min: value.duration_min,
        location: value.location,
        court_numbers: value.court_numbers || null,
        notes: value.notes || null,
      };

await db.updateSessionDetails(session.id, patch);
```

**Step 3: Improve draft submitted state**

In guest draft branch, keep the existing submitted alert but use "Availability
saved." This was already added in Task 5; verify it is present.

**Step 4: Type-check and test**

Run:

```bash
npx tsc --noEmit
npm run test
```

Expected: both pass.

**Step 5: Commit**

```bash
git add src/app/actions.ts "src/app/m/[manageToken]/page.tsx" "src/app/s/[guestToken]/page.tsx" src/components/TimePollSummary.tsx
git commit -m "fix: polish draft poll states"
```

---

### Task 8: Full Verification

**Files:** no required edits unless verification exposes issues.

**Step 1: Run unit tests**

Run:

```bash
npm run test
```

Expected: all tests pass.

**Step 2: Run type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors.

**Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds.

**Step 4: Manual lifecycle smoke test**

Run:

```bash
npm run dev
```

Expected: local dev server starts at `http://localhost:3000`.

Manual flow:

1. Open `/`.
2. Create a poll with at least two time options.
3. Confirm redirect to `/m/[manageToken]?created=1`.
4. Copy the guest link and open `/s/[guestToken]`.
5. Vote for one or more options.
6. Submit again with a different set of checkboxes and confirm the old choices are replaced.
7. Submit with no selected options and confirm the guest is removed from all option summaries.
8. Vote again for the option to finalize.
9. On `/m/[manageToken]`, finalize that option.
10. Confirm manage page now shows finalized session tools.
11. Open `/s/[guestToken]` and confirm selected voters appear under `Going`.
12. Submit `cant` and confirm the voter is no longer in `Going`.
13. Verify attendance and cost still work.
14. View source on `/s/[guestToken]` and confirm the manage token is not present.

**Step 5: Commit fixes if needed**

Only if verification required edits:

```bash
git add <changed-files>
git commit -m "fix: complete time poll verification"
```

---

## Completion Criteria

- Draft poll creation works from `/`.
- Draft guest link accepts multi-option availability votes.
- Returning voters can replace or clear availability.
- Guest and manage pages show option counts and names.
- Organizer can finalize one option from the manage link.
- Voters for the finalized option become `going` participants.
- Non-selected voters are not auto-added.
- Finalized RSVP, attendance, cancellation, and cost behavior still works.
- `npm run test`, `npx tsc --noEmit`, and `npm run build` pass.

