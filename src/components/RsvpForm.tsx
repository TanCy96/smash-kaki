"use client";

import { useEffect, useState } from "react";
import { rsvpAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";
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
    return <p className="text-sm text-muted">RSVP closed - session cancelled.</p>;
  }

  return (
    <form action={rsvpAction} className="flex flex-col gap-3">
      <input type="hidden" name="guest_token" value={guestToken} />
      <input type="hidden" name="device_token" value={token} />
      <Field label="Your name">
        <Input name="name" placeholder="Your name" required />
      </Field>
      <div className="flex gap-4 text-sm font-medium text-ink">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="rsvp" value="going" defaultChecked /> Going
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="rsvp" value="maybe" /> Maybe
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="rsvp" value="cant" /> Can&apos;t
        </label>
      </div>
      <Button disabled={!token}>Submit RSVP</Button>
    </form>
  );
}
