"use client";

import { useEffect, useState } from "react";
import { createSessionAction } from "@/app/actions";
import { deviceToken } from "./device-token";

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-gray-700";

type TimeOptionDraft = {
  id: string;
  available: boolean;
};

function newOption(id = crypto.randomUUID()): TimeOptionDraft {
  return { id, available: true };
}

export function CreateSessionForm({ displayName }: { displayName: string }) {
  const [token, setToken] = useState("");
  const [options, setOptions] = useState<TimeOptionDraft[]>([
    newOption("option-1"),
    newOption("option-2"),
  ]);

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  return (
    <form
      action={createSessionAction}
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="device_token" value={token} />
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

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-950">Time options</h2>
          <button
            type="button"
            onClick={() => setOptions((current) => [...current, newOption()])}
            className="inline-flex size-9 items-center justify-center rounded-md border border-gray-300 text-lg leading-none text-gray-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-700"
            aria-label="Add time option"
            title="Add time option"
          >
            +
          </button>
        </div>

        {options.map((option, index) => (
          <div
            key={option.id}
            className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-gray-200 p-3"
          >
            <div className="flex flex-col gap-2">
              <label className={labelClass}>
                Date and time
                <input
                  name="option_starts_at"
                  type="datetime-local"
                  required
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Duration (minutes)
                <input
                  name="option_duration_min"
                  type="number"
                  min="1"
                  defaultValue={120}
                  required
                  className={inputClass}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  name="organizer_available_index"
                  type="checkbox"
                  value={index}
                  defaultChecked={option.available}
                  className="size-4 rounded border-gray-300 text-emerald-600"
                />
                Available
              </label>
            </div>
            <button
              type="button"
              onClick={() =>
                setOptions((current) =>
                  current.length <= 2
                    ? current
                    : current.filter((item) => item.id !== option.id)
                )
              }
              disabled={options.length <= 2}
              className="inline-flex size-9 items-center justify-center rounded-md border border-gray-300 text-xl leading-none text-gray-700 shadow-sm transition hover:border-red-400 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Remove time option"
              title="Remove time option"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <button
        disabled={!token}
        className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Create poll
      </button>
    </form>
  );
}
