"use client";

import { useEffect, useState } from "react";
import { createSessionAction } from "@/app/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { deviceToken } from "./device-token";

type TimeOptionDraft = { id: string; available: boolean };

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
    <Card>
      <form action={createSessionAction} className="flex flex-col gap-4">
        <input type="hidden" name="device_token" value={token} />
        <Field label="Your name">
          <Input name="organizer_name" placeholder="Alex" defaultValue={displayName} required />
        </Field>
        <Field label="Session title">
          <Input name="title" placeholder="Friday Smash" required />
        </Field>
        <Field label="Location">
          <Input name="location" placeholder="ABC Sports Hall" required />
        </Field>
        <Field label="Court number(s)">
          <Input name="court_numbers" placeholder="Court 3, Court 4" />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" placeholder="Optional details for the kaki" />
        </Field>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-heading">Time options</h3>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOptions((c) => [...c, newOption()])}
              className="size-9 px-0"
              aria-label="Add time option"
              title="Add time option"
            >
              +
            </Button>
          </div>

          {options.map((option, index) => (
            <div
              key={option.id}
              className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-border p-3"
            >
              <div className="flex flex-col gap-2">
                <Field label="Date and time">
                  <Input name="option_starts_at" type="datetime-local" required />
                </Field>
                <Field label="Duration (minutes)">
                  <Input name="option_duration_min" type="number" min="1" defaultValue={120} required />
                </Field>
                <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    name="organizer_available_index"
                    type="checkbox"
                    value={index}
                    defaultChecked={option.available}
                    className="size-4 rounded border-border text-primary"
                  />
                  Available
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setOptions((c) =>
                    c.length <= 2 ? c : c.filter((i) => i.id !== option.id)
                  )
                }
                disabled={options.length <= 2}
                className="size-9 px-0 text-xl hover:text-danger"
                aria-label="Remove time option"
                title="Remove time option"
              >
                &times;
              </Button>
            </div>
          ))}
        </div>

        <Button disabled={!token}>Create poll</Button>
      </form>
    </Card>
  );
}
