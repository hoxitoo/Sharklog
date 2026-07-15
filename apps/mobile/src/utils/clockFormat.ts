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
