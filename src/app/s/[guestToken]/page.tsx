import { notFound } from "next/navigation";
import { RsvpForm } from "@/components/RsvpForm";
import { TimePollForm } from "@/components/TimePollForm";
import { TimePollSummary } from "@/components/TimePollSummary";
import { computeCost } from "@/lib/cost";
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
      <main className="mx-auto max-w-md p-4">
        {session.status === "cancelled" && (
          <div className="mb-3 rounded bg-red-100 p-2 text-red-800">
            This poll was cancelled.
          </div>
        )}
        <h1 className="text-2xl font-bold">{session.title}</h1>
        <p>
          {session.location}
          {session.court_numbers ? ` - Court ${session.court_numbers}` : ""}
        </p>
        {session.notes && (
          <p className="text-sm text-gray-600">{session.notes}</p>
        )}

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

  if (!session.starts_at || !session.duration_min) notFound();

  const participants = await listParticipants(session.id);
  const going = participants.filter(
    (participant) => participant.rsvp === "going"
  );
  const attended = participants.filter((participant) => participant.attended);
  const cost = computeCost({
    courtCost: session.court_cost,
    shuttlesUsed: session.shuttles_used,
    pricePerShuttle: session.price_per_shuttle,
    attendedCount: attended.length,
  });
  const hasCost = session.court_cost != null || session.shuttles_used != null;

  return (
    <main className="mx-auto max-w-md p-4">
      {session.status === "cancelled" && (
        <div className="mb-3 rounded bg-red-100 p-2 text-red-800">
          This session was cancelled.
        </div>
      )}
      <h1 className="text-2xl font-bold">{session.title}</h1>
      <p>
        {new Date(session.starts_at).toLocaleString()} - {session.duration_min}{" "}
        min
      </p>
      <p>
        {session.location}
        {session.court_numbers ? ` - Court ${session.court_numbers}` : ""}
      </p>
      {session.notes && <p className="text-sm text-gray-600">{session.notes}</p>}

      <h2 className="mt-4 font-semibold">RSVP</h2>
      {submitted === "1" && (
        <p className="mb-2 rounded bg-emerald-100 p-2 text-sm text-emerald-900">
          RSVP submitted.
        </p>
      )}
      <RsvpForm
        guestToken={guestToken}
        disabled={session.status === "cancelled"}
      />

      <h2 className="mt-4 font-semibold">Going ({going.length})</h2>
      <ul className="list-disc pl-5">
        {going.map((participant) => (
          <li key={participant.id}>{participant.name}</li>
        ))}
      </ul>

      {hasCost && (
        <div className="mt-4 rounded bg-gray-100 p-3">
          <h2 className="font-semibold">Cost summary</h2>
          <p>Total: RM {cost.total.toFixed(2)}</p>
          <p>Attended: {attended.length}</p>
          <p>
            Per person:{" "}
            {cost.perHead == null ? "-" : `RM ${cost.perHead.toFixed(2)}`}
          </p>
          {cost.remainder !== 0 && (
            <p className="text-xs text-gray-500">
              Rounding leftover: RM {cost.remainder.toFixed(2)}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
