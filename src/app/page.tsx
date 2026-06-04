import Link from "next/link";
import { CreateSessionForm } from "@/components/CreateSessionForm";
import { Button, Card, PageShell } from "@/components/ui";
import { getProfile } from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";
import { logoutAction } from "./actions";

export default async function CreatePage() {
  const playerId = await currentPlayerId();
  const profile = playerId ? await getProfile(playerId) : null;
  const displayName = profile?.display_name ?? "";

  const headerRight = playerId ? (
    <form action={logoutAction} className="flex items-center gap-3 text-sm">
      <span className="max-w-32 truncate font-medium text-muted">
        {displayName || "Signed in"}
      </span>
      <Button variant="ghost" className="px-2 py-1">
        Log out
      </Button>
    </form>
  ) : (
    <div className="flex gap-2 text-sm font-semibold">
      <Link href="/login" className="text-primary hover:underline">
        Log in
      </Link>
      <Link href="/register" className="text-primary hover:underline">
        Register
      </Link>
    </div>
  );

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
    <PageShell headerRight={headerRight} aside={aside}>
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
