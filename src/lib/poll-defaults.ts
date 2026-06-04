function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Format a date + whole hour as a `datetime-local` string (Malaysia wall-clock). */
export function formatDateTimeLocal(date: Date, hour: number): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(hour)}:00`;
}

/**
 * Default poll time options for a weekend: the upcoming Saturday and Sunday,
 * each at 9–11am (09:00) and 4–6pm (16:00), as four `datetime-local` strings.
 * "Upcoming Saturday" is the first Saturday on or after `base`.
 */
export function defaultWeekendPollSlots(base: Date): string[] {
  const saturday = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const daysUntilSaturday = (6 - saturday.getDay() + 7) % 7;
  saturday.setDate(saturday.getDate() + daysUntilSaturday);

  const sunday = new Date(
    saturday.getFullYear(),
    saturday.getMonth(),
    saturday.getDate() + 1
  );

  return [
    formatDateTimeLocal(saturday, 9),
    formatDateTimeLocal(saturday, 16),
    formatDateTimeLocal(sunday, 9),
    formatDateTimeLocal(sunday, 16),
  ];
}
