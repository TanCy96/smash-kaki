"use client";

import { useEffect, useState } from "react";
import { rsvpAction } from "@/app/actions";
import { deviceToken } from "./device-token";

export function RsvpForm({
  guestToken,
  disabled,
}: {
  guestToken: string;
  disabled: boolean;
}) {
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(deviceToken());
  }, []);

  if (disabled) {
    return (
      <p className="text-sm text-gray-500">
        RSVP closed - session cancelled.
      </p>
    );
  }

  return (
    <form action={rsvpAction} className="flex flex-col gap-2">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <input
        name="name"
        placeholder="Your name"
        required
        className="rounded border p-2"
      />
      <div className="flex gap-2">
        <label>
          <input type="radio" name="rsvp" value="going" defaultChecked /> Going
        </label>
        <label>
          <input type="radio" name="rsvp" value="maybe" /> Maybe
        </label>
        <label>
          <input type="radio" name="rsvp" value="cant" /> Can&apos;t
        </label>
      </div>
      <button className="rounded bg-emerald-600 p-2 text-white">
        Submit RSVP
      </button>
    </form>
  );
}
