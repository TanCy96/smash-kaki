"use client";

import { useEffect, useState } from "react";
import { getMyPollFriends, timePollVoteAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";
import { formatMalaysiaDateTime } from "@/lib/datetime";
import type { SessionTimeOptionWithVotes } from "@/lib/types";
import { deviceToken } from "./device-token";

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
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<string[]>([]);

  // On load, recognise a returning guest by their device token and prefill
  // their previous name, ticked availability, and brought-friend names.
  useEffect(() => {
    const current = deviceToken();
    setToken(current);

    const mine = options.filter((option) =>
      option.votes.some((vote) => vote.participant_token === current)
    );
    if (mine.length > 0) {
      setChecked(new Set(mine.map((option) => option.id)));
      const priorName = mine
        .flatMap((option) => option.votes)
        .find((vote) => vote.participant_token === current)?.name;
      if (priorName) setName(priorName);
    }

    getMyPollFriends(guestToken, current).then((names) => {
      if (names.length > 0) setFriends(names);
    });
    // Runs once on mount; options is stable for the mounted form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (disabled) {
    return <p className="text-sm text-muted">Voting closed.</p>;
  }

  return (
    <form action={timePollVoteAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <Field label="Your name">
        <Input
          name="name"
          placeholder="Alex"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm text-ink"
          >
            <input
              name="time_option_id"
              type="checkbox"
              value={option.id}
              checked={checked.has(option.id)}
              onChange={() => toggle(option.id)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold text-heading">
                {formatMalaysiaDateTime(option.starts_at)}
              </span>
              <span className="block text-muted">{option.duration_min} min</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">
          Bringing friends? (optional) They&apos;ll join for the times you tick.
        </p>
        {friends.map((friend, index) => (
          <div key={index} className="flex gap-2">
            <Input
              name="friend_name"
              placeholder="Friend's name"
              value={friend}
              onChange={(e) =>
                setFriends((prev) =>
                  prev.map((value, i) => (i === index ? e.target.value : value))
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setFriends((prev) => prev.filter((_, i) => i !== index))
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setFriends((prev) => [...prev, ""])}
        >
          + Add another
        </Button>
      </div>

      <Button disabled={!token}>Save availability</Button>
    </form>
  );
}
