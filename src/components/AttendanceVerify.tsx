"use client";

import { verifyAttendanceAction } from "@/app/actions";
import type { Participant } from "@/lib/types";

export function AttendanceVerify({
  manageToken,
  participants,
}: {
  manageToken: string;
  participants: Participant[];
}) {
  return (
    <form action={verifyAttendanceAction} className="flex flex-col gap-1">
      <input type="hidden" name="manage_token" value={manageToken} />
      {participants.map((participant) => (
        <label key={participant.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            name="attended"
            value={participant.id}
            defaultChecked={participant.attended}
          />
          {participant.name}{" "}
          <span className="text-xs text-gray-500">({participant.rsvp})</span>
        </label>
      ))}
      <button className="mt-2 rounded bg-emerald-600 p-2 text-white">
        Save attendance
      </button>
    </form>
  );
}
