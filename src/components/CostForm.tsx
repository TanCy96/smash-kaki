"use client";

import { setCostAction } from "@/app/actions";
import { Button, Field, Input } from "@/components/ui";
import type { Session } from "@/lib/types";

export function CostForm({ session }: { session: Session }) {
  return (
    <form action={setCostAction} className="flex flex-col gap-3">
      <input type="hidden" name="manage_token" value={session.manage_token} />
      <Field label="Court cost (RM)">
        <Input name="court_cost" type="number" step="0.01" min="0" defaultValue={session.court_cost ?? ""} />
      </Field>
      <Field label="Shuttles used">
        <Input name="shuttles_used" type="number" min="0" defaultValue={session.shuttles_used ?? ""} />
      </Field>
      <Field label="Price per shuttle (RM)">
        <Input name="price_per_shuttle" type="number" step="0.01" min="0" defaultValue={session.price_per_shuttle ?? ""} />
      </Field>
      <Button>Save cost</Button>
    </form>
  );
}
