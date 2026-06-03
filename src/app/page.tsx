import Link from "next/link";
import { CreateSessionForm } from "@/components/CreateSessionForm";
import { getProfile } from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";
import { logoutAction } from "./actions";

export default async function CreatePage() {
  const playerId = await currentPlayerId();
  const profile = playerId ? await getProfile(playerId) : null;
  const displayName = profile?.display_name ?? "";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-gray-950">
      <section className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">SmashKaki</h1>
            <p className="mt-1 text-sm text-gray-600">
              Plan a session, share a link, split the cost.
            </p>
          </div>
          {playerId ? (
            <form
              action={logoutAction}
              className="flex shrink-0 items-center gap-3 text-sm"
            >
              <span className="max-w-32 truncate font-medium text-gray-700">
                {displayName || "Signed in"}
              </span>
              <button className="font-medium text-emerald-700">Log out</button>
            </form>
          ) : (
            <div className="flex gap-3 text-sm font-medium">
              <Link href="/login" className="text-emerald-700">
                Log in
              </Link>
              <Link href="/register" className="text-emerald-700">
                Register
              </Link>
            </div>
          )}
        </div>

        <CreateSessionForm displayName={displayName} />
      </section>
    </main>
  );
}
