import { AuthNav } from "@/components/AuthNav";
import { CreateSessionForm } from "@/components/CreateSessionForm";
import { Card, PageShell } from "@/components/ui";
import { getProfile } from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";

export default async function CreatePage() {
  const playerId = await currentPlayerId();
  const profile = playerId ? await getProfile(playerId) : null;
  const displayName = profile?.display_name ?? "";

  const aside = (
    <Card highlight title="How it works">
      <ol className="flex flex-col gap-3 text-sm text-ink">
        <li><span className="font-bold text-heading">1. Plan</span> — set time, place, court.</li>
        <li><span className="font-bold text-heading">2. Share</span> — send the guest link to your kaki.</li>
        <li><span className="font-bold text-heading">3. Split</span> — verify who came, split the cost evenly.</li>
      </ol>
    </Card>
  );

  return (
    <PageShell
      headerRight={<AuthNav playerId={playerId} displayName={displayName} />}
      aside={aside}
    >
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Plan a session</h1>
        <p className="mt-1 text-sm text-muted">
          Plan a session, share a link, split the cost.
        </p>
      </div>
      <CreateSessionForm displayName={displayName} />
    </PageShell>
  );
}
