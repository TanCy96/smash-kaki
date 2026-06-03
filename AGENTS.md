# AGENTS.md — SmashKaki 🏸

Orientation for any AI coding agent working in this repo.

## What this project is

A no-login, link-shared web app for organizing badminton sessions: set a
session's time / location / court, share an invite link, collect RSVPs, verify who
actually attended, and record the cost (court rate + shuttlecocks used) with an
equal per-head split. Works on phone and PC. Built in Malaysia (currency shown as
RM; "kaki" = your regular crew).

## Tech stack

- **Next.js 15** (App Router, TypeScript, Node runtime) — one responsive codebase.
- **Tailwind CSS** — mobile-first styling.
- **Supabase** — Postgres (data) + Supabase Auth (optional email+password accounts).
  - Server data access uses the **service-role key** (`@supabase/supabase-js`).
  - Auth uses **`@supabase/ssr`** (cookie-based) with the anon key.
- **nanoid** — 22-char unguessable session tokens.
- **zod** — input validation in server actions.
- **Vitest** — unit tests for pure logic.

## Architecture in one breath

No accounts required. Every session has two unguessable URL tokens: a secret
**manage** token (`/m/[token]` — edit, verify attendance, enter cost) and a
shareable **guest** token (`/s/[token]` — view + RSVP). All DB writes go through
server-side code using the service-role key; access is gated by which token the
URL carries. Pure logic (`cost.ts`, `tokens.ts`, `identity.ts`) is I/O-free and
unit-tested. `db.ts` is the only module that touches Supabase data.

## Hard rules

1. **Do NOT push commits.** Commits can be done on each task completion, but do not
push unless given permission to.
2. **Service-role key is server-only.** Never import `db.ts` or
   `SUPABASE_SERVICE_ROLE_KEY` into a client component. It must never reach the
   browser. Guest pages must never render the manage token.
3. **Stay vendor-portable.** This must later self-host on a NAS with config-only
   changes. So: standard Next.js Node runtime (no edge-only routes), NO
   Vercel-proprietary services (KV, Edge Config, Blob), standard Postgres access,
   all secrets in env vars.
4. **TDD for pure logic.** Write the failing Vitest test first for `cost.ts`,
   `tokens.ts`, `identity.ts`, then implement. Keep business math out of components.
5. **Secrets live in `.env.local`** (gitignored). Never hardcode keys or commit them.

## Commands

```bash
npm run dev          # local dev at http://localhost:3000
npm run build        # production build (must pass before deploy)
npm run test         # Vitest unit tests (run once)
npm run test:watch   # Vitest watch mode
npx tsc --noEmit     # type-check
```

## Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # anon/public key (auth client)
SUPABASE_SERVICE_ROLE_KEY=       # service role (SERVER ONLY)
NEXT_PUBLIC_BASE_URL=            # http://localhost:3000 in dev; Vercel URL in prod
```

A `.env.local.example` is committed as a template; the real `.env.local` is not.

## Data model (3 tables — see `supabase/schema.sql`)

- **sessions** — tokens, title, starts_at, duration_min, location, court_numbers,
  notes, status (active/cancelled), and nullable cost fields (court_cost,
  shuttles_used, price_per_shuttle).
- **profiles** — `id` (= Supabase auth user id), `display_name`. Minimal on
  purpose; upgradable later.
- **participants** — session_id, name, rsvp (going/maybe/cant), attended,
  participant_token (device identity), player_id (nullable, set when logged in).
