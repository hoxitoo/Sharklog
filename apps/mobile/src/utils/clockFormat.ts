/** True when the device locale formats time in 12-hour (AM/PM) style. */
export function uses12HourClock(): boolean {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
      .formatToParts(new Date(2020, 0, 1, 13, 0, 0));
    return parts.some((p) => p.type === 'dayPeriod');
  } catch {
    return false; // default to 24-hour on older engines
  }
}

/** A moment's local clock, "HH:MM" — the one way the app writes a time of day (a bet's kick-off, a reminder). */
export const clockOf = (d: Date): string => d.toTimeString().slice(0, 5);
