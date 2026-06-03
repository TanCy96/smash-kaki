# Session Time Poll Design

## Goal

Add a pre-session timing poll so the organizer can share one invite link before
the badminton session is confirmed. Guests choose the time options they can
attend, everyone can see the current preference summary, and the organizer can
finalize one option into the real session.

After finalization, guests who chose the selected time are automatically included
as `going` RSVPs. Guests and the organizer can still change or retract their RSVP
after the session is finalized.

## Recommended Approach

Extend the existing session model with a draft/finalized lifecycle and keep the
same `/m/[manageToken]` and `/s/[guestToken]` links throughout.

This preserves the current token-based architecture:

- `/m/[manageToken]` remains the secret organizer link.
- `/s/[guestToken]` remains the shareable guest link.
- Guest pages never render the manage token.
- All writes still go through server actions and `db.ts` using the service-role
  key.

The alternatives considered were:

- Separate `polls` routes/tables that later create sessions. This has clean
  separation, but creates awkward link handoff or redirect behavior.
- Store time options as JSON on `sessions`. This is quick, but weak for vote
  replacement, identity matching, counts, and future querying.

## Data Model

Add a lifecycle field to `sessions`:

- `lifecycle text not null default 'draft' check (lifecycle in ('draft','finalized'))`

Newly created sessions start as `draft`. Once the organizer picks an option, the
session becomes `finalized`.

Add `session_time_options`:

- `id uuid primary key default gen_random_uuid()`
- `session_id uuid not null references sessions(id) on delete cascade`
- `starts_at timestamptz not null`
- `duration_min int not null`
- `label text`
- `created_at timestamptz not null default now()`

Add `time_option_votes`:

- `id uuid primary key default gen_random_uuid()`
- `session_time_option_id uuid not null references session_time_options(id) on delete cascade`
- `name text not null`
- `participant_token text not null`
- `player_id uuid references profiles(id) on delete set null`
- `created_at timestamptz not null default now()`

Votes are identity-resolved using the same priority as RSVP updates: logged-in
player, device token, duplicate name, then new identity.

## Create Flow

The create page changes from "create a confirmed session" to "create a draft
session poll".

The organizer enters:

- Organizer name
- Session title
- Location
- Optional court numbers
- Optional notes
- Two or more time options, each with date/time and duration

Submitting creates:

- One `sessions` row with `lifecycle = 'draft'`
- One `session_time_options` row per proposed time
- Initial organizer votes for the options they are available for, if captured in
  the form

The organizer lands on `/m/[manageToken]?created=1`, where they can copy the
guest link as today.

## Draft Guest Flow

While `sessions.lifecycle = 'draft'`, `/s/[guestToken]` shows the poll view
instead of the finalized RSVP view.

Guests can:

- Enter their name
- Select one or more time options they can attend
- Submit to save their choices
- Submit again to replace their previous choices
- Clear all choices and submit to retract their availability

Everyone can see each option with:

- Date/time and duration
- Count of people available
- Names of people available

Cancelled draft sessions show the existing closed/cancelled state.

## Draft Manage Flow

While draft, `/m/[manageToken]` shows:

- Share/manage links
- Editable draft details
- Time option vote summary
- A finalize action for each time option

Finalizing an option:

- Verifies the manage token.
- Confirms the selected option belongs to the draft session.
- Updates `sessions.starts_at` and `sessions.duration_min` from that option.
- Sets `sessions.lifecycle = 'finalized'`.
- Creates or updates `participants` rows with `rsvp = 'going'` for everyone who
  voted for the selected option.
- Redirects back to `/m/[manageToken]?saved=finalized`.

Guests who did not vote for the selected time are not automatically added as
participants. They can still RSVP later from the guest link.

## Finalized Flow

After finalization, the existing session behavior remains:

- `/s/[guestToken]` shows session details, RSVP form, going list, and cost summary.
- `/m/[manageToken]` shows edit details, attendance verification, cost, and cancel.
- Guests can retract or change their decision by submitting `cant`, `maybe`, or
  `going`.
- The organizer can also be represented as a participant and can update their RSVP
  through the same identity rules.

The selected time option and other historic options may remain stored for audit
and display, but the active session details come from `sessions.starts_at` and
`sessions.duration_min`.

## Error Handling

Server actions should no-op or redirect back when:

- Tokens are invalid.
- The session is cancelled.
- A guest tries to vote after finalization.
- The organizer tries to finalize an option from another session.
- The organizer tries to finalize a session that is already finalized.

Guest and manage pages should continue using `notFound()` for invalid tokens.

## Testing

Pure logic should be added for poll identity/vote replacement behavior before
implementation:

- Returning device replaces prior time-option votes.
- Logged-in player identity wins over device token.
- Duplicate name updates the existing voter when there is no login/device match.
- Clearing choices retracts all availability for that identity.

Database/server-action behavior should be covered through focused integration or
manual verification:

- Create draft session with multiple options.
- Guest votes and can change/retract choices.
- Guest page shows vote counts and names.
- Manage page finalizes an option.
- Selected voters become `going` participants.
- Non-selected voters are not auto-added.
- Finalized guest/manage pages keep existing RSVP, attendance, and cost behavior.

