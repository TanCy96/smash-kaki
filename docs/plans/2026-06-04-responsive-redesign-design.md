# SmashKaki Responsive Redesign — Design

**Date:** 2026-06-04
**Status:** Approved (design); pending implementation plan
**Scope:** Full visual redesign of all pages for phone + PC, with a shared component layer.

## Goal

Give SmashKaki a cohesive visual identity that looks good on a phone and makes
real use of a desktop screen, replacing the current thin centered `max-w-md`
column and ad-hoc per-component styling. This is a **presentation-layer change
only** — no server actions, data access, pure logic, or tests are modified.

## Decisions

| Area | Decision |
|------|----------|
| Scope | All pages: create (`/`), guest (`/s/[guestToken]`), manage (`/m/[manageToken]`), auth (login / register / forgot-password) |
| Style | **Sporty & Energetic** — bold emerald, rounded shapes, punchy gradient buttons, heavy heading weights |
| Desktop layout | **Two-column**: left = read/review content, right = sticky action panel; collapses to single column on phone |
| Dark mode | **Follows system preference** (`prefers-color-scheme`), no toggle |
| Approach | **Design-system-first**: CSS variable tokens + a small shared component layer, then re-skin pages onto it |
| Dependencies | **None added** — Tailwind 4 + Geist only |

## Section 1 — Theme & Tokens

All colors are defined once as CSS variables in `globals.css`, with a
`prefers-color-scheme: dark` block overriding them. Tailwind 4 `@theme` maps the
variables to utility classes, so components write `bg-card text-heading` once and
get both modes for free.

Token set (names indicative; exact values tuned during implementation):

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg` | `#f0fdf4` (mint) | `#0a1410` | page background |
| `--card` | `#ffffff` | `#13211b` | card surface |
| `--border` | `#e5e7eb` | `#1e3a2f` | hairlines |
| `--text` | `#374151` | `#a7c4b5` | body text |
| `--heading` | `#064e3b` | `#ecfdf5` | headings (weight 700–800) |
| `--muted` | `#6b7280` | `#6b8577` | secondary text |
| `--primary` | `#10b981` | `#10b981` | primary actions (emerald gradient → `#34d399`) |
| `--accent` | `#f59e0b` | `#f59e0b` | pending / warning |
| `--danger` | `#dc2626` | `#f87171` | destructive / errors |

Typography stays **Geist** (already loaded via `next/font`); headings use heavier
weights (700–800) to carry the sporty feel.

## Section 2 — Component Layer (`src/components/ui/`)

~8 small, single-purpose components. The theme and dark mode live entirely here,
so the rest of the app inherits both. These replace today's scattered class
strings (e.g. `CreateSessionForm`'s local `inputClass`/`labelClass`,
`RsvpForm`'s bare `rounded border p-2`).

- **PageShell** — responsive frame: header (logo + auth links) + content area that
  is single-column on phone, two-column (`main` + sticky `aside`) on desktop via a
  single `lg:` breakpoint. Pages declare which slot is `main` and which is `aside`.
- **Card** — section container; optional title + body.
- **Button** — variants: `primary` (emerald gradient), `secondary` (outline),
  `danger`/`ghost`, plus disabled state. Interactive feedback on every variant:
  `hover` (slightly darker/raised) for pointer devices, `active:` press state
  (scale-down + darker) so taps feel responsive on touch where hover doesn't
  apply, and a visible `focus-visible` ring for keyboard. Honors
  `prefers-reduced-motion` (no scale transition when set).
- **Field** — wraps Input / Textarea / Select with a label and an error slot.
- **Badge** — status pills (Confirmed / Draft / Cancelled).
- **Alert** — inline feedback banners (success / danger), for the existing
  `created` / `saved` / `submitted` / cancelled messages.
- **SectionHeading** — heading + optional trailing value (e.g. cost-per-head).
- **StatRow** — label + value row used in summaries.

Existing functional components (`RsvpForm`, `CostForm`, `TimePollForm`,
`TimePollSummary`, `AttendanceVerify`, `CreateSessionForm`, `FinalizeTimeOptionForm`,
`CopyLinkButton`) are re-skinned to compose these. **Their logic and the server
actions they call stay untouched.**

## Section 3 — Per-Page Layouts

Consistent rule: **LEFT = what you read/review** (details, lists, results);
**RIGHT (sticky) = the one thing you act on.** On phone the `aside` drops below
`main` in source order, full-width and not sticky — one scroll.

1. **Create (`/`)** — `main`: the create-session form. `aside`: tagline + short
   "plan → share → split" explainer.
2. **Guest, finalized (`/s/`)** — `main`: session details + attendee list (+ cost
   when present). `aside`: RSVP form.
3. **Guest, draft (`/s/`)** — `main`: session details + vote tallies
   (`TimePollSummary`). `aside`: "pick your times" poll form (`TimePollForm`).
4. **Manage, finalized (`/m/`)** — `main`: share links, attendance verify, cost
   summary. `aside`: edit details + cost inputs.
5. **Manage, draft (`/m/`)** — `main`: share links, per-option votes with finalize
   buttons. `aside`: edit details.
6. **Auth (login / register / forgot)** — no two columns; a single centered Card
   (~400px max), vertically centered.

## States to Handle

All already present in the code; the redesign gives them styled treatment:

- Success messages (`created`, `saved`, `submitted`) → **Alert** (success)
- Cancelled session → **Alert** (danger) + **Badge** "Cancelled"
- Empty states ("No votes yet", "RSVP closed - session cancelled") → muted text in Card
- Form validation errors → **Field** error slot
- Disabled / pending buttons → **Button** disabled variant

## Implementation Order

Each step leaves the app working:

1. Add CSS variable tokens + `prefers-color-scheme` dark block to `globals.css`;
   wire Tailwind 4 `@theme`. (No visible change yet.)
2. Build `src/components/ui/` components in isolation.
3. Adopt `PageShell` (two-column responsive frame).
4. Re-skin pages one at a time: create → auth → guest → manage.

## Verification

- `npm test` (Vitest) stays green — proves logic untouched.
- `npm run lint` clean.
- Manual responsive check of each page at ~375px (phone) and ~1280px (desktop),
  in both light and OS dark mode: confirm two-column → single-column collapse and
  sticky-panel behavior.

## Out of Scope

- Any change to server actions, `db.ts`, or pure logic (`cost.ts`, `tokens.ts`,
  `identity.ts`).
- A user-selectable dark-mode toggle (system preference only).
- New features or new pages.
- New dependencies / component libraries.
