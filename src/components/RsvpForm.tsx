"use client";

import { useEffect, useState } from "react";
import { getMyRsvp, rsvpAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";
import type { Rsvp } from "@/lib/types";
import { deviceToken } from "./device-token";

export function RsvpForm({
  guestToken,
  disabled,
  displayName = "",
}: {
  guestToken: string;
  disabled: boolean;
  displayName?: string;
}) {
  const [token, setToken] = useState("");
  const [name, setName] = useState(displayName);
  const [rsvp, setRsvp] = useState<Rsvp>("going");
  const [friends, setFriends] = useState<string[]>([]);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    const current = deviceToken();
    setToken(current);
    getMyRsvp(guestToken, current).then((mine) => {
      if (!mine) return;
      // A prior RSVP name takes priority over the signed-in account name, but
      // don't clobber it when the caller only brought friends (mine.name = "").
      if (mine.name) setName(mine.name);
      setRsvp(mine.rsvp);
      setFriends(mine.friends);
      setHasExisting(true);
    });
  }, [guestToken]);

  if (disabled) {
    return <p className="text-sm text-muted">RSVP closed - session cancelled.</p>;
  }

  return (
    <form action={rsvpAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <Field label="Your name">
        <Input
          name="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </Field>
      <div className="flex gap-4 text-sm font-medium text-ink">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="rsvp"
            value="going"
            checked={rsvp === "going"}
            onChange={() => setRsvp("going")}
          />{" "}
          Going
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="rsvp"
            value="maybe"
            checked={rsvp === "maybe"}
            onChange={() => setRsvp("maybe")}
          />{" "}
          Maybe
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name="rsvp"
            value="cant"
            checked={rsvp === "cant"}
            onChange={() => setRsvp("cant")}
          />{" "}
          Can&apos;t
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">Bringing friends? (optional)</p>
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

      <Button disabled={!token}>{hasExisting ? "Update RSVP" : "Submit RSVP"}</Button>
    </form>
  );
}
