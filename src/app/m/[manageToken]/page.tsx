import { notFound } from "next/navigation";
import {
  cancelSessionAction,
  editSessionAction,
} from "@/app/actions";
import { AttendanceVerify } from "@/components/AttendanceVerify";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { CostForm } from "@/components/CostForm";
import { FinalizeTimeOptionForm } from "@/components/FinalizeTimeOptionForm";
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

  if (session.lifecycle === "draft") {
    const options = await listSessionTimeOptions(session.id);

    return (
      <main className="mx-auto max-w-md p-4">
        <h1 className="text-2xl font-bold">Manage poll: {session.title}</h1>
        {session.status === "cancelled" && (
          <p className="mt-2 rounded bg-red-100 p-2 text-red-800">
            This poll was cancelled.
          </p>
        )}
        {created && (
          <p className="mt-2 rounded bg-emerald-100 p-2 text-emerald-900">
            Poll created. Share the guest link below.
          </p>
        )}
        {saved === "finalized" ? (
          <p className="mt-2 rounded bg-emerald-100 p-2 text-emerald-900">
            Session finalized.
          </p>
        ) : (
          saved && (
            <p className="mt-2 rounded bg-emerald-100 p-2 text-emerald-900">
              Changes saved.
            </p>
          )
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

        <section className="mt-4">
          <h2 className="font-semibold">Poll details</h2>
          <p className="text-sm text-gray-700">
            {session.location}
            {session.court_numbers ? ` - Court ${session.court_numbers}` : ""}
          </p>
          {session.notes && (
            <p className="text-sm text-gray-600">{session.notes}</p>
          )}
        </section>

        <section className="mt-4">
          <h2 className="font-semibold">Current preferences</h2>
          <div className="mt-2 flex flex-col gap-3">
            {options.map((option) => (
              <section
                key={option.id}
                className="rounded-md border border-gray-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-950">
                      {formatMalaysiaDateTime(option.starts_at)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {option.duration_min} min
                    </p>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-800">
                    {option.votes.length}
                  </span>
                </div>
                {option.votes.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No votes yet.</p>
                ) : (
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
                {session.status !== "cancelled" && (
                  <div className="mt-3">
                    <FinalizeTimeOptionForm
                      manageToken={manageToken}
                      timeOptionId={option.id}
                    />
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>

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

  if (!session.starts_at || !session.duration_min) notFound();

  const participants = await listParticipants(session.id);
  const attended = participants.filter(
    (participant) => participant.attended
  ).length;
  const cost = computeCost({
    courtCost: session.court_cost,
    shuttlesUsed: session.shuttles_used,
    pricePerShuttle: session.price_per_shuttle,
    attendedCount: attended,
  });
  const startsAt = session.starts_at;
  const durationMin = session.duration_min;

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-bold">Manage: {session.title}</h1>
      {created && (
        <p className="rounded bg-emerald-100 p-2 text-emerald-900">
          Session created! Share the guest link below.
        </p>
      )}
      {saved === "finalized" ? (
        <p className="mt-2 rounded bg-emerald-100 p-2 text-emerald-900">
          Session finalized.
        </p>
      ) : (
        saved && (
          <p className="mt-2 rounded bg-emerald-100 p-2 text-emerald-900">
            Changes saved.
          </p>
        )
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

      <h2 className="mt-4 font-semibold">Edit details</h2>
      <form action={editSessionAction} className="flex flex-col gap-2">
        <input type="hidden" name="manage_token" value={manageToken} />
        <input
          name="title"
          defaultValue={session.title}
          required
          className="rounded border p-2"
        />
        <input
          name="starts_at"
          type="datetime-local"
          defaultValue={formatMalaysiaDateTimeLocalInput(startsAt)}
          required
          className="rounded border p-2"
        />
        <input
          name="duration_min"
          type="number"
          min="1"
          defaultValue={durationMin}
          required
          className="rounded border p-2"
        />
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
          Save changes
        </button>
      </form>

      <h2 className="mt-4 font-semibold">Verify attendance</h2>
      <AttendanceVerify manageToken={manageToken} participants={participants} />

      <h2 className="mt-4 font-semibold">Cost</h2>
      <CostForm session={session} />
      <div className="mt-2 rounded bg-gray-100 p-3">
        <p>
          Total: RM {cost.total.toFixed(2)} - Attended: {attended}
        </p>
        <p>
          Per person:{" "}
          {cost.perHead == null ? "-" : `RM ${cost.perHead.toFixed(2)}`}
        </p>
      </div>

      {session.status !== "cancelled" && (
        <form action={cancelSessionAction} className="mt-4">
          <input type="hidden" name="manage_token" value={manageToken} />
          <button className="rounded bg-red-600 p-2 text-sm text-white">
            Cancel session
          </button>
        </form>
      )}
    </main>
  );
}
