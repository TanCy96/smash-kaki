"use client";

import { useState } from "react";
import { addPlayersAction } from "@/app/actions";
import { Button, Input } from "@/components/ui";

export function AddPlayersForm({ manageToken }: { manageToken: string }) {
  const [names, setNames] = useState<string[]>([""]);

  return (
    <form action={addPlayersAction} className="flex flex-col gap-2">
      <input type="hidden" name="manage_token" value={manageToken} />
      {names.map((name, index) => (
        <Input
          key={index}
          name="player_name"
          placeholder="Player's name"
          value={name}
          onChange={(e) =>
            setNames((prev) =>
              prev.map((value, i) => (i === index ? e.target.value : value))
            )
          }
        />
      ))}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setNames((prev) => [...prev, ""])}
        >
          + Add another
        </Button>
        <Button>Add players</Button>
      </div>
    </form>
  );
}
