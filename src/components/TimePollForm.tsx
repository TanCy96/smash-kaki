"use client";

import { useEffect, useState } from "react";
import { timePollVoteAction } from "@/app/actions";
import type { SessionTimeOptionWithVotes } from "@/lib/types";
import { deviceToken } from "./device-token";

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function TimePollForm({
  guestToken,
  options,
  disabled,
}: {
  guestToken: string;
  options: SessionTimeOptionWithVotes[];
  disabled: boolean;
}) {
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  if (disabled) {
    return <p className="text-sm text-gray-500">Voting closed.</p>;
  }

  return (
    <form action={timePollVoteAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        Your name
        <input name="name" placeholder="Alex" required className={inputClass} />
      </label>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-800"
          >
            <input
              name="time_option_id"
              type="checkbox"
              value={option.id}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-gray-950">
                {new Date(option.starts_at).toLocaleString()}
              </span>
              <span className="block text-gray-600">
                {option.duration_min} min
              </span>
            </span>
          </label>
        ))}
      </div>
      <button
        disabled={!token}
        className="rounded-md bg-emerald-600 p-2 font-semibold text-white disabled:opacity-50"
      >
        Save availability
      </button>
    </form>
  );
}
