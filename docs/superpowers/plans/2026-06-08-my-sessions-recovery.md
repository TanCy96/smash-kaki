# My Sessions Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give logged-in users a `/sessions` page that recovers the manage links for sessions they organize and the guest links for sessions they joined.

**Architecture:** Add a nullable `manager_id` owner column to `sessions`, set on create when logged in. Two `db.ts` query helpers list active managed sessions (by `manager_id`) and active joined sessions (union of `participants.player_id` and `time_option_votes.player_id`, minus managed). A server-component page renders both lists with recovery links; `AuthNav` gains a "My sessions" link.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase (service-role `admin` client, RLS bypassed), Vitest, Tailwind v4.

---

## Prerequisite (manual, run by the user in Supabase SQL editor)

This DDL is applied manually per the project's migration workflow. Code in this plan
tolerates the column being present; run this before exercising the create flow:

```sql
alter table sessions
  add column manager_id uuid references profiles(id) on delete set null;

create index sessions_manager_idx on sessions (manager_id);
```

## File Structure

- `src/lib/types.ts` (modify) — add `manager_id` to the `Session` interface.
- `src/lib/db.ts` (modify) — add `manager_id` to `createSession` input; add `listSessionsManagedBy` and `listSessionsJoinedBy`.
- `src/app/actions.ts` (modify) — pass `manager_id: playerId` in `createSessionAction`.
- `src/app/actions.test.ts` (modify) — test the `manager_id` wiring.
- `src/lib/db.test.ts` (modify) — test the two new query helpers.
- `src/app/sessions/page.tsx` (create) — the recovery page.
- `src/components/AuthNav.tsx` (modify) — add the "My sessions" link.

---

### Task 1: Add `manager_id` to the Session type and create flow

**Files:**
- Modify: `src/lib/types.ts:5-21`
- Modify: `src/lib/db.ts:21-39`
- Modify: `src/app/actions.ts:62-72`
- Test: `src/app/actions.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/app/actions.test.ts`. It mocks every db call `createSessionAction`
touches and asserts `createSession` receives `manager_id`. Two valid options are
supplied so the action passes the `options.length < 2` guard, and `redirect` is made
to throw so the action stops at the final redirect.

```typescript
describe("createSessionAction manager_id", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
    currentPlayerIdMock.mockReset();
    generateTokenMock.mockReset();
    generateTokenMock.mockReturnValueOnce("manage-tok").mockReturnValueOnce("guest-tok");
    dbMock.createSession = vi.fn().mockResolvedValue({
      id: "session-1",
      manage_token: "manage-tok",
    });
    dbMock.createSessionTimeOptions = vi.fn().mockResolvedValue([]);
    dbMock.replaceTimeOptionVotes.mockReset().mockResolvedValue(undefined);
  });

  function form(): FormData {
    const fd = new FormData();
    fd.set("organizer_name", "Alex");
    fd.set("title", "Friday smash");
    fd.set("location", "Court Centre");
    fd.set("device_token", "device-1");
    fd.append("option_starts_at", "2026-06-12T19:00");
    fd.append("option_duration_min", "120");
    fd.append("option_starts_at", "2026-06-13T19:00");
    fd.append("option_duration_min", "120");
    return fd;
  }

  it("sets manager_id to the current player when logged in", async () => {
    const { createSessionAction } = await import("./actions");
    currentPlayerIdMock.mockResolvedValue("player-1");

    await expect(createSessionAction(form())).rejects.toThrow("redirect:/m/manage-tok?created=1");
    expect(dbMock.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ manager_id: "player-1" })
    );
  });

  it("sets manager_id to null when anonymous", async () => {
    const { createSessionAction } = await import("./actions");
    currentPlayerIdMock.mockResolvedValue(null);

    await expect(createSessionAction(form())).rejects.toThrow("redirect:/m/manage-tok?created=1");
    expect(dbMock.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ manager_id: null })
    );
  });
});
```

Also add `createSession`, `createSessionTimeOptions`, and `deleteSession` to the
`dbMock` object literal at the top of the file if not already present:

```typescript
  createSession: vi.fn(),
  createSessionTimeOptions: vi.fn(),
  deleteSession: vi.fn(),
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/actions.test.ts -t "manager_id"`
Expected: FAIL — `createSession` called without `manager_id` (received object lacks the key).

- [ ] **Step 3: Add `manager_id` to the `Session` type**

In `src/lib/types.ts`, inside `interface Session`, add after `notes`:

```typescript
  manager_id: string | null;
```

- [ ] **Step 4: Add `manager_id` to `createSession` input and pass it through**

In `src/lib/db.ts`, extend the `createSession` input object type (after `lifecycle?`):

```typescript
  manager_id?: string | null;
```

In `src/app/actions.ts`, add `manager_id` to the `db.createSession({ ... })` call
(after `lifecycle: "draft",`):

```typescript
    manager_id: playerId,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/actions.test.ts -t "manager_id"`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/db.ts src/app/actions.ts src/app/actions.test.ts
git commit -m "feat: record manager_id on session create"
```

---

### Task 2: `listSessionsManagedBy` query

**Files:**
- Modify: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/db.test.ts`. Reuses the existing `query` helper (chain ends in
`.order`, which returns the result).

```typescript
import { listSessionsManagedBy } from "./db";

describe("listSessionsManagedBy", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns active sessions owned by the player", async () => {
    const chain = query({
      data: [{ id: "s1", manager_id: "player-1", status: "active" }],
      error: null,
    });
    fromMock.mockReturnValue(chain);

    await expect(listSessionsManagedBy("player-1")).resolves.toEqual([
      { id: "s1", manager_id: "player-1", status: "active" },
    ]);
    expect(fromMock).toHaveBeenCalledWith("sessions");
    expect(chain.eq).toHaveBeenCalledWith("manager_id", "player-1");
    expect(chain.eq).toHaveBeenCalledWith("status", "active");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db.test.ts -t "listSessionsManagedBy"`
Expected: FAIL — `listSessionsManagedBy` is not exported.

- [ ] **Step 3: Implement `listSessionsManagedBy`**

Add to `src/lib/db.ts` (place near the other session reads, after `getSessionByManageToken`):

```typescript
export async function listSessionsManagedBy(
  playerId: string
): Promise<Session[]> {
  const { data, error } = await admin
    .from("sessions")
    .select("*")
    .eq("manager_id", playerId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Session[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db.test.ts -t "listSessionsManagedBy"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "feat: listSessionsManagedBy query"
```

---

### Task 3: `listSessionsJoinedBy` query

**Files:**
- Modify: `src/lib/db.ts`
- Test: `src/lib/db.test.ts`

The function gathers session ids the player joined from two tables, then fetches
those sessions and filters to active + not-managed-by-them in JS (the mock supports
only one terminal method per chain, so status/owner filtering happens in JS).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/db.test.ts`:

```typescript
import { listSessionsJoinedBy } from "./db";

describe("listSessionsJoinedBy", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("unions participant and voter sessions, drops managed and cancelled", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "participants") {
        return query({ data: [{ session_id: "s1" }, { session_id: "s2" }], error: null });
      }
      if (table === "time_option_votes") {
        return query({ data: [{ session_id: "s2" }, { session_id: "s3" }], error: null });
      }
      // sessions
      return query({
        data: [
          { id: "s1", status: "active", manager_id: null, created_at: "2026-06-01" },
          { id: "s2", status: "cancelled", manager_id: null, created_at: "2026-06-02" },
          { id: "s3", status: "active", manager_id: "player-1", created_at: "2026-06-03" },
        ],
        error: null,
      });
    });

    const result = await listSessionsJoinedBy("player-1");
    expect(result.map((s) => s.id)).toEqual(["s1"]); // s2 cancelled, s3 managed
  });

  it("returns empty without querying sessions when no joins exist", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "sessions") throw new Error("should not query sessions");
      return query({ data: [], error: null });
    });

    await expect(listSessionsJoinedBy("player-1")).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/db.test.ts -t "listSessionsJoinedBy"`
Expected: FAIL — `listSessionsJoinedBy` is not exported.

- [ ] **Step 3: Implement `listSessionsJoinedBy`**

Add to `src/lib/db.ts` (after `listSessionsManagedBy`):

```typescript
export async function listSessionsJoinedBy(
  playerId: string
): Promise<Session[]> {
  const [participantRows, voteRows] = await Promise.all([
    admin
      .from("participants")
      .select("session_id")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false }),
    admin
      .from("time_option_votes")
      .select("session_id")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false }),
  ]);
  if (participantRows.error) throw participantRows.error;
  if (voteRows.error) throw voteRows.error;

  const ids = [
    ...new Set(
      [...(participantRows.data ?? []), ...(voteRows.data ?? [])].map(
        (row) => (row as { session_id: string }).session_id
      )
    ),
  ];
  if (ids.length === 0) return [];

  const { data, error } = await admin
    .from("sessions")
    .select("*")
    .in("id", ids);
  if (error) throw error;

  return (data as Session[])
    .filter((s) => s.status === "active" && s.manager_id !== playerId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/db.test.ts -t "listSessionsJoinedBy"`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/db.test.ts
git commit -m "feat: listSessionsJoinedBy query"
```

---

### Task 4: The `/sessions` page

**Files:**
- Create: `src/app/sessions/page.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/sessions/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Badge, Card, PageShell } from "@/components/ui";
import { formatMalaysiaDateTime } from "@/lib/datetime";
import { listSessionsJoinedBy, listSessionsManagedBy } from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";
import type { Session } from "@/lib/types";

function SessionRow({
  session,
  href,
  url,
  copyLabel,
}: {
  session: Session;
  href: string;
  url: string;
  copyLabel: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge tone={session.lifecycle === "draft" ? "draft" : "confirmed"}>
            {session.lifecycle === "draft" ? "Poll" : "Confirmed"}
          </Badge>
          <Link href={href} className="truncate font-semibold text-heading hover:underline">
            {session.title}
          </Link>
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {session.starts_at ? `${formatMalaysiaDateTime(session.starts_at)} - ` : ""}
          {session.location}
        </p>
      </div>
      <CopyLinkButton url={url} label={copyLabel} />
    </li>
  );
}

export default async function MySessionsPage() {
  const playerId = await currentPlayerId();
  if (!playerId) redirect("/login");

  const [managing, joined] = await Promise.all([
    listSessionsManagedBy(playerId),
    listSessionsJoinedBy(playerId),
  ]);

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  return (
    <PageShell headerRight={<AuthNav playerId={playerId} />}>
      <div>
        <h1 className="text-2xl font-extrabold text-heading">My sessions</h1>
        <p className="mt-1 text-sm text-muted">
          Recover the links for sessions you organize or have joined.
        </p>
      </div>

      <Card title={`Organizing (${managing.length})`}>
        {managing.length === 0 ? (
          <p className="text-sm text-muted">You're not organizing any active sessions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {managing.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                href={`/m/${session.manage_token}`}
                url={`${base}/m/${session.manage_token}`}
                copyLabel="Copy manage link"
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Joined (${joined.length})`}>
        {joined.length === 0 ? (
          <p className="text-sm text-muted">You haven't joined any active sessions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {joined.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                href={`/s/${session.guest_token}`}
                url={`${base}/s/${session.guest_token}`}
                copyLabel="Copy guest link"
              />
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/sessions/page.tsx
git commit -m "feat: My sessions recovery page"
```

---

### Task 5: "My sessions" link in AuthNav

**Files:**
- Modify: `src/components/AuthNav.tsx:29-40`

- [ ] **Step 1: Add the link to the signed-in branch**

In `src/components/AuthNav.tsx`, replace the signed-in `return` block (the `if (playerId)`
branch) with one that includes a "My sessions" link before the log-out form:

```tsx
  if (playerId) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/sessions" className="font-semibold text-primary hover:underline">
          My sessions
        </Link>
        <form action={logoutAction} className="flex items-center gap-3">
          <span className="max-w-32 truncate font-medium text-muted">
            {displayName || "Signed in"}
          </span>
          <Button variant="ghost" className="px-2 py-1">
            Log out
          </Button>
        </form>
      </div>
    );
  }
```

(`Link` is already imported at the top of the file.)

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthNav.tsx
git commit -m "feat: link to My sessions from header"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit; npm run build`
Expected: clean type-check; build succeeds with `/sessions` listed in the route table.

- [ ] **Step 3: Manual smoke (after the DDL is applied in Supabase)**

  1. Log in, create a session → confirm redirect to `/m/...`.
  2. Visit `/sessions` → the new session appears under **Organizing** with a working
     "Copy manage link" and a link to the manage page.
  3. From another account (or after RSVP/voting), confirm the session shows under **Joined**.
  4. Visit `/sessions` while logged out → redirected to `/login`.

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1 + prerequisite DDL), `listSessionsManagedBy`
  (Task 2), `listSessionsJoinedBy` participant∪voter union (Task 3), `/sessions` page
  with both sections + empty states + copy buttons (Task 4), AuthNav link (Task 5),
  db + action tests (Tasks 1–3), logged-out redirect (Task 4). All spec sections covered.
- **Out of scope (unchanged):** no backfill, no archive view, no recently-visited tracking,
  no post-login redirect to `/sessions`.
- **Type consistency:** `manager_id: string | null` is defined in Task 1 and consumed in
  Tasks 2–4; query helpers return `Session[]` and the page consumes `Session`.
