import { notFound } from "next/navigation";
import { AuthNav } from "@/components/AuthNav";
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
        headerRight={<AuthNav />}
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
      headerRight={<AuthNav />}
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
