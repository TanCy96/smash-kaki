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
        <div key={option.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-heading">
                {formatMalaysiaDateTime(option.starts_at)}
              </h3>
              <p className="text-sm text-muted">{option.duration_min} min</p>
            </div>
            <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-sm font-bold text-success-ink">
              {option.votes.length}
            </span>
          </div>
          {option.votes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No votes yet.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm text-ink">
              {option.votes.map((vote) => (
                <li key={vote.id} className="rounded-lg bg-black/5 px-2 py-1 dark:bg-white/5">
                  {vote.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
