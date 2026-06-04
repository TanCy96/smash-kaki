import { notFound } from "next/navigation";
import {
  cancelSessionAction,
  editSessionAction,
  removeParticipantAction,
} from "@/app/actions";
import { AttendanceVerify } from "@/components/AttendanceVerify";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { AddPlayersForm } from "@/components/AddPlayersForm";
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
                  step={3600}
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
      <Card title="Players">
        <ul className="flex flex-col gap-2">
          {participants.length === 0 && (
            <li className="text-sm text-muted">No players yet.</li>
          )}
          {participants.map((participant) => (
            <li
              key={participant.id}
              className="flex items-center justify-between gap-2 text-sm text-ink"
            >
              <span>
                {participant.name}{" "}
                <span className="text-xs text-muted">({participant.rsvp})</span>
              </span>
              {!cancelled && (
                <form action={removeParticipantAction}>
                  <input type="hidden" name="manage_token" value={manageToken} />
                  <input
                    type="hidden"
                    name="participant_id"
                    value={participant.id}
                  />
                  <Button variant="ghost">Remove</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {!cancelled && (
          <div className="mt-3 border-t border-border pt-3">
            <AddPlayersForm manageToken={manageToken} />
          </div>
        )}
      </Card>
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
