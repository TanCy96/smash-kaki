import { finalizeTimeOptionAction } from "@/app/actions";
import { Button } from "@/components/ui";

export function FinalizeTimeOptionForm({
  manageToken,
  timeOptionId,
}: {
  manageToken: string;
  timeOptionId: string;
}) {
  return (
    <form action={finalizeTimeOptionAction}>
      <input type="hidden" name="manage_token" value={manageToken} />
      <input type="hidden" name="time_option_id" value={timeOptionId} />
      <Button variant="secondary" className="px-3 py-1.5 text-xs">
        Finalize this time
      </Button>
    </form>
  );
}
