"use client";

import { verifyAttendanceAction } from "@/app/actions";
import { Button } from "@/components/ui";
import type { Participant } from "@/lib/types";

export function AttendanceVerify({
  manageToken,
  participants,
}: {
  manageToken: string;
  participants: Participant[];
}) {
  return (
    <form action={verifyAttendanceAction} className="flex flex-col gap-2">
      <input type="hidden" name="manage_token" value={manageToken} />
      {participants.map((participant) => (
        <label key={participant.id} className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="attended"
            value={participant.id}
            defaultChecked={participant.attended}
            className="size-4 rounded border-border text-primary"
          />
          {participant.name}{" "}
          <span className="text-xs text-muted">({participant.rsvp})</span>
        </label>
      ))}
      <Button className="mt-2">Save attendance</Button>
    </form>
  );
}
