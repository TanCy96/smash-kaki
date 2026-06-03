import { finalizeTimeOptionAction } from "@/app/actions";

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
      <button className="rounded bg-emerald-600 px-3 py-2 text-sm text-white">
        Finalize
      </button>
    </form>
  );
}
