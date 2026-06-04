"use client";

import { useEffect, useState } from "react";
import { timePollVoteAction } from "@/app/actions";
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

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  if (disabled) {
    return <p className="text-sm text-muted">Voting closed.</p>;
  }

  return (
    <form action={timePollVoteAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <Field label="Your name">
        <Input name="name" placeholder="Alex" required />
      </Field>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm text-ink"
          >
            <input name="time_option_id" type="checkbox" value={option.id} className="mt-1" />
            <span>
              <span className="block font-semibold text-heading">
                {formatMalaysiaDateTime(option.starts_at)}
              </span>
              <span className="block text-muted">{option.duration_min} min</span>
            </span>
          </label>
        ))}
      </div>
      <Button disabled={!token}>Save availability</Button>
    </form>
  );
}
