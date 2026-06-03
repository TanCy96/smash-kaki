import { notFound } from "next/navigation";
import {
  cancelSessionAction,
  editSessionAction,
} from "@/app/actions";
import { AttendanceVerify } from "@/components/AttendanceVerify";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { CostForm } from "@/components/CostForm";
import { computeCost } from "@/lib/cost";
import { getSessionByManageToken, listParticipants } from "@/lib/db";

function toLocalInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 16);
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
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const guestUrl = `${base}/s/${session.guest_token}`;
  const manageUrl = `${base}/m/${session.manage_token}`;

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-bold">Manage: {session.title}</h1>
      {created && (
        <p className="rounded bg-emerald-100 p-2 text-emerald-900">
          Session created! Share the guest link below.
        </p>
      )}
      {saved && (
        <p className="mt-2 rounded bg-emerald-100 p-2 text-emerald-900">
          Changes saved.
        </p>
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
          defaultValue={toLocalInput(session.starts_at)}
          required
          className="rounded border p-2"
        />
        <input
          name="duration_min"
          type="number"
          min="1"
          defaultValue={session.duration_min}
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
