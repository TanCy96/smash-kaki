import { formatMalaysiaDateTime } from "@/lib/datetime";
import type { SessionTimeOptionWithVotes } from "@/lib/types";

export function TimePollSummary({
  options,
}: {
  options: SessionTimeOptionWithVotes[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => (
        <section
          key={option.id}
          className="rounded-md border border-gray-200 bg-white p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-950">
                {formatMalaysiaDateTime(option.starts_at)}
              </h3>
              <p className="text-sm text-gray-600">
                {option.duration_min} min
              </p>
            </div>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-semibold text-emerald-800">
              {option.votes.length}
            </span>
          </div>
          {option.votes.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No votes yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm text-gray-700">
              {option.votes.map((vote) => (
                <li key={vote.id} className="rounded-md bg-gray-100 px-2 py-1">
                  {vote.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
