"use client";

import { setCostAction } from "@/app/actions";
import type { Session } from "@/lib/types";

export function CostForm({ session }: { session: Session }) {
  return (
    <form action={setCostAction} className="flex flex-col gap-2">
      <input type="hidden" name="manage_token" value={session.manage_token} />
      <label className="text-sm">
        Court cost (RM)
        <input
          name="court_cost"
          type="number"
          step="0.01"
          min="0"
          defaultValue={session.court_cost ?? ""}
          className="w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Shuttles used
        <input
          name="shuttles_used"
          type="number"
          min="0"
          defaultValue={session.shuttles_used ?? ""}
          className="w-full rounded border p-2"
        />
      </label>
      <label className="text-sm">
        Price per shuttle (RM)
        <input
          name="price_per_shuttle"
          type="number"
          step="0.01"
          min="0"
          defaultValue={session.price_per_shuttle ?? ""}
          className="w-full rounded border p-2"
        />
      </label>
      <button className="rounded bg-emerald-600 p-2 text-white">
        Save cost
      </button>
    </form>
  );
}
