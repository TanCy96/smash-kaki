import Link from "next/link";
import { createSessionAction, logoutAction } from "./actions";
import { getProfile } from "@/lib/db";
import { currentPlayerId } from "@/lib/supabase-auth";

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-gray-700";

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

        <form
          action={createSessionAction}
          className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <label className={labelClass}>
            Your name
            <input
              name="organizer_name"
              placeholder="Alex"
              defaultValue={displayName}
              required
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Session title
            <input
              name="title"
              placeholder="Friday Smash"
              required
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Date & time
            <input
              name="starts_at"
              type="datetime-local"
              required
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Duration (minutes)
            <input
              name="duration_min"
              type="number"
              min="1"
              defaultValue={120}
              required
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Location
            <input
              name="location"
              placeholder="ABC Sports Hall"
              required
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Court number(s)
            <input
              name="court_numbers"
              placeholder="Court 3, Court 4"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Notes
            <textarea
              name="notes"
              placeholder="Optional details for the kaki"
              className={`${inputClass} min-h-24`}
            />
          </label>
          <button className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
            Create session
          </button>
        </form>
      </section>
    </main>
  );
}
