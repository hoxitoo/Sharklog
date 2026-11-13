import { parseClock } from '@sharklog/core';
import type { Bet, BetStatus } from '@sharklog/core';

/*
 * When a bet's result reminder comes, and what the bet form says about it.
 * Pure — no notification module — so it is under test as it is, and the form
 * and the scheduler read the same numbers.
 */

/** Rough time-to-finish per sport, minutes from kick-off (incl. breaks + settling lag). */
const END_OFFSET_MIN: Record<string, number> = {
  football: 135,
  hockey: 165,
  basketball: 135,
  tennis: 150,
  esports: 150,
  volleyball: 120,
  baseball: 195,
  other: 150,
};

/** What the timing reads from a bet — the form passes what is typed, before it is a bet. */
export type BetTiming = Pick<Bet, 'date' | 'time' | 'sport'>;

/**
 * When the match should be over: the date and kick-off plus the sport's
 * length. A time is read as the form reads it (parseClock: "21.00" too — a
 * bet saved before the form checked the field); no time — noon; a time or
 * date that cannot be read — null.
 */
export function matchEndAt(bet: BetTiming): number | null {
  const time = bet.time ? parseClock(bet.time) : '12:00';
  if (time === null) return null;
  // Parse as LOCAL time — a bare "YYYY-MM-DD" string would be read as UTC.
  const start = new Date(`${bet.date}T${time}:00`).getTime();
  if (isNaN(start)) return null;
  return start + (END_OFFSET_MIN[bet.sport] ?? END_OFFSET_MIN['other']!) * 60_000;
}

/**
 * When this bet's result reminder should fire — or null when that moment is
 * already past (or under a minute away, too close to schedule reliably).
 *
 * Shared by scheduling AND by the sync's cap, which used to count bets whose
 * reminder could no longer be scheduled: a backlog of old unsettled bets took
 * the 50 slots, and future matches got no reminder at all.
 */
export function reminderFireAt(bet: BetTiming, now = Date.now()): number | null {
  const at = matchEndAt(bet);
  return at !== null && at > now + 60_000 ? at : null;
}

/** The line under the bet form's kick-off: when the reminder comes, that it cannot, or nothing. */
export type ReminderHint = { kind: 'at'; at: number } | { kind: 'off' } | null;

/**
 * What the form says under «Начало матча»: "I'll remind you at about 21:15"
 * from the same reminderFireAt the reminder is scheduled with — only when one
 * can come (`canCome`: permission granted, or to be asked for right after this
 * save; null while still asking). "Notifications are off" only when a reminder
 * WOULD be due — not for a bet logged after its match, nor for an unreadable
 * time (the field shows its error). Nothing for a settled bet or with result
 * reminders switched off.
 */
export function reminderHint(
  form: BetTiming & { status: BetStatus; remindersOn: boolean; canCome: boolean | null; defaultTime: string },
  now = Date.now(),
): ReminderHint {
  if (form.status !== 'pending' || !form.remindersOn || form.canCome === null) return null;
  const typed = form.time.trim();
  const time = typed ? parseClock(typed) : form.defaultTime;
  if (time === null) return null;
  const at = reminderFireAt({ date: form.date, time, sport: form.sport }, now);
  if (at === null) return null;
  return form.canCome ? { kind: 'at', at } : { kind: 'off' };
}
