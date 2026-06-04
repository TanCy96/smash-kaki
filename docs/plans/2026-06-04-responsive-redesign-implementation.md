# SmashKaki Responsive Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give SmashKaki a cohesive sporty visual identity that works on phone and PC, built on a small shared component layer with system dark mode, without touching any server action, data access, or pure logic.

**Architecture:** Define semantic color tokens as CSS variables in `globals.css` (with a `prefers-color-scheme: dark` override), mapped to Tailwind v4 utilities via `@theme inline`. Build ~8 presentation components in `src/components/ui/`. Adopt a `PageShell` that renders a single column on phone and a two-column (`main` + sticky `aside`) layout on desktop via one `lg:` breakpoint. Re-skin every page and every existing component to compose the new layer.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4, Geist font (`next/font`). No new dependencies.

## Verification approach (read before starting)

This is a **presentation-only** redesign. Per `AGENTS.md`, this repo unit-tests **pure I/O-free logic** (`cost.ts`, `tokens.ts`, `identity.ts`) and has **no React component-test harness** (`vitest` runs in `node`, `include: src/**/*.test.ts`; `@testing-library/react` is not installed, and the spec forbids new deps). Writing assertions against Tailwind class strings would add no real value. Therefore each task is verified with the project's **real** gates instead of fabricated unit tests:

- `npx tsc --noEmit` — type/compile check (fast, used per task)
- `npm run lint` — ESLint clean
- `npm test` — existing logic tests **must stay green** (proves logic untouched)
- `npm run build` — full production build (milestone tasks)
- **Manual check** — `npm run dev`, view the page at ~375px and ~1280px, in both light and OS dark mode

This is a deliberate, documented deviation from literal test-first TDD, justified by the project's testing philosophy and the presentation-only scope.

---

## File Structure

**Create:**
- `src/components/ui/Button.tsx` — button with 4 variants + interactive states
- `src/components/ui/Card.tsx` — surface container with optional title
- `src/components/ui/Field.tsx` — `Field`, `Input`, `Textarea`, `Select` form primitives
- `src/components/ui/Badge.tsx` — status pill
- `src/components/ui/Alert.tsx` — inline feedback banner
- `src/components/ui/SectionHeading.tsx` — heading + optional trailing value
- `src/components/ui/StatRow.tsx` — label/value row
- `src/components/ui/PageShell.tsx` — responsive header + two-column frame
- `src/components/ui/index.ts` — barrel re-exporting all of the above

**Modify:**
- `src/app/globals.css` — tokens + `@theme inline` + base body
- `src/app/layout.tsx` — metadata, body background/text classes
- `src/app/page.tsx`, `src/app/not-found.tsx`
- `src/app/(auth)/login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`
- `src/app/s/[guestToken]/page.tsx`, `src/app/m/[manageToken]/page.tsx`
- `src/components/CreateSessionForm.tsx`, `RsvpForm.tsx`, `TimePollForm.tsx`, `TimePollSummary.tsx`, `AttendanceVerify.tsx`, `CostForm.tsx`, `FinalizeTimeOptionForm.tsx`, `CopyLinkButton.tsx`

**Never touched:** `src/app/actions.ts`, `src/lib/db.ts`, `src/lib/cost.ts`, `src/lib/tokens.ts`, `src/lib/identity.ts`, all `*.test.ts`.

---

## Task 1: Theme tokens & Tailwind mapping

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace `globals.css` with the token system**

Replace the entire contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

/* Semantic tokens — light mode defaults */
:root {
  --canvas: #f0fdf4;
  --card: #ffffff;
  --border: #e5e7eb;
  --ink: #374151;
  --heading: #064e3b;
  --muted: #6b7280;
  --primary: #10b981;
  --primary-hi: #34d399;
  --on-primary: #ffffff;
  --accent: #f59e0b;
  --ring: #10b981;

  --success-bg: #d1fae5;
  --success-ink: #065f46;
  --danger-bg: #fee2e2;
  --danger-ink: #991b1b;
  --danger: #dc2626;
  --accent-bg: #fef3c7;
  --accent-ink: #92400e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #0a1410;
    --card: #13211b;
    --border: #1e3a2f;
    --ink: #a7c4b5;
    --heading: #ecfdf5;
    --muted: #6b8577;
    --primary: #10b981;
    --primary-hi: #34d399;
    --on-primary: #06281e;
    --accent: #f59e0b;
    --ring: #34d399;

    --success-bg: #06342a;
    --success-ink: #6ee7b7;
    --danger-bg: #3b1212;
    --danger-ink: #fca5a5;
    --danger: #f87171;
    --accent-bg: #3a2c08;
    --accent-ink: #fcd34d;
  }
}

/* Map tokens to Tailwind utilities (inline = utilities reference the var,
   so the dark @media override applies at runtime) */
@theme inline {
  --color-canvas: var(--canvas);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-ink: var(--ink);
  --color-heading: var(--heading);
  --color-muted: var(--muted);
  --color-primary: var(--primary);
  --color-primary-hi: var(--primary-hi);
  --color-on-primary: var(--on-primary);
  --color-accent: var(--accent);
  --color-ring: var(--ring);
  --color-success-bg: var(--success-bg);
  --color-success-ink: var(--success-ink);
  --color-danger-bg: var(--danger-bg);
  --color-danger-ink: var(--danger-ink);
  --color-danger: var(--danger);
  --color-accent-bg: var(--accent-bg);
  --color-accent-ink: var(--accent-ink);

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--canvas);
  color: var(--ink);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}
```

This generates utilities such as `bg-canvas`, `bg-card`, `text-ink`, `text-heading`, `text-muted`, `border-border`, `bg-primary`, `text-on-primary`, `from-primary`, `to-primary-hi`, `bg-success-bg`, `text-danger`, `ring-ring`, etc.

- [ ] **Step 2: Update `layout.tsx` metadata and body classes**

In `src/app/layout.tsx`, replace the `metadata` object and the `<body>` line:

```tsx
export const metadata: Metadata = {
  title: "SmashKaki",
  description: "Plan a badminton session, share a link, split the cost.",
};
```

```tsx
      <body className="min-h-full flex flex-col bg-canvas text-ink antialiased">
        {children}
      </body>
```

(Keep the `geistSans`/`geistMono` imports and the `<html>` line unchanged.)

- [ ] **Step 3: Verify it compiles and builds**

Run: `npx tsc --noEmit` → Expected: no errors.
Run: `npm run build` → Expected: build succeeds (this confirms the Tailwind `@theme` syntax is valid; a bad token breaks the build here).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): add sporty theme tokens with system dark mode"
```

---

## Task 2: Button component

**Files:**
- Create: `src/components/ui/Button.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/ui/Button.tsx`:

```tsx
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 " +
  "text-sm font-bold transition " +
  "active:scale-[0.97] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 " +
  "motion-reduce:transition-none motion-reduce:active:scale-100";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-primary to-primary-hi text-on-primary shadow-sm hover:brightness-105",
  secondary:
    "border-[1.5px] border-primary text-primary bg-transparent hover:bg-primary/10",
  danger: "bg-danger text-white hover:brightness-110",
  ghost: "text-muted bg-transparent hover:text-heading hover:bg-black/5 dark:hover:bg-white/5",
};

export function Button({
  variant = "primary",
  className = "",
  type = "submit",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
```

Note: `type` defaults to `"submit"` (these forms post to server actions) but is overridable to `"button"` for the add/remove-option controls.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "feat(ui): add Button with variants and interactive states"
```

---

## Task 3: Card component

**Files:**
- Create: `src/components/ui/Card.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/ui/Card.tsx`:

```tsx
import type { ReactNode } from "react";

export function Card({
  title,
  children,
  className = "",
  highlight = false,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <section
      className={
        "rounded-2xl bg-card p-4 sm:p-5 shadow-sm " +
        (highlight
          ? "border-2 border-primary"
          : "border border-border") +
        " " +
        className
      }
    >
      {title != null && (
        <h2 className="mb-3 text-base font-extrabold text-heading">{title}</h2>
      )}
      {children}
    </section>
  );
}
```

`highlight` is used by the sticky action panel to draw the eye (the 2px emerald border from the design mockups).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Card.tsx
git commit -m "feat(ui): add Card surface component"
```

---

## Task 4: Field, Input, Textarea, Select

**Files:**
- Create: `src/components/ui/Field.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/ui/Field.tsx`:

```tsx
import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-ink " +
  "shadow-sm outline-none transition " +
  "placeholder:text-muted " +
  "focus:border-primary focus:ring-2 focus:ring-primary/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/** Wraps a labelled control with an optional error message. */
export function Field({
  label,
  error,
  children,
}: {
  label: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      {children}
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${control} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${control} min-h-24 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${control} ${className}`} {...props} />;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Field.tsx
git commit -m "feat(ui): add Field/Input/Textarea/Select form primitives"
```

---

## Task 5: Badge and Alert

**Files:**
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Alert.tsx`

- [ ] **Step 1: Write Badge**

Create `src/components/ui/Badge.tsx`:

```tsx
import type { ReactNode } from "react";

type Tone = "confirmed" | "draft" | "cancelled";

const tones: Record<Tone, string> = {
  confirmed: "bg-primary text-on-primary",
  draft: "bg-accent-bg text-accent-ink",
  cancelled: "bg-danger-bg text-danger-ink",
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
        tones[tone]
      }
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Write Alert**

Create `src/components/ui/Alert.tsx`:

```tsx
import type { ReactNode } from "react";

type Tone = "success" | "danger";

const tones: Record<Tone, string> = {
  success: "bg-success-bg text-success-ink",
  danger: "bg-danger-bg text-danger-ink",
};

export function Alert({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <div
      role="status"
      className={"rounded-xl px-3 py-2.5 text-sm font-medium " + tones[tone]}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Badge.tsx src/components/ui/Alert.tsx
git commit -m "feat(ui): add Badge and Alert components"
```

---

## Task 6: SectionHeading and StatRow

**Files:**
- Create: `src/components/ui/SectionHeading.tsx`
- Create: `src/components/ui/StatRow.tsx`

- [ ] **Step 1: Write SectionHeading**

Create `src/components/ui/SectionHeading.tsx`:

```tsx
import type { ReactNode } from "react";

export function SectionHeading({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <h2 className="text-base font-extrabold text-heading">{children}</h2>
      {trailing != null && (
        <span className="text-sm font-bold text-primary">{trailing}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write StatRow**

Create `src/components/ui/StatRow.tsx`:

```tsx
import type { ReactNode } from "react";

export function StatRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/SectionHeading.tsx src/components/ui/StatRow.tsx
git commit -m "feat(ui): add SectionHeading and StatRow"
```

---

## Task 7: PageShell and barrel export

**Files:**
- Create: `src/components/ui/PageShell.tsx`
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Write PageShell**

Create `src/components/ui/PageShell.tsx`. It always renders the branded header. The body has two modes: a single centered column (default), or a two-column layout when an `aside` is provided.

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

function Header({ headerRight }: { headerRight?: ReactNode }) {
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-extrabold text-heading">
          🏸 SmashKaki
        </Link>
        {headerRight}
      </div>
    </header>
  );
}

/**
 * Page frame.
 * - `aside` omitted  -> single centered column (good for forms, auth).
 * - `aside` provided -> two columns on lg+: `main` (left) and a sticky
 *   `aside` (right); stacks to one column on phone, aside below main.
 * - `narrow` centers a slim column (auth pages).
 */
export function PageShell({
  children,
  aside,
  headerRight,
  narrow = false,
}: {
  children: ReactNode;
  aside?: ReactNode;
  headerRight?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <Header headerRight={headerRight} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {aside ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
            <div className="flex flex-col gap-5">{children}</div>
            <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
              {aside}
            </aside>
          </div>
        ) : (
          <div
            className={
              "mx-auto flex flex-col gap-5 " + (narrow ? "max-w-sm" : "max-w-xl")
            }
          >
            {children}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Write the barrel**

Create `src/components/ui/index.ts`:

```ts
export { Button } from "./Button";
export { Card } from "./Card";
export { Field, Input, Textarea, Select } from "./Field";
export { Badge } from "./Badge";
export { Alert } from "./Alert";
export { SectionHeading } from "./SectionHeading";
export { StatRow } from "./StatRow";
export { PageShell } from "./PageShell";
```

- [ ] **Step 3: Verify the whole layer compiles and builds**

Run: `npx tsc --noEmit` → Expected: no errors.
Run: `npm run lint` → Expected: clean.
Run: `npm run build` → Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/PageShell.tsx src/components/ui/index.ts
git commit -m "feat(ui): add responsive PageShell and barrel export"
```

---

## Task 8: Re-skin the Create page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/CreateSessionForm.tsx`

- [ ] **Step 1: Rewrite `src/app/page.tsx`**

Replace the whole file. The auth links move into `PageShell`'s `headerRight`; the explainer becomes the sticky `aside`.

```tsx
import Link from "next/link";
import { CreateSessionForm } from "@/components/CreateSessionForm";
import { Button, Card, PageShell } from "@/components/ui";
import { getProfile } from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";
import { logoutAction } from "./actions";

export default async function CreatePage() {
  const playerId = await currentPlayerId();
  const profile = playerId ? await getProfile(playerId) : null;
  const displayName = profile?.display_name ?? "";

  const headerRight = playerId ? (
    <form action={logoutAction} className="flex items-center gap-3 text-sm">
      <span className="max-w-32 truncate font-medium text-muted">
        {displayName || "Signed in"}
      </span>
      <Button variant="ghost" className="px-2 py-1">
        Log out
      </Button>
    </form>
  ) : (
    <div className="flex gap-2 text-sm font-semibold">
      <Link href="/login" className="text-primary hover:underline">
        Log in
      </Link>
      <Link href="/register" className="text-primary hover:underline">
        Register
      </Link>
    </div>
  );

  const aside = (
    <Card highlight title="How it works">
      <ol className="flex flex-col gap-3 text-sm text-ink">
        <li><span className="font-bold text-heading">1. Plan</span> — set time, place, court.</li>
        <li><span className="font-bold text-heading">2. Share</span> — send the guest link to your kaki.</li>
        <li><span className="font-bold text-heading">3. Split</span> — verify who came, split the cost evenly.</li>
      </ol>
    </Card>
  );

  return (
    <PageShell headerRight={headerRight} aside={aside}>
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Plan a session</h1>
        <p className="mt-1 text-sm text-muted">
          Plan a session, share a link, split the cost.
        </p>
      </div>
      <CreateSessionForm displayName={displayName} />
    </PageShell>
  );
}
```

- [ ] **Step 2: Rewrite `CreateSessionForm.tsx` to use the ui layer**

Replace the file. Keep `"use client"`, the `deviceToken` effect, the `options` state logic, the form `action`, and all `name=` attributes **exactly** — only swap presentation.

```tsx
"use client";

import { useEffect, useState } from "react";
import { createSessionAction } from "@/app/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { deviceToken } from "./device-token";

type TimeOptionDraft = { id: string; available: boolean };

function newOption(id = crypto.randomUUID()): TimeOptionDraft {
  return { id, available: true };
}

export function CreateSessionForm({ displayName }: { displayName: string }) {
  const [token, setToken] = useState("");
  const [options, setOptions] = useState<TimeOptionDraft[]>([
    newOption("option-1"),
    newOption("option-2"),
  ]);

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  return (
    <Card>
      <form action={createSessionAction} className="flex flex-col gap-4">
        <input type="hidden" name="device_token" value={token} />
        <Field label="Your name">
          <Input name="organizer_name" placeholder="Alex" defaultValue={displayName} required />
        </Field>
        <Field label="Session title">
          <Input name="title" placeholder="Friday Smash" required />
        </Field>
        <Field label="Location">
          <Input name="location" placeholder="ABC Sports Hall" required />
        </Field>
        <Field label="Court number(s)">
          <Input name="court_numbers" placeholder="Court 3, Court 4" />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" placeholder="Optional details for the kaki" />
        </Field>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-heading">Time options</h3>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOptions((c) => [...c, newOption()])}
              className="size-9 px-0"
              aria-label="Add time option"
              title="Add time option"
            >
              +
            </Button>
          </div>

          {options.map((option, index) => (
            <div
              key={option.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border p-3"
            >
              <div className="flex flex-col gap-2">
                <Field label="Date and time">
                  <Input name="option_starts_at" type="datetime-local" required />
                </Field>
                <Field label="Duration (minutes)">
                  <Input name="option_duration_min" type="number" min="1" defaultValue={120} required />
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    name="organizer_available_index"
                    type="checkbox"
                    value={index}
                    defaultChecked={option.available}
                    className="size-4 rounded border-border text-primary"
                  />
                  Available
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setOptions((c) =>
                    c.length <= 2 ? c : c.filter((i) => i.id !== option.id)
                  )
                }
                disabled={options.length <= 2}
                className="size-9 px-0 text-xl hover:text-danger"
                aria-label="Remove time option"
                title="Remove time option"
              >
                &times;
              </Button>
            </div>
          ))}
        </div>

        <Button disabled={!token}>Create poll</Button>
      </form>
    </Card>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.
Run: `npm run dev`, open `http://localhost:3000/`. Confirm: two columns on a wide window (form left, "How it works" sticky right), single column when narrowed to ~375px, theme flips with OS dark mode, add/remove time-option buttons work, primary button presses (scales) on click/tap.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/CreateSessionForm.tsx
git commit -m "feat(ui): re-skin create page and session form"
```

---

## Task 9: Re-skin auth pages and not-found

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`
- Modify: `src/app/not-found.tsx`

- [ ] **Step 1: Rewrite `login/page.tsx`**

```tsx
import Link from "next/link";
import { loginAction } from "@/app/actions";
import { Alert, Button, Card, Field, Input, PageShell } from "@/components/ui";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; error?: string }>;
}) {
  const { reset, error } = await searchParams;

  return (
    <PageShell narrow>
      <Card title="Log in">
        {reset === "sent" && <Alert tone="success">Password reset email sent.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <form action={loginAction} className="mt-3 flex flex-col gap-3">
          <Field label="Email">
            <Input name="email" type="email" placeholder="you@example.com" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" placeholder="••••••••" required />
          </Field>
          <Button>Log in</Button>
        </form>
        <div className="mt-4 flex justify-between gap-3 text-sm font-semibold">
          <Link href="/register" className="text-primary hover:underline">Create account</Link>
          <Link href="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
        </div>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 2: Rewrite `register/page.tsx`**

```tsx
import Link from "next/link";
import { registerAction } from "@/app/actions";
import { Alert, Button, Card, Field, Input, PageShell } from "@/components/ui";

export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <PageShell narrow>
      <Card title="Create account">
        {error && <Alert tone="danger">{error}</Alert>}
        <form action={registerAction} className="mt-3 flex flex-col gap-3">
          <Field label="Name">
            <Input name="display_name" placeholder="Alex" required />
          </Field>
          <Field label="Email (for password reset)">
            <Input name="email" type="email" placeholder="you@example.com" required />
          </Field>
          <Field label="Password (min 6)">
            <Input name="password" type="password" minLength={6} placeholder="••••••••" required />
          </Field>
          <Button>Register</Button>
        </form>
        <div className="mt-4 flex justify-between gap-3 text-sm font-semibold">
          <Link href="/login" className="text-primary hover:underline">Already have an account?</Link>
          <Link href="/" className="text-muted hover:underline">Back</Link>
        </div>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 3: Rewrite `forgot-password/page.tsx`**

```tsx
import Link from "next/link";
import { forgotPasswordAction } from "@/app/actions";
import { Alert, Button, Card, Field, Input, PageShell } from "@/components/ui";

export default async function Forgot({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <PageShell narrow>
      <Card title="Reset password">
        {error && <Alert tone="danger">{error}</Alert>}
        <form action={forgotPasswordAction} className="mt-3 flex flex-col gap-3">
          <Field label="Your account email">
            <Input name="email" type="email" placeholder="you@example.com" required />
          </Field>
          <Button>Send reset link</Button>
        </form>
        <Link href="/login" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Back to login
        </Link>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 4: Rewrite `not-found.tsx`**

```tsx
import Link from "next/link";
import { Button, Card, PageShell } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell narrow>
      <Card>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-heading">Session not found</h1>
          <p className="mt-2 text-sm text-muted">
            This link is invalid or the session was removed.
          </p>
          <Link href="/" className="mt-4 inline-block">
            <Button>Create a new session</Button>
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.
Run: `npm run dev`; visit `/login`, `/register`, `/forgot-password`, and a bad session URL (e.g. `/s/nope`). Confirm each shows a centered slim card, light/dark both look right.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)/login/page.tsx" "src/app/(auth)/register/page.tsx" "src/app/(auth)/forgot-password/page.tsx" src/app/not-found.tsx
git commit -m "feat(ui): re-skin auth pages and not-found"
```

---

## Task 10: Re-skin the Guest page and its forms

**Files:**
- Modify: `src/app/s/[guestToken]/page.tsx`
- Modify: `src/components/RsvpForm.tsx`
- Modify: `src/components/TimePollForm.tsx`
- Modify: `src/components/TimePollSummary.tsx`

- [ ] **Step 1: Rewrite `RsvpForm.tsx`** (keep `"use client"`, the device-token effect, the `action`, and all `name=`/`value=` exactly)

```tsx
"use client";

import { useEffect, useState } from "react";
import { rsvpAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";
import { deviceToken } from "./device-token";

export function RsvpForm({
  guestToken,
  disabled,
}: {
  guestToken: string;
  disabled: boolean;
}) {
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  if (disabled) {
    return <p className="text-sm text-muted">RSVP closed - session cancelled.</p>;
  }

  return (
    <form action={rsvpAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <Field label="Your name">
        <Input name="name" placeholder="Your name" required />
      </Field>
      <div className="flex gap-4 text-sm font-medium text-ink">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="rsvp" value="going" defaultChecked /> Going
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="rsvp" value="maybe" /> Maybe
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="rsvp" value="cant" /> Can&apos;t
        </label>
      </div>
      <Button disabled={!token}>Submit RSVP</Button>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite `TimePollForm.tsx`** (keep client logic/names exactly)

```tsx
"use client";

import { useEffect, useState } from "react";
import { timePollVoteAction } from "@/app/actions";
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

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  if (disabled) {
    return <p className="text-sm text-muted">Voting closed.</p>;
  }

  return (
    <form action={timePollVoteAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <Field label="Your name">
        <Input name="name" placeholder="Alex" required />
      </Field>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm text-ink"
          >
            <input name="time_option_id" type="checkbox" value={option.id} className="mt-1" />
            <span>
              <span className="block font-semibold text-heading">
                {formatMalaysiaDateTime(option.starts_at)}
              </span>
              <span className="block text-muted">{option.duration_min} min</span>
            </span>
          </label>
        ))}
      </div>
      <Button disabled={!token}>Save availability</Button>
    </form>
  );
}
```

- [ ] **Step 3: Rewrite `TimePollSummary.tsx`** (server component, no client logic)

```tsx
import { formatMalaysiaDateTime } from "@/lib/datetime";
import type { SessionTimeOptionWithVotes } from "@/lib/types";

export function TimePollSummary({
  options,
}: {
  options: SessionTimeOptionWithVotes[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => (
        <div key={option.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-heading">
                {formatMalaysiaDateTime(option.starts_at)}
              </h3>
              <p className="text-sm text-muted">{option.duration_min} min</p>
            </div>
            <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-sm font-bold text-success-ink">
              {option.votes.length}
            </span>
          </div>
          {option.votes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No votes yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm text-ink">
              {option.votes.map((vote) => (
                <li key={vote.id} className="rounded-lg bg-black/5 px-2 py-1 dark:bg-white/5">
                  {vote.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `src/app/s/[guestToken]/page.tsx`**

Both lifecycle branches use `PageShell`. Keep all data fetching, `notFound()` guards, and `computeCost` logic exactly as-is.

```tsx
import { notFound } from "next/navigation";
import { RsvpForm } from "@/components/RsvpForm";
import { TimePollForm } from "@/components/TimePollForm";
import { TimePollSummary } from "@/components/TimePollSummary";
import { Alert, Badge, Card, PageShell, StatRow } from "@/components/ui";
import { computeCost } from "@/lib/cost";
import { formatMalaysiaDateTime } from "@/lib/datetime";
import {
  getSessionByGuestToken,
  listParticipants,
  listSessionTimeOptions,
} from "@/lib/db";

export default async function GuestPage({
  params,
  searchParams,
}: {
  params: Promise<{ guestToken: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { guestToken } = await params;
  const { submitted } = await searchParams;
  const session = await getSessionByGuestToken(guestToken);
  if (!session) notFound();

  if (session.lifecycle === "draft") {
    const options = await listSessionTimeOptions(session.id);

    return (
      <PageShell
        aside={
          <Card highlight title="Pick your available times">
            {submitted === "1" && <Alert tone="success">Availability saved.</Alert>}
            <div className="mt-3">
              <TimePollForm
                guestToken={guestToken}
                options={options}
                disabled={session.status === "cancelled"}
              />
            </div>
          </Card>
        }
      >
        {session.status === "cancelled" && <Alert tone="danger">This poll was cancelled.</Alert>}
        <div>
          <Badge tone="draft">Poll</Badge>
          <h1 className="mt-2 text-2xl font-extrabold text-heading">{session.title}</h1>
          <p className="text-sm text-muted">
            {session.location}
            {session.court_numbers ? ` - Court ${session.court_numbers}` : ""}
          </p>
          {session.notes && <p className="mt-1 text-sm text-muted">{session.notes}</p>}
        </div>
        <Card title="Current preferences">
          <TimePollSummary options={options} />
        </Card>
      </PageShell>
    );
  }

  if (!session.starts_at || !session.duration_min) notFound();

  const participants = await listParticipants(session.id);
  const going = participants.filter((p) => p.rsvp === "going");
  const attended = participants.filter((p) => p.attended);
  const cost = computeCost({
    courtCost: session.court_cost,
    shuttlesUsed: session.shuttles_used,
    pricePerShuttle: session.price_per_shuttle,
    attendedCount: attended.length,
  });
  const hasCost = session.court_cost != null || session.shuttles_used != null;

  return (
    <PageShell
      aside={
        <Card highlight title="Your RSVP">
          {submitted === "1" && <Alert tone="success">RSVP submitted.</Alert>}
          <div className="mt-3">
            <RsvpForm guestToken={guestToken} disabled={session.status === "cancelled"} />
          </div>
        </Card>
      }
    >
      {session.status === "cancelled" && <Alert tone="danger">This session was cancelled.</Alert>}
      <div>
        <Badge tone="confirmed">Confirmed</Badge>
        <h1 className="mt-2 text-2xl font-extrabold text-heading">{session.title}</h1>
        <p className="text-sm text-muted">
          {formatMalaysiaDateTime(session.starts_at)} - {session.duration_min} min
        </p>
        <p className="text-sm text-muted">
          {session.location}
          {session.court_numbers ? ` - Court ${session.court_numbers}` : ""}
        </p>
        {session.notes && <p className="mt-1 text-sm text-muted">{session.notes}</p>}
      </div>

      <Card title={`Going (${going.length})`}>
        {going.length === 0 ? (
          <p className="text-sm text-muted">No one yet — be the first!</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm text-ink">
            {going.map((p) => (
              <li key={p.id} className="rounded-lg bg-black/5 px-2 py-1 dark:bg-white/5">
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {hasCost && (
        <Card title="Cost summary">
          <StatRow label="Total" value={`RM ${cost.total.toFixed(2)}`} />
          <StatRow label="Attended" value={attended.length} />
          <StatRow
            label="Per person"
            value={cost.perHead == null ? "-" : `RM ${cost.perHead.toFixed(2)}`}
          />
          {cost.remainder !== 0 && (
            <p className="mt-1 text-xs text-muted">
              Rounding leftover: RM {cost.remainder.toFixed(2)}
            </p>
          )}
        </Card>
      )}
    </PageShell>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.
Run: `npm run dev`; open a draft guest link and a finalized guest link. Confirm two-column with sticky RSVP/poll panel on desktop, single column on phone, light/dark both fine, RSVP/poll submit still works.

- [ ] **Step 6: Commit**

```bash
git add "src/app/s/[guestToken]/page.tsx" src/components/RsvpForm.tsx src/components/TimePollForm.tsx src/components/TimePollSummary.tsx
git commit -m "feat(ui): re-skin guest page, RSVP, time poll"
```

---

## Task 11: Re-skin the Manage page and its forms

**Files:**
- Modify: `src/components/CostForm.tsx`
- Modify: `src/components/AttendanceVerify.tsx`
- Modify: `src/components/FinalizeTimeOptionForm.tsx`
- Modify: `src/components/CopyLinkButton.tsx`
- Modify: `src/app/m/[manageToken]/page.tsx`

- [ ] **Step 1: Rewrite `CostForm.tsx`** (keep `"use client"`, `action`, names exactly)

```tsx
"use client";

import { setCostAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";
import type { Session } from "@/lib/types";

export function CostForm({ session }: { session: Session }) {
  return (
    <form action={setCostAction} className="flex flex-col gap-3">
      <input type="hidden" name="manage_token" value={session.manage_token} />
      <Field label="Court cost (RM)">
        <Input name="court_cost" type="number" step="0.01" min="0" defaultValue={session.court_cost ?? ""} />
      </Field>
      <Field label="Shuttles used">
        <Input name="shuttles_used" type="number" min="0" defaultValue={session.shuttles_used ?? ""} />
      </Field>
      <Field label="Price per shuttle (RM)">
        <Input name="price_per_shuttle" type="number" step="0.01" min="0" defaultValue={session.price_per_shuttle ?? ""} />
      </Field>
      <Button>Save cost</Button>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite `AttendanceVerify.tsx`** (keep `"use client"`, `action`, names exactly)

```tsx
"use client";

import { verifyAttendanceAction } from "@/app/actions";
import { Button } from "@/components/ui";
import type { Participant } from "@/lib/types";

export function AttendanceVerify({
  manageToken,
  participants,
}: {
  manageToken: string;
  participants: Participant[];
}) {
  return (
    <form action={verifyAttendanceAction} className="flex flex-col gap-2">
      <input type="hidden" name="manage_token" value={manageToken} />
      {participants.map((participant) => (
        <label key={participant.id} className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="attended"
            value={participant.id}
            defaultChecked={participant.attended}
            className="size-4 rounded border-border text-primary"
          />
          {participant.name}{" "}
          <span className="text-xs text-muted">({participant.rsvp})</span>
        </label>
      ))}
      <Button className="mt-2">Save attendance</Button>
    </form>
  );
}
```

- [ ] **Step 3: Rewrite `FinalizeTimeOptionForm.tsx`**

```tsx
import { finalizeTimeOptionAction } from "@/app/actions";
import { Button } from "@/components/ui";

export function FinalizeTimeOptionForm({
  manageToken,
  timeOptionId,
}: {
  manageToken: string;
  timeOptionId: string;
}) {
  return (
    <form action={finalizeTimeOptionAction}>
      <input type="hidden" name="manage_token" value={manageToken} />
      <input type="hidden" name="time_option_id" value={timeOptionId} />
      <Button variant="secondary" className="px-3 py-1.5 text-xs">
        Finalize this time
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Rewrite `CopyLinkButton.tsx`** (keep `"use client"` and clipboard logic exactly)

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyLinkButton({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      className="shrink-0 px-3 py-1.5 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied!" : label}
    </Button>
  );
}
```

- [ ] **Step 5: Rewrite `src/app/m/[manageToken]/page.tsx`**

Both lifecycle branches use `PageShell`. A small local `ShareLinks` helper avoids duplicating the link block across both branches (DRY). Keep all data fetching, guards, `editSessionAction`/`cancelSessionAction`/`setCostAction` wiring, and every `name=`/`value=` exactly.

```tsx
import { notFound } from "next/navigation";
import { cancelSessionAction, editSessionAction } from "@/app/actions";
import { AttendanceVerify } from "@/components/AttendanceVerify";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { CostForm } from "@/components/CostForm";
import { FinalizeTimeOptionForm } from "@/components/FinalizeTimeOptionForm";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageShell,
  StatRow,
  Textarea,
} from "@/components/ui";
import { computeCost } from "@/lib/cost";
import {
  formatMalaysiaDateTime,
  formatMalaysiaDateTimeLocalInput,
} from "@/lib/datetime";
import {
  getSessionByManageToken,
  listParticipants,
  listSessionTimeOptions,
} from "@/lib/db";

function ShareLinks({ guestUrl, manageUrl }: { guestUrl: string; manageUrl: string }) {
  return (
    <Card title="Share">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-ink">Guest link: {guestUrl}</span>
          <CopyLinkButton url={guestUrl} label="Copy guest link" />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-muted">
            Manage link (keep secret): {manageUrl}
          </span>
          <CopyLinkButton url={manageUrl} label="Copy manage link" />
        </div>
      </div>
    </Card>
  );
}

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ manageToken: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
}) {
  const { manageToken } = await params;
  const { created, saved } = await searchParams;
  const session = await getSessionByManageToken(manageToken);
  if (!session) notFound();

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const guestUrl = `${base}/s/${session.guest_token}`;
  const manageUrl = `${base}/m/${session.manage_token}`;
  const cancelled = session.status === "cancelled";

  const banners = (
    <>
      {cancelled && <Alert tone="danger">This was cancelled.</Alert>}
      {created && <Alert tone="success">Created. Share the guest link.</Alert>}
      {saved === "finalized" ? (
        <Alert tone="success">Session finalized.</Alert>
      ) : (
        saved && <Alert tone="success">Changes saved.</Alert>
      )}
    </>
  );

  if (session.lifecycle === "draft") {
    const options = await listSessionTimeOptions(session.id);

    return (
      <PageShell
        aside={
          <>
            <Card highlight title="Edit details">
              <form action={editSessionAction} className="flex flex-col gap-3">
                <input type="hidden" name="manage_token" value={manageToken} />
                <input type="hidden" name="starts_at" value="1970-01-01T00:00" />
                <input type="hidden" name="duration_min" value="1" />
                <Field label="Title">
                  <Input name="title" defaultValue={session.title} required />
                </Field>
                <Field label="Location">
                  <Input name="location" defaultValue={session.location} required />
                </Field>
                <Field label="Court number(s)">
                  <Input name="court_numbers" defaultValue={session.court_numbers ?? ""} placeholder="Court number(s)" />
                </Field>
                <Field label="Notes">
                  <Textarea name="notes" defaultValue={session.notes ?? ""} placeholder="Notes" />
                </Field>
                <Button>Save details</Button>
              </form>
            </Card>
            {!cancelled && (
              <form action={cancelSessionAction}>
                <input type="hidden" name="manage_token" value={manageToken} />
                <Button variant="danger" className="w-full">Cancel poll</Button>
              </form>
            )}
          </>
        }
      >
        {banners}
        <div>
          <Badge tone="draft">Poll</Badge>
          <h1 className="mt-2 text-2xl font-extrabold text-heading">
            Manage poll: {session.title}
          </h1>
        </div>
        <ShareLinks guestUrl={guestUrl} manageUrl={manageUrl} />
        <Card title="Current preferences">
          <div className="flex flex-col gap-3">
            {options.map((option) => (
              <div key={option.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-heading">
                      {formatMalaysiaDateTime(option.starts_at)}
                    </h3>
                    <p className="text-sm text-muted">{option.duration_min} min</p>
                  </div>
                  <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-sm font-bold text-success-ink">
                    {option.votes.length}
                  </span>
                </div>
                {option.votes.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No votes yet.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2 text-sm text-ink">
                    {option.votes.map((vote) => (
                      <li key={vote.id} className="rounded-lg bg-black/5 px-2 py-1 dark:bg-white/5">
                        {vote.name}
                      </li>
                    ))}
                  </ul>
                )}
                {!cancelled && (
                  <div className="mt-3">
                    <FinalizeTimeOptionForm manageToken={manageToken} timeOptionId={option.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </PageShell>
    );
  }

  if (!session.starts_at || !session.duration_min) notFound();

  const participants = await listParticipants(session.id);
  const attended = participants.filter((p) => p.attended).length;
  const cost = computeCost({
    courtCost: session.court_cost,
    shuttlesUsed: session.shuttles_used,
    pricePerShuttle: session.price_per_shuttle,
    attendedCount: attended,
  });

  return (
    <PageShell
      aside={
        <>
          <Card highlight title="Edit details">
            <form action={editSessionAction} className="flex flex-col gap-3">
              <input type="hidden" name="manage_token" value={manageToken} />
              <Field label="Title">
                <Input name="title" defaultValue={session.title} required />
              </Field>
              <Field label="Date and time">
                <Input
                  name="starts_at"
                  type="datetime-local"
                  defaultValue={formatMalaysiaDateTimeLocalInput(session.starts_at)}
                  required
                />
              </Field>
              <Field label="Duration (minutes)">
                <Input name="duration_min" type="number" min="1" defaultValue={session.duration_min} required />
              </Field>
              <Field label="Location">
                <Input name="location" defaultValue={session.location} required />
              </Field>
              <Field label="Court number(s)">
                <Input name="court_numbers" defaultValue={session.court_numbers ?? ""} placeholder="Court number(s)" />
              </Field>
              <Field label="Notes">
                <Textarea name="notes" defaultValue={session.notes ?? ""} />
              </Field>
              <Button>Save changes</Button>
            </form>
          </Card>
          {!cancelled && (
            <form action={cancelSessionAction}>
              <input type="hidden" name="manage_token" value={manageToken} />
              <Button variant="danger" className="w-full">Cancel session</Button>
            </form>
          )}
        </>
      }
    >
      {banners}
      <div>
        <Badge tone="confirmed">Confirmed</Badge>
        <h1 className="mt-2 text-2xl font-extrabold text-heading">
          Manage: {session.title}
        </h1>
      </div>
      <ShareLinks guestUrl={guestUrl} manageUrl={manageUrl} />
      <Card title="Verify attendance">
        <AttendanceVerify manageToken={manageToken} participants={participants} />
      </Card>
      <Card title="Cost">
        <CostForm session={session} />
        <div className="mt-3 border-t border-border pt-3">
          <StatRow label="Total" value={`RM ${cost.total.toFixed(2)}`} />
          <StatRow label="Attended" value={attended} />
          <StatRow
            label="Per person"
            value={cost.perHead == null ? "-" : `RM ${cost.perHead.toFixed(2)}`}
          />
        </div>
      </Card>
    </PageShell>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → Expected: no errors.
Run: `npm run dev`; open a draft manage link and a finalized manage link. Confirm: votes/attendance/cost on the left, sticky edit panel + cancel button on the right (desktop); single column on phone; copy buttons, save forms, finalize, and cancel all still work; light/dark both fine.

- [ ] **Step 7: Commit**

```bash
git add "src/app/m/[manageToken]/page.tsx" src/components/CostForm.tsx src/components/AttendanceVerify.tsx src/components/FinalizeTimeOptionForm.tsx src/components/CopyLinkButton.tsx
git commit -m "feat(ui): re-skin manage page and its forms"
```

---

## Task 12: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Lint, types, logic tests**

Run: `npm run lint` → Expected: clean.
Run: `npx tsc --noEmit` → Expected: no errors.
Run: `npm test` → Expected: existing logic tests pass (unchanged), proving server/logic untouched.

- [ ] **Step 2: Production build**

Run: `npm run build` → Expected: build succeeds with no errors.

- [ ] **Step 3: Manual responsive + dark-mode matrix**

With `npm run dev`, check every page at **~375px** and **~1280px**, in **light** and **OS dark**:
- `/` (create) — logged out and logged in
- `/login`, `/register`, `/forgot-password`
- `/s/[guest]` draft and finalized; cancelled variant
- `/m/[manage]` draft and finalized; cancelled variant
- a bad token URL (not-found)

Confirm for each: two columns → single column collapse, sticky action panel on desktop, readable contrast in both themes, buttons visibly press on tap/click.

- [ ] **Step 4: Final commit (only if any polish tweaks were needed)**

```bash
git add -A
git commit -m "chore(ui): responsive redesign verification polish"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** Theme/tokens → Task 1. Each of the 8 components → Tasks 2–7. Two-column responsive shell → Task 7 (`PageShell`). Per-page layouts (create, auth, guest×2, manage×2, not-found) → Tasks 8–11. All "states to handle" (success/cancelled banners via `Alert`, badges, empty states, field errors, disabled buttons) → covered in the component APIs and page re-skins. Button interactive feedback (hover/active/focus-visible/reduced-motion) → Task 2. Verification → Task 12. ✓
- **Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓
- **Type consistency:** Component prop names (`variant`, `tone`, `highlight`, `headerRight`, `aside`, `narrow`, `label`, `error`, `trailing`) are used consistently between definition (Tasks 2–7) and consumption (Tasks 8–11). Barrel exports in Task 7 match all import sites. ✓
- **Untouched-logic guarantee:** No task edits `actions.ts`, `db.ts`, `cost.ts`, `tokens.ts`, `identity.ts`, or any `*.test.ts`; `name=`/`value=`/`action=` attributes preserved verbatim in every re-skinned form. ✓
