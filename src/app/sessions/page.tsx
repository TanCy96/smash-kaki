import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Badge, Card, PageShell } from "@/components/ui";
import { formatMalaysiaDateTime } from "@/lib/datetime";
import { listSessionsJoinedBy, listSessionsManagedBy } from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";
import type { Session } from "@/lib/types";

function SessionRow({
  session,
  href,
  url,
  copyLabel,
}: {
  session: Session;
  href: string;
  url: string;
  copyLabel: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge tone={session.lifecycle === "draft" ? "draft" : "confirmed"}>
            {session.lifecycle === "draft" ? "Poll" : "Confirmed"}
          </Badge>
          <Link href={href} className="truncate font-semibold text-heading hover:underline">
            {session.title}
          </Link>
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {session.starts_at ? `${formatMalaysiaDateTime(session.starts_at)} - ` : ""}
          {session.location}
        </p>
      </div>
      <CopyLinkButton url={url} label={copyLabel} />
    </li>
  );
}

export default async function MySessionsPage() {
  const playerId = await currentPlayerId();
  if (!playerId) redirect("/login");

  const [managing, joined] = await Promise.all([
    listSessionsManagedBy(playerId),
    listSessionsJoinedBy(playerId),
  ]);

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  return (
    <PageShell headerRight={<AuthNav playerId={playerId} />}>
      <div>
        <h1 className="text-2xl font-extrabold text-heading">My sessions</h1>
        <p className="mt-1 text-sm text-muted">
          Recover the links for sessions you organize or have joined.
        </p>
      </div>

      <Card title={`Organizing (${managing.length})`}>
        {managing.length === 0 ? (
          <p className="text-sm text-muted">You&apos;re not organizing any active sessions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {managing.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                href={`/m/${session.manage_token}`}
                url={`${base}/m/${session.manage_token}`}
                copyLabel="Copy manage link"
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Joined (${joined.length})`}>
        {joined.length === 0 ? (
          <p className="text-sm text-muted">You haven&apos;t joined any active sessions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {joined.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                href={`/s/${session.guest_token}`}
                url={`${base}/s/${session.guest_token}`}
                copyLabel="Copy guest link"
              />
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
