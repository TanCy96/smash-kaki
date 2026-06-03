# SmashKaki MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Commit policy for this project:** The user runs `git commit` themselves. Commit
> steps below mark logical checkpoints — when executing, STOP at each "Commit"
> step and let the user commit rather than auto-committing.

**Goal:** A no-login, link-shared web app for organizing badminton sessions
(time/location/court), collecting RSVPs, verifying attendance, and recording
cost (court + shuttlecocks) with an equal per-head split — usable on phone or PC.

**Architecture:** Next.js (App Router, TypeScript) on the Node runtime. Data and
auth in Supabase (Postgres + Supabase Auth). All DB access runs server-side via a
service-role client; access is gated by unguessable URL tokens (a secret *manage*
token and a shareable *guest* token per session). Optional Supabase email+password
accounts give players cross-device identity; anonymous RSVP always works. Built
vendor-portable (standard Next.js + standard Postgres) so it can later self-host
on a NAS via config changes only.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase
(`@supabase/supabase-js`, `@supabase/ssr`) · `nanoid` (tokens) · `zod`
(validation) · Vitest (unit tests).

---

## File Structure

```
D:\Projects\smash-kaki\
  src/
    lib/
      cost.ts            # pure cost math (total, per-head, remainder)
      tokens.ts          # nanoid token generation
      identity.ts        # pure RSVP identity-resolution logic
      types.ts           # shared TS types (Session, Participant, etc.)
      db.ts              # server-only Supabase service-role client + query helpers
      supabase-auth.ts   # @supabase/ssr browser/server auth clients
    app/
      page.tsx                       # "/"  create-session form
      actions.ts                     # server actions (create/edit/rsvp/verify/cost)
      s/[guestToken]/page.tsx        # guest view + RSVP + post-session summary
      m/[manageToken]/page.tsx       # manage view: edit, verify, cost
      (auth)/login/page.tsx
      (auth)/register/page.tsx
      (auth)/forgot-password/page.tsx
      not-found.tsx
    components/
      CopyLinkButton.tsx
      RsvpForm.tsx
      AttendanceVerify.tsx
      CostForm.tsx
  supabase/
    schema.sql           # tables + indexes (run in Supabase SQL editor)
  src/lib/__tests__/     # Vitest unit tests
  .env.local             # secrets (gitignored)
  docs/plans/            # this plan
```

**Boundaries:** `cost.ts`, `tokens.ts`, `identity.ts` are pure (no I/O) → fully
unit-tested. `db.ts` is the only module that touches Supabase data. Pages/actions
compose these; they never embed business math or token logic inline.

---

## Task 0: Scaffold project

**Files:** whole project skeleton.

- [ ] **Step 1: Scaffold Next.js into the existing folder**

Run (from `D:\Projects\smash-kaki`, which already exists and is empty):
```bash
npx create-next-app@latest . --ts --app --tailwind --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
Expected: project files created in place; `npm` deps installed.

- [ ] **Step 2: Install runtime + test dependencies**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr nanoid zod
npm install -D vitest @vitejs/plugin-react jsdom
```
Expected: packages added to `package.json`.

- [ ] **Step 3: Add Vitest config and test script**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```
Add to `package.json` "scripts": `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Verify the scaffold builds and tests run**

Run: `npm run build` → Expected: build succeeds.
Run: `npm run test` → Expected: "No test files found" (exit 0) — runner works.

- [ ] **Step 5: Add `.env.local` template (gitignored) and confirm `.gitignore`**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Confirm `.gitignore` already contains `.env*` (create-next-app adds it). Copy to
`.env.local` and fill after Task 1.

- [ ] **Step 6: Commit** (user runs it)

```bash
git add -A && git commit -m "chore: scaffold SmashKaki Next.js + Supabase + Vitest"
```

---

## Task 1: Supabase schema

**Files:** Create `supabase/schema.sql`.

- [ ] **Step 1: Create a Supabase project (manual, in dashboard)**

In supabase.com: create project. In **Authentication → Providers → Email**,
DISABLE "Confirm email" (no signup OTP). Copy Project URL, anon key, and service
role key into `.env.local`.

- [ ] **Step 2: Write the schema**

Create `supabase/schema.sql`:
```sql
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  manage_token text not null unique,
  guest_token  text not null unique,
  title text not null,
  starts_at timestamptz not null,
  duration_min int not null,
  location text not null,
  court_numbers text,
  notes text,
  status text not null default 'active' check (status in ('active','cancelled')),
  court_cost numeric,
  shuttles_used int,
  price_per_shuttle numeric,
  created_at timestamptz not null default now()
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  rsvp text not null check (rsvp in ('going','maybe','cant')),
  attended boolean not null default false,
  participant_token text not null,
  player_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index sessions_guest_token_idx  on sessions (guest_token);
create index sessions_manage_token_idx on sessions (manage_token);
create index participants_session_idx  on participants (session_id);

-- RLS on; data access is via the server service-role key (bypasses RLS).
-- The anon client is used ONLY for auth flows, never for table reads/writes.
alter table profiles     enable row level security;
alter table sessions     enable row level security;
alter table participants enable row level security;
```

- [ ] **Step 3: Apply it**

Paste `schema.sql` into Supabase SQL Editor and run.
Expected: tables `profiles`, `sessions`, `participants` exist (check Table editor).

- [ ] **Step 4: Commit** (user runs it)

```bash
git add supabase/schema.sql && git commit -m "feat: add Supabase schema"
```

---

## Task 2: Shared types

**Files:** Create `src/lib/types.ts`.

- [ ] **Step 1: Define types** (no test — type-only)

```ts
export type Rsvp = "going" | "maybe" | "cant";
export type SessionStatus = "active" | "cancelled";

export interface Session {
  id: string;
  manage_token: string;
  guest_token: string;
  title: string;
  starts_at: string;       // ISO
  duration_min: number;
  location: string;
  court_numbers: string | null;
  notes: string | null;
  status: SessionStatus;
  court_cost: number | null;
  shuttles_used: number | null;
  price_per_shuttle: number | null;
  created_at: string;
}

export interface Participant {
  id: string;
  session_id: string;
  name: string;
  rsvp: Rsvp;
  attended: boolean;
  participant_token: string;
  player_id: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Commit** (user runs it) — bundle with Task 3.

---

## Task 3: Cost math (pure, TDD)

**Files:** Create `src/lib/cost.ts`, `src/lib/cost.test.ts`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/cost.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeCost } from "./cost";

describe("computeCost", () => {
  it("sums court cost and shuttle cost into total", () => {
    const r = computeCost({ courtCost: 40, shuttlesUsed: 3, pricePerShuttle: 5, attendedCount: 4 });
    expect(r.total).toBe(55);            // 40 + 3*5
  });

  it("splits equally per attendee, rounded to 2 dp", () => {
    const r = computeCost({ courtCost: 40, shuttlesUsed: 3, pricePerShuttle: 5, attendedCount: 4 });
    expect(r.perHead).toBe(13.75);       // 55 / 4
  });

  it("returns null perHead when nobody attended", () => {
    const r = computeCost({ courtCost: 40, shuttlesUsed: 3, pricePerShuttle: 5, attendedCount: 0 });
    expect(r.perHead).toBeNull();
    expect(r.remainder).toBe(0);
  });

  it("reports the rounding remainder", () => {
    const r = computeCost({ courtCost: 10, shuttlesUsed: 0, pricePerShuttle: 0, attendedCount: 3 });
    expect(r.perHead).toBe(3.33);        // 10/3 = 3.333..
    expect(r.remainder).toBeCloseTo(0.01, 5); // 10 - 3.33*3 = 0.01
  });

  it("treats missing cost components as zero", () => {
    const r = computeCost({ courtCost: null, shuttlesUsed: null, pricePerShuttle: null, attendedCount: 2 });
    expect(r.total).toBe(0);
    expect(r.perHead).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test` → Expected: FAIL ("Cannot find module './cost'").

- [ ] **Step 3: Implement**

Create `src/lib/cost.ts`:
```ts
export interface CostInput {
  courtCost: number | null;
  shuttlesUsed: number | null;
  pricePerShuttle: number | null;
  attendedCount: number;
}
export interface CostResult {
  total: number;
  perHead: number | null;   // null when attendedCount === 0
  remainder: number;        // total - perHead*attendedCount (rounding leftover)
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeCost(input: CostInput): CostResult {
  const court = input.courtCost ?? 0;
  const shuttles = (input.shuttlesUsed ?? 0) * (input.pricePerShuttle ?? 0);
  const total = round2(court + shuttles);
  if (input.attendedCount <= 0) return { total, perHead: null, remainder: 0 };
  const perHead = round2(total / input.attendedCount);
  const remainder = round2(total - perHead * input.attendedCount);
  return { total, perHead, remainder };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test` → Expected: PASS (all 5).

- [ ] **Step 5: Commit** (user runs it)

```bash
git add src/lib/types.ts src/lib/cost.ts src/lib/cost.test.ts
git commit -m "feat: cost computation with equal per-head split"
```

---

## Task 4: Tokens (pure, TDD)

**Files:** Create `src/lib/tokens.ts`, `src/lib/tokens.test.ts`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/tokens.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateToken } from "./tokens";

describe("generateToken", () => {
  it("returns a 22-char url-safe string", () => {
    const t = generateToken();
    expect(t).toHaveLength(22);
    expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
  it("returns distinct values", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test` → Expected: FAIL ("Cannot find module './tokens'").

- [ ] **Step 3: Implement**

Create `src/lib/tokens.ts`:
```ts
import { nanoid } from "nanoid";
export const generateToken = (): string => nanoid(22);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test` → Expected: PASS.

- [ ] **Step 5: Commit** (user runs it)

```bash
git add src/lib/tokens.ts src/lib/tokens.test.ts
git commit -m "feat: unguessable session tokens"
```

---

## Task 5: Identity resolution (pure, TDD)

**Files:** Create `src/lib/identity.ts`, `src/lib/identity.test.ts`.

Resolves who an incoming RSVP belongs to, in priority order: logged-in player →
returning device token → duplicate name → new.

- [ ] **Step 1: Write failing tests**

Create `src/lib/identity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveIdentity } from "./identity";
import type { Participant } from "./types";

const p = (over: Partial<Participant>): Participant => ({
  id: "x", session_id: "s", name: "Alex", rsvp: "going", attended: false,
  participant_token: "dev1", player_id: null, created_at: "", ...over,
});

describe("resolveIdentity", () => {
  it("matches a logged-in player to their existing participant row", () => {
    const existing = [p({ id: "1", player_id: "player-7" })];
    const r = resolveIdentity({ loggedInPlayerId: "player-7", deviceToken: null, name: "Alex", existing });
    expect(r).toEqual({ kind: "logged-in", participantId: "1" });
  });
  it("matches a returning device token", () => {
    const existing = [p({ id: "2", participant_token: "dev-abc" })];
    const r = resolveIdentity({ loggedInPlayerId: null, deviceToken: "dev-abc", name: "Sam", existing });
    expect(r).toEqual({ kind: "device", participantId: "2" });
  });
  it("warns on duplicate name (case-insensitive) when no token/login match", () => {
    const existing = [p({ id: "3", name: "Alex" })];
    const r = resolveIdentity({ loggedInPlayerId: null, deviceToken: "new-dev", name: "alex", existing });
    expect(r).toEqual({ kind: "duplicate-name", participantId: "3" });
  });
  it("treats as new when nothing matches", () => {
    const r = resolveIdentity({ loggedInPlayerId: null, deviceToken: "new-dev", name: "Jo", existing: [] });
    expect(r).toEqual({ kind: "new" });
  });
  it("prefers login over device token", () => {
    const existing = [p({ id: "4", player_id: "player-7" }), p({ id: "5", participant_token: "dev-x" })];
    const r = resolveIdentity({ loggedInPlayerId: "player-7", deviceToken: "dev-x", name: "Alex", existing });
    expect(r).toEqual({ kind: "logged-in", participantId: "4" });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test` → Expected: FAIL ("Cannot find module './identity'").

- [ ] **Step 3: Implement**

Create `src/lib/identity.ts`:
```ts
import type { Participant } from "./types";

export type IdentityMatch =
  | { kind: "logged-in"; participantId: string }
  | { kind: "device"; participantId: string }
  | { kind: "duplicate-name"; participantId: string }
  | { kind: "new" };

export function resolveIdentity(args: {
  loggedInPlayerId: string | null;
  deviceToken: string | null;
  name: string;
  existing: Participant[];
}): IdentityMatch {
  const { loggedInPlayerId, deviceToken, name, existing } = args;

  if (loggedInPlayerId) {
    const m = existing.find((e) => e.player_id === loggedInPlayerId);
    if (m) return { kind: "logged-in", participantId: m.id };
  }
  if (deviceToken) {
    const m = existing.find((e) => e.participant_token === deviceToken);
    if (m) return { kind: "device", participantId: m.id };
  }
  const lower = name.trim().toLowerCase();
  const dup = existing.find((e) => e.name.trim().toLowerCase() === lower);
  if (dup) return { kind: "duplicate-name", participantId: dup.id };

  return { kind: "new" };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test` → Expected: PASS (all 5).

- [ ] **Step 5: Commit** (user runs it)

```bash
git add src/lib/identity.ts src/lib/identity.test.ts
git commit -m "feat: RSVP identity resolution"
```

---

## Task 6: DB access layer

**Files:** Create `src/lib/db.ts`.

Server-only. Uses the service-role key (never imported by client components).

- [ ] **Step 1: Implement the client + helpers**

Create `src/lib/db.ts`:
```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Session, Participant, Rsvp } from "./types";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function createSession(input: {
  manage_token: string; guest_token: string; title: string; starts_at: string;
  duration_min: number; location: string; court_numbers: string | null; notes: string | null;
}): Promise<Session> {
  const { data, error } = await admin.from("sessions").insert(input).select().single();
  if (error) throw error;
  return data as Session;
}

export async function getSessionByGuestToken(t: string): Promise<Session | null> {
  const { data } = await admin.from("sessions").select("*").eq("guest_token", t).maybeSingle();
  return (data as Session) ?? null;
}
export async function getSessionByManageToken(t: string): Promise<Session | null> {
  const { data } = await admin.from("sessions").select("*").eq("manage_token", t).maybeSingle();
  return (data as Session) ?? null;
}

export async function updateSessionDetails(id: string, patch: Partial<Pick<Session,
  "title"|"starts_at"|"duration_min"|"location"|"court_numbers"|"notes"|"status">>): Promise<void> {
  const { error } = await admin.from("sessions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setSessionCost(id: string, cost: {
  court_cost: number | null; shuttles_used: number | null; price_per_shuttle: number | null;
}): Promise<void> {
  const { error } = await admin.from("sessions").update(cost).eq("id", id);
  if (error) throw error;
}

export async function listParticipants(sessionId: string): Promise<Participant[]> {
  const { data } = await admin.from("participants").select("*")
    .eq("session_id", sessionId).order("created_at", { ascending: true });
  return (data as Participant[]) ?? [];
}

export async function insertParticipant(input: {
  session_id: string; name: string; rsvp: Rsvp; participant_token: string; player_id: string | null;
}): Promise<Participant> {
  const { data, error } = await admin.from("participants").insert(input).select().single();
  if (error) throw error;
  return data as Participant;
}

export async function updateParticipant(id: string, patch: Partial<Pick<Participant,
  "name"|"rsvp"|"attended"|"player_id">>): Promise<void> {
  const { error } = await admin.from("participants").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setAttendance(sessionId: string, attendedIds: string[]): Promise<void> {
  // reset then set, scoped to this session
  await admin.from("participants").update({ attended: false }).eq("session_id", sessionId);
  if (attendedIds.length) {
    const { error } = await admin.from("participants").update({ attended: true }).in("id", attendedIds);
    if (error) throw error;
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Commit** (user runs it)

```bash
git add src/lib/db.ts && git commit -m "feat: server-side Supabase data access layer"
```

---

## Task 7: Auth clients (Supabase SSR)

**Files:** Create `src/lib/supabase-auth.ts`.

- [ ] **Step 1: Implement browser + server auth clients**

Create `src/lib/supabase-auth.ts`:
```ts
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const browserAuth = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

export async function serverAuth() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    }
  );
}

/** Returns the logged-in player's id (= auth user id) or null. */
export async function currentPlayerId(): Promise<string | null> {
  const sb = await serverAuth();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Commit** (user runs it)

```bash
git add src/lib/supabase-auth.ts && git commit -m "feat: Supabase SSR auth clients"
```

---

## Task 8: Server actions

**Files:** Create `src/app/actions.ts`.

Wires pure logic + db together. Validated with zod.

- [ ] **Step 1: Implement actions**

Create `src/app/actions.ts`:
```ts
"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { generateToken } from "@/lib/tokens";
import { resolveIdentity } from "@/lib/identity";
import { currentPlayerId } from "@/lib/supabase-auth";
import * as db from "@/lib/db";

const createSchema = z.object({
  title: z.string().min(1),
  starts_at: z.string().min(1),
  duration_min: z.coerce.number().int().positive(),
  location: z.string().min(1),
  court_numbers: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createSessionAction(formData: FormData) {
  const v = createSchema.parse(Object.fromEntries(formData));
  const s = await db.createSession({
    manage_token: generateToken(),
    guest_token: generateToken(),
    title: v.title,
    starts_at: new Date(v.starts_at).toISOString(),
    duration_min: v.duration_min,
    location: v.location,
    court_numbers: v.court_numbers || null,
    notes: v.notes || null,
  });
  redirect(`/m/${s.manage_token}?created=1`);
}

const rsvpSchema = z.object({
  guest_token: z.string(),
  name: z.string().min(1),
  rsvp: z.enum(["going", "maybe", "cant"]),
  device_token: z.string().min(1),
});

export async function rsvpAction(formData: FormData) {
  const v = rsvpSchema.parse(Object.fromEntries(formData));
  const session = await db.getSessionByGuestToken(v.guest_token);
  if (!session || session.status === "cancelled") return;
  const playerId = await currentPlayerId();
  const existing = await db.listParticipants(session.id);
  const match = resolveIdentity({
    loggedInPlayerId: playerId, deviceToken: v.device_token, name: v.name, existing,
  });
  if (match.kind === "new") {
    await db.insertParticipant({
      session_id: session.id, name: v.name, rsvp: v.rsvp,
      participant_token: v.device_token, player_id: playerId,
    });
  } else {
    await db.updateParticipant(match.participantId, {
      name: v.name, rsvp: v.rsvp, player_id: playerId,
    });
  }
}

const editSchema = z.object({
  manage_token: z.string(),
  title: z.string().min(1),
  starts_at: z.string().min(1),
  duration_min: z.coerce.number().int().positive(),
  location: z.string().min(1),
  court_numbers: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function editSessionAction(formData: FormData) {
  const v = editSchema.parse(Object.fromEntries(formData));
  const session = await db.getSessionByManageToken(v.manage_token);
  if (!session) return;
  await db.updateSessionDetails(session.id, {
    title: v.title, starts_at: new Date(v.starts_at).toISOString(),
    duration_min: v.duration_min, location: v.location,
    court_numbers: v.court_numbers || null, notes: v.notes || null,
  });
}

export async function cancelSessionAction(formData: FormData) {
  const manage = String(formData.get("manage_token"));
  const session = await db.getSessionByManageToken(manage);
  if (session) await db.updateSessionDetails(session.id, { status: "cancelled" });
}

export async function verifyAttendanceAction(formData: FormData) {
  const manage = String(formData.get("manage_token"));
  const session = await db.getSessionByManageToken(manage);
  if (!session) return;
  const ids = formData.getAll("attended").map(String);
  await db.setAttendance(session.id, ids);
}

const costSchema = z.object({
  manage_token: z.string(),
  court_cost: z.coerce.number().nonnegative().optional(),
  shuttles_used: z.coerce.number().int().nonnegative().optional(),
  price_per_shuttle: z.coerce.number().nonnegative().optional(),
});

export async function setCostAction(formData: FormData) {
  const v = costSchema.parse(Object.fromEntries(formData));
  const session = await db.getSessionByManageToken(v.manage_token);
  if (!session) return;
  await db.setSessionCost(session.id, {
    court_cost: v.court_cost ?? null,
    shuttles_used: v.shuttles_used ?? null,
    price_per_shuttle: v.price_per_shuttle ?? null,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Commit** (user runs it)

```bash
git add src/app/actions.ts && git commit -m "feat: server actions (create/rsvp/edit/verify/cost)"
```

---

## Task 9: Create page (`/`)

**Files:** Create `src/app/page.tsx`, `src/components/CopyLinkButton.tsx`.

- [ ] **Step 1: Copy-link button (client component)**

Create `src/components/CopyLinkButton.tsx`:
```tsx
"use client";
import { useState } from "react";

export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="rounded bg-emerald-600 px-3 py-2 text-sm text-white"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
```

- [ ] **Step 2: Create page**

Create `src/app/page.tsx`:
```tsx
import { createSessionAction } from "./actions";

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-2xl font-bold">SmashKaki 🏸</h1>
      <p className="mb-4 text-sm text-gray-600">Set up a badminton session and share the link.</p>
      <form action={createSessionAction} className="flex flex-col gap-3">
        <input name="title" placeholder="Session title (e.g. Friday Smash)" required className="rounded border p-2" />
        <label className="text-sm">Date & time
          <input name="starts_at" type="datetime-local" required className="w-full rounded border p-2" />
        </label>
        <label className="text-sm">Duration (minutes)
          <input name="duration_min" type="number" min="1" defaultValue={120} required className="w-full rounded border p-2" />
        </label>
        <input name="location" placeholder="Location (e.g. ABC Sports Hall)" required className="rounded border p-2" />
        <input name="court_numbers" placeholder="Court number(s) — editable later" className="rounded border p-2" />
        <textarea name="notes" placeholder="Notes (optional)" className="rounded border p-2" />
        <button className="rounded bg-emerald-600 p-2 font-semibold text-white">Create session</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Manual check**

Run: `npm run dev`, open `http://localhost:3000`, submit the form.
Expected: redirect to `/m/<token>?created=1` (manage page built in Task 11).

- [ ] **Step 4: Commit** (user runs it)

```bash
git add src/app/page.tsx src/components/CopyLinkButton.tsx
git commit -m "feat: create-session page"
```

---

## Task 10: Guest view + RSVP (`/s/[guestToken]`)

**Files:** Create `src/app/s/[guestToken]/page.tsx`, `src/components/RsvpForm.tsx`.

- [ ] **Step 1: RSVP form (client; manages the device token)**

Create `src/components/RsvpForm.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { rsvpAction } from "@/app/actions";

function deviceToken(): string {
  const k = "smashkaki_device_token";
  let t = localStorage.getItem(k);
  if (!t) { t = crypto.randomUUID(); localStorage.setItem(k, t); }
  return t;
}

export function RsvpForm({ guestToken, disabled }: { guestToken: string; disabled: boolean }) {
  const [token, setToken] = useState("");
  useEffect(() => setToken(deviceToken()), []);
  if (disabled) return <p className="text-sm text-gray-500">RSVP closed — session cancelled.</p>;
  return (
    <form action={rsvpAction} className="flex flex-col gap-2">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <input name="name" placeholder="Your name" required className="rounded border p-2" />
      <div className="flex gap-2">
        <label><input type="radio" name="rsvp" value="going" defaultChecked /> Going</label>
        <label><input type="radio" name="rsvp" value="maybe" /> Maybe</label>
        <label><input type="radio" name="rsvp" value="cant" /> Can't</label>
      </div>
      <button className="rounded bg-emerald-600 p-2 text-white">Submit RSVP</button>
    </form>
  );
}
```

- [ ] **Step 2: Guest page (server component)**

Create `src/app/s/[guestToken]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getSessionByGuestToken, listParticipants } from "@/lib/db";
import { computeCost } from "@/lib/cost";
import { RsvpForm } from "@/components/RsvpForm";

export default async function GuestPage({ params }: { params: Promise<{ guestToken: string }> }) {
  const { guestToken } = await params;
  const session = await getSessionByGuestToken(guestToken);
  if (!session) notFound();

  const participants = await listParticipants(session.id);
  const going = participants.filter((p) => p.rsvp === "going");
  const attended = participants.filter((p) => p.attended);
  const cost = computeCost({
    courtCost: session.court_cost, shuttlesUsed: session.shuttles_used,
    pricePerShuttle: session.price_per_shuttle, attendedCount: attended.length,
  });
  const hasCost = session.court_cost != null || session.shuttles_used != null;

  return (
    <main className="mx-auto max-w-md p-4">
      {session.status === "cancelled" && (
        <div className="mb-3 rounded bg-red-100 p-2 text-red-800">This session was cancelled.</div>
      )}
      <h1 className="text-2xl font-bold">{session.title}</h1>
      <p>{new Date(session.starts_at).toLocaleString()} · {session.duration_min} min</p>
      <p>📍 {session.location}{session.court_numbers ? ` · Court ${session.court_numbers}` : ""}</p>
      {session.notes && <p className="text-sm text-gray-600">{session.notes}</p>}

      <h2 className="mt-4 font-semibold">RSVP</h2>
      <RsvpForm guestToken={guestToken} disabled={session.status === "cancelled"} />

      <h2 className="mt-4 font-semibold">Going ({going.length})</h2>
      <ul className="list-disc pl-5">{going.map((p) => <li key={p.id}>{p.name}</li>)}</ul>

      {hasCost && (
        <div className="mt-4 rounded bg-gray-100 p-3">
          <h2 className="font-semibold">Cost summary</h2>
          <p>Total: RM {cost.total.toFixed(2)}</p>
          <p>Attended: {attended.length}</p>
          <p>Per person: {cost.perHead == null ? "—" : `RM ${cost.perHead.toFixed(2)}`}</p>
          {cost.remainder !== 0 && <p className="text-xs text-gray-500">Rounding leftover: RM {cost.remainder.toFixed(2)}</p>}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Manual check**

With a session created, open `/s/<guest_token>`, submit an RSVP, refresh.
Expected: your name appears under "Going"; re-submitting from the same browser
updates rather than duplicates (device-token match).

- [ ] **Step 4: Commit** (user runs it)

```bash
git add "src/app/s/[guestToken]/page.tsx" src/components/RsvpForm.tsx
git commit -m "feat: guest view + RSVP"
```

---

## Task 11: Manage view (`/m/[manageToken]`)

**Files:** Create `src/app/m/[manageToken]/page.tsx`, `src/components/AttendanceVerify.tsx`, `src/components/CostForm.tsx`.

- [ ] **Step 1: Attendance verify (client)**

Create `src/components/AttendanceVerify.tsx`:
```tsx
"use client";
import { verifyAttendanceAction } from "@/app/actions";
import type { Participant } from "@/lib/types";

export function AttendanceVerify({ manageToken, participants }: { manageToken: string; participants: Participant[] }) {
  return (
    <form action={verifyAttendanceAction} className="flex flex-col gap-1">
      <input type="hidden" name="manage_token" value={manageToken} />
      {participants.map((p) => (
        <label key={p.id} className="flex items-center gap-2">
          <input type="checkbox" name="attended" value={p.id} defaultChecked={p.attended} />
          {p.name} <span className="text-xs text-gray-500">({p.rsvp})</span>
        </label>
      ))}
      <button className="mt-2 rounded bg-emerald-600 p-2 text-white">Save attendance</button>
    </form>
  );
}
```

- [ ] **Step 2: Cost form (client)**

Create `src/components/CostForm.tsx`:
```tsx
"use client";
import { setCostAction } from "@/app/actions";
import type { Session } from "@/lib/types";

export function CostForm({ session }: { session: Session }) {
  return (
    <form action={setCostAction} className="flex flex-col gap-2">
      <input type="hidden" name="manage_token" value={session.manage_token} />
      <label className="text-sm">Court cost (RM)
        <input name="court_cost" type="number" step="0.01" min="0" defaultValue={session.court_cost ?? ""} className="w-full rounded border p-2" />
      </label>
      <label className="text-sm">Shuttles used
        <input name="shuttles_used" type="number" min="0" defaultValue={session.shuttles_used ?? ""} className="w-full rounded border p-2" />
      </label>
      <label className="text-sm">Price per shuttle (RM)
        <input name="price_per_shuttle" type="number" step="0.01" min="0" defaultValue={session.price_per_shuttle ?? ""} className="w-full rounded border p-2" />
      </label>
      <button className="rounded bg-emerald-600 p-2 text-white">Save cost</button>
    </form>
  );
}
```

- [ ] **Step 3: Manage page (server)**

Create `src/app/m/[manageToken]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getSessionByManageToken, listParticipants } from "@/lib/db";
import { computeCost } from "@/lib/cost";
import { editSessionAction, cancelSessionAction } from "@/app/actions";
import { AttendanceVerify } from "@/components/AttendanceVerify";
import { CostForm } from "@/components/CostForm";
import { CopyLinkButton } from "@/components/CopyLinkButton";

function toLocalInput(iso: string) { return new Date(iso).toISOString().slice(0, 16); }

export default async function ManagePage({
  params, searchParams,
}: { params: Promise<{ manageToken: string }>; searchParams: Promise<{ created?: string }> }) {
  const { manageToken } = await params;
  const { created } = await searchParams;
  const session = await getSessionByManageToken(manageToken);
  if (!session) notFound();
  const participants = await listParticipants(session.id);
  const attended = participants.filter((p) => p.attended).length;
  const cost = computeCost({
    courtCost: session.court_cost, shuttlesUsed: session.shuttles_used,
    pricePerShuttle: session.price_per_shuttle, attendedCount: attended,
  });
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const guestUrl = `${base}/s/${session.guest_token}`;
  const manageUrl = `${base}/m/${session.manage_token}`;

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-bold">Manage: {session.title}</h1>
      {created && <p className="rounded bg-emerald-100 p-2 text-emerald-900">Session created! Share the guest link below.</p>}

      <div className="my-3 flex flex-col gap-2 rounded bg-gray-100 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm">Guest link: {guestUrl}</span>
          <CopyLinkButton url={guestUrl} label="Copy guest link" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm">Manage link (keep secret): {manageUrl}</span>
          <CopyLinkButton url={manageUrl} label="Copy manage link" />
        </div>
      </div>

      <h2 className="mt-4 font-semibold">Edit details</h2>
      <form action={editSessionAction} className="flex flex-col gap-2">
        <input type="hidden" name="manage_token" value={manageToken} />
        <input name="title" defaultValue={session.title} required className="rounded border p-2" />
        <input name="starts_at" type="datetime-local" defaultValue={toLocalInput(session.starts_at)} required className="rounded border p-2" />
        <input name="duration_min" type="number" min="1" defaultValue={session.duration_min} required className="rounded border p-2" />
        <input name="location" defaultValue={session.location} required className="rounded border p-2" />
        <input name="court_numbers" defaultValue={session.court_numbers ?? ""} placeholder="Court number(s)" className="rounded border p-2" />
        <textarea name="notes" defaultValue={session.notes ?? ""} className="rounded border p-2" />
        <button className="rounded bg-emerald-600 p-2 text-white">Save changes</button>
      </form>

      <h2 className="mt-4 font-semibold">Verify attendance</h2>
      <AttendanceVerify manageToken={manageToken} participants={participants} />

      <h2 className="mt-4 font-semibold">Cost</h2>
      <CostForm session={session} />
      <div className="mt-2 rounded bg-gray-100 p-3">
        <p>Total: RM {cost.total.toFixed(2)} · Attended: {attended}</p>
        <p>Per person: {cost.perHead == null ? "—" : `RM ${cost.perHead.toFixed(2)}`}</p>
      </div>

      {session.status !== "cancelled" && (
        <form action={cancelSessionAction} className="mt-4">
          <input type="hidden" name="manage_token" value={manageToken} />
          <button className="rounded bg-red-600 p-2 text-sm text-white">Cancel session</button>
        </form>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Add `NEXT_PUBLIC_BASE_URL` to `.env.local`** (`http://localhost:3000` for dev).

- [ ] **Step 5: Manual check** — create → edit court number → RSVP from another browser → verify attendance → enter cost → confirm per-head on both manage and guest pages.

- [ ] **Step 6: Commit** (user runs it)

```bash
git add "src/app/m/[manageToken]/page.tsx" src/components/AttendanceVerify.tsx src/components/CostForm.tsx
git commit -m "feat: manage view (edit, verify, cost)"
```

---

## Task 12: Auth (email+password AND Google sign-in)

**Files:** Create `src/app/(auth)/register/page.tsx`, `login/page.tsx`,
`forgot-password/page.tsx`, `src/components/GoogleSignInButton.tsx`,
`src/app/auth/callback/route.ts`, and auth actions in `src/app/actions.ts`.

Two optional account paths: "Continue with Google" (OAuth — no passwords, no
reset emails) and email+password (with forgot-password). Both end up as a
Supabase auth user + a `profiles` row; everything downstream (`player_id`) is
identical regardless of path.

- [ ] **Step 1: Add auth server actions to `src/app/actions.ts`** (append)

```ts
import { serverAuth } from "@/lib/supabase-auth";

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const displayName = String(formData.get("display_name"));
  const sb = await serverAuth();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    // store profile via service role
    await import("@/lib/db").then(({ }) => {});
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    await admin.from("profiles").insert({ id: data.user.id, display_name: displayName });
  }
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const sb = await serverAuth();
  const { error } = await sb.auth.signInWithPassword({
    email: String(formData.get("email")), password: String(formData.get("password")),
  });
  if (error) throw error;
  redirect("/");
}

export async function logoutAction() {
  const sb = await serverAuth();
  await sb.auth.signOut();
  redirect("/");
}

export async function forgotPasswordAction(formData: FormData) {
  const sb = await serverAuth();
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  await sb.auth.resetPasswordForEmail(String(formData.get("email")), { redirectTo: `${base}/login` });
  redirect("/login?reset=sent");
}
```

> NOTE: a cleaner refactor extracts the admin client from `db.ts` as
> `export const admin = ...`. Do that and import it here instead of re-creating it.

- [ ] **Step 2: Register page**

Create `src/app/(auth)/register/page.tsx`:
```tsx
import { registerAction } from "@/app/actions";
export default function Register() {
  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-3 text-xl font-bold">Create account</h1>
      <form action={registerAction} className="flex flex-col gap-2">
        <input name="display_name" placeholder="Name" required className="rounded border p-2" />
        <input name="email" type="email" placeholder="Email (for password reset)" required className="rounded border p-2" />
        <input name="password" type="password" placeholder="Password (min 6)" minLength={6} required className="rounded border p-2" />
        <button className="rounded bg-emerald-600 p-2 text-white">Register</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Login page**

Create `src/app/(auth)/login/page.tsx`:
```tsx
import { loginAction } from "@/app/actions";
export default function Login() {
  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-3 text-xl font-bold">Log in</h1>
      <form action={loginAction} className="flex flex-col gap-2">
        <input name="email" type="email" placeholder="Email" required className="rounded border p-2" />
        <input name="password" type="password" placeholder="Password" required className="rounded border p-2" />
        <button className="rounded bg-emerald-600 p-2 text-white">Log in</button>
      </form>
      <a href="/forgot-password" className="mt-2 inline-block text-sm text-emerald-700">Forgot password?</a>
    </main>
  );
}
```

- [ ] **Step 4: Forgot-password page**

Create `src/app/(auth)/forgot-password/page.tsx`:
```tsx
import { forgotPasswordAction } from "@/app/actions";
export default function Forgot() {
  return (
    <main className="mx-auto max-w-sm p-4">
      <h1 className="mb-3 text-xl font-bold">Reset password</h1>
      <form action={forgotPasswordAction} className="flex flex-col gap-2">
        <input name="email" type="email" placeholder="Your account email" required className="rounded border p-2" />
        <button className="rounded bg-emerald-600 p-2 text-white">Send reset link</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Google sign-in button (client component)**

Create `src/components/GoogleSignInButton.tsx`:
```tsx
"use client";
import { browserAuth } from "@/lib/supabase-browser";

export function GoogleSignInButton() {
  const onClick = async () => {
    const sb = browserAuth();
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };
  return (
    <button type="button" onClick={onClick} className="rounded border p-2 font-medium">
      Continue with Google
    </button>
  );
}
```

- [ ] **Step 6: OAuth callback route (code exchange + profile upsert)**

Google users never hit `registerAction`, so their `profiles` row is created here
on first login, using their Google display name.

Create `src/app/auth/callback/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { serverAuth } from "@/lib/supabase-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await serverAuth();
    const { data, error } = await sb.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      const name =
        (data.user.user_metadata.full_name as string | undefined) ??
        data.user.email ?? "Player";
      await admin.from("profiles")
        .upsert({ id: data.user.id, display_name: name }, { onConflict: "id", ignoreDuplicates: true });
    }
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
```
(Reuse the exported `admin` client from `db.ts` after the Task-12 refactor note.)

- [ ] **Step 7: Add the Google button to login + register pages**

In `src/app/(auth)/login/page.tsx` and `register/page.tsx`, import and render
below the form:
```tsx
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
// ... inside the <main>, after the form:
<div className="mt-3"><GoogleSignInButton /></div>
```

- [ ] **Step 8: Google Cloud setup (manual — human does this once)**

1. console.cloud.google.com → create a project (free).
2. Configure the OAuth consent screen (External; app name "SmashKaki"; your email).
3. Create Credentials → OAuth Client ID → type **Web application**.
4. Authorized JavaScript origins: `http://localhost:3000` (+ Vercel URL later).
5. Authorized redirect URI: the exact callback shown on Supabase's Google
   provider page — `https://<project-ref>.supabase.co/auth/v1/callback`.
6. Copy Client ID + Secret into Supabase → Authentication → Sign In / Up →
   Google → enable → save.

- [ ] **Step 9: Configure Supabase redirect URLs** — in Auth → URL Configuration,
add `http://localhost:3000/**` (and the Vercel URL later) to allowed redirects;
set Site URL to `http://localhost:3000` for dev.

- [ ] **Step 10: Manual check** — (a) register with email, log out, log in,
request a reset email (check inbox; note the built-in mailer is rate-limited to
a few emails/hour); (b) "Continue with Google" round-trips and creates a
`profiles` row with your Google name; (c) an RSVP made while logged in (either
path) links to the account — re-RSVP from a *different* browser while logged in
updates the same row.

- [ ] **Step 11: Commit** (user runs it)

```bash
git add "src/app/(auth)" src/app/auth src/components/GoogleSignInButton.tsx src/app/actions.ts
git commit -m "feat: optional accounts via Google sign-in and email+password"
```

---

## Task 13: Not-found page + polish

**Files:** Create `src/app/not-found.tsx`.

- [ ] **Step 1: Friendly not-found**

Create `src/app/not-found.tsx`:
```tsx
export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold">Session not found 🏸</h1>
      <p className="mt-2 text-gray-600">This link is invalid or the session was removed.</p>
      <a href="/" className="mt-4 inline-block text-emerald-700">Create a new session</a>
    </main>
  );
}
```

- [ ] **Step 2: Final full-suite check**

Run: `npm run test` → Expected: all unit tests PASS.
Run: `npm run build` → Expected: build succeeds.

- [ ] **Step 3: Commit** (user runs it)

```bash
git add src/app/not-found.tsx && git commit -m "feat: not-found page + polish"
```

---

## Task 14: Deploy to Vercel

- [ ] **Step 1: Push to GitHub** (user creates repo + pushes).
- [ ] **Step 2: Import the repo in Vercel**; set env vars: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_BASE_URL`
  (the Vercel URL).
- [ ] **Step 3: In Supabase**, add the Vercel URL to Auth redirect allow-list.
- [ ] **Step 4: Smoke test on the deployed URL** — create a session on PC, RSVP on
  phone, verify + cost on PC, confirm guest summary on phone.

---

## Verification (end-to-end)

- **Unit:** `npm run test` — cost (5), tokens (2), identity (5) all pass.
- **Integration/manual lifecycle:** create → share guest link → RSVP (anonymous,
  then logged-in) → edit court number → verify attendance → enter cost → confirm
  per-head on both manage and guest views; confirm guest pages never render the
  manage token (view source) and a guest token can't reach manage actions.
- **Auth:** register (email required), login, logout, forgot-password round-trip.
- **Cross-device identity:** logged-in RSVP from two browsers updates one row.
- **Portability sanity:** no Vercel-proprietary APIs used; DB access is standard
  Postgres via service role; only env vars differ between hosts.

---

## Self-review notes

- **Spec coverage:** session setup ✓ (Task 9/11), court edit after booking ✓
  (Task 11 edit form), invite via link ✓ (guest token + copy button), verify
  attendance ✓ (Task 11), cost = court + shuttles with post-session variable
  price ✓ (Task 8/11/cost.ts), per-head ✓ (cost.ts), PC+phone ✓ (responsive
  Tailwind), no-login + two links ✓ (tokens), soft identity + optional accounts +
  forgot-password ✓ (Task 5/12), portability ✓ (design rules honored).
- **Known refactor flagged:** export the `admin` Supabase client from `db.ts` and
  import it in `actions.ts` register flow rather than re-creating it (Task 12 note).
- **Types consistent:** `computeCost` input/`CostResult`, `resolveIdentity` match
  kinds, and `db.ts` signatures are referenced identically across tasks.
```
