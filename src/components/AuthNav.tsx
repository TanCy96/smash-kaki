import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui";
import { getProfile } from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";

/**
 * Header auth controls: a log-out form when signed in, otherwise log in /
 * register links. Self-fetches the player when `playerId` isn't supplied, so
 * pages that already resolved it (e.g. the create page) can pass it through to
 * avoid a second auth round-trip.
 */
export async function AuthNav({
  playerId: playerIdProp,
  displayName: displayNameProp,
}: {
  playerId?: string | null;
  displayName?: string;
} = {}) {
  const playerId =
    playerIdProp !== undefined ? playerIdProp : await currentPlayerId();
  const displayName =
    displayNameProp !== undefined
      ? displayNameProp
      : playerId
        ? ((await getProfile(playerId))?.display_name ?? "")
        : "";

  if (playerId) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/sessions" className="font-semibold text-primary hover:underline">
          My sessions
        </Link>
        <form action={logoutAction} className="flex items-center gap-3">
          <span className="max-w-32 truncate font-medium text-muted">
            {displayName || "Signed in"}
          </span>
          <Button variant="ghost" className="px-2 py-1">
            Log out
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex gap-2 text-sm font-semibold">
      <Link href="/login" className="text-primary hover:underline">
        Log in
      </Link>
      <Link href="/register" className="text-primary hover:underline">
        Register
      </Link>
    </div>
  );
}
