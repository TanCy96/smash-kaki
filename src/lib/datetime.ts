export function formatMalaysiaDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kuala_Lumpur",
    hour12: true,
  }).format(new Date(value));
}
