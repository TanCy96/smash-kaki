import { notFound } from "next/navigation";
import { AuthNav } from "@/components/AuthNav";
import { RsvpForm } from "@/components/RsvpForm";
import { TimePollForm } from "@/components/TimePollForm";
import { TimePollSummary } from "@/components/TimePollSummary";
import { Alert, Badge, Card, PageShell, StatRow } from "@/components/ui";
import { computeCost } from "@/lib/cost";
import { formatMalaysiaDateTime } from "@/lib/datetime";
import {
  getProfile,
  getSessionByGuestToken,
  listParticipants,
  listSessionTimeOptions,
} from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";

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

  const playerId = await currentPlayerId();
  const displayName = playerId
    ? ((await getProfile(playerId))?.display_name ?? "")
    : "";

  if (session.lifecycle === "draft") {
    const options = await listSessionTimeOptions(session.id);
    const clientOptions = options.map((option) => ({
      ...option,
      votes: option.votes.map((vote) => ({ ...vote, added_by_token: null })),
    }));

    return (
      <PageShell
        headerRight={<AuthNav playerId={playerId} displayName={displayName} />}
        aside={
          <Card highlight title="Pick your available times">
            {submitted === "1" && <Alert tone="success">Availability saved.</Alert>}
            <div className="mt-3">
              <TimePollForm
                guestToken={guestToken}
                options={clientOptions}
                disabled={session.status === "cancelled"}
                displayName={displayName}
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
          <TimePollSummary options={clientOptions} />
        </Card>
      </PageShell>
    );
  }

  if (!session.starts_at || !session.duration_min) notFound();

  const participants = await listParticipants(session.id);
  const going = participants.filter((p) => p.rsvp === "going");
  const maybe = participants.filter((p) => p.rsvp === "maybe");
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
      headerRight={<AuthNav playerId={playerId} displayName={displayName} />}
      aside={
        <Card highlight title="Your RSVP">
          {submitted === "1" && <Alert tone="success">RSVP submitted.</Alert>}
          <div className="mt-3">
            <RsvpForm
              guestToken={guestToken}
              disabled={session.status === "cancelled"}
              displayName={displayName}
            />
          </div>
        </Card>
      }
    >
      {session.status === "cancelled" && <Alert tone="danger">This session was cancelled.</Alert>}
      <div>
        <Badge tone="confirmed">Confirmed</Badge>
        <h1 className="mt-2 text-2xl font-extrabold text-heading">{session.title}</h1>
        <div className="mt-3 grid gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="text-lg leading-none">🕒</span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">When</p>
              <p className="text-sm font-bold text-heading">
                {formatMalaysiaDateTime(session.starts_at)}
              </p>
              <p className="text-xs text-muted">{session.duration_min} min</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="text-lg leading-none">📍</span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Where</p>
              <p className="text-sm font-bold text-heading">{session.location}</p>
              {session.court_numbers && (
                <p className="text-xs font-semibold text-primary">
                  Court {session.court_numbers}
                </p>
              )}
            </div>
          </div>
        </div>
        {session.notes && <p className="mt-2 text-sm text-muted">{session.notes}</p>}
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

      {maybe.length > 0 && (
        <Card title={`Maybe (${maybe.length})`}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {maybe.map((p) => (
              <li
                key={p.id}
                className="rounded-lg bg-accent-bg px-2 py-1 font-medium text-accent-ink"
              >
                {p.name}
              </li>
            ))}
          </ul>
        </Card>
      )}

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
