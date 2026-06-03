import { createSessionAction } from "./actions";

export default function CreatePage() {
  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-2xl font-bold">SmashKaki</h1>
      <p className="mb-4 text-sm text-gray-600">
        Set up a badminton session and share the link.
      </p>
      <form action={createSessionAction} className="flex flex-col gap-3">
        <input
          name="title"
          placeholder="Session title (e.g. Friday Smash)"
          required
          className="rounded border p-2"
        />
        <label className="text-sm">
          Date & time
          <input
            name="starts_at"
            type="datetime-local"
            required
            className="w-full rounded border p-2"
          />
        </label>
        <label className="text-sm">
          Duration (minutes)
          <input
            name="duration_min"
            type="number"
            min="1"
            defaultValue={120}
            required
            className="w-full rounded border p-2"
          />
        </label>
        <input
          name="location"
          placeholder="Location (e.g. ABC Sports Hall)"
          required
          className="rounded border p-2"
        />
        <input
          name="court_numbers"
          placeholder="Court number(s) - editable later"
          className="rounded border p-2"
        />
        <textarea
          name="notes"
          placeholder="Notes (optional)"
          className="rounded border p-2"
        />
        <button className="rounded bg-emerald-600 p-2 font-semibold text-white">
          Create session
        </button>
      </form>
    </main>
  );
}
