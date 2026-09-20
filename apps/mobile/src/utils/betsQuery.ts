import type { Bet } from '@sharklog/core';
import { betBacksTeam, parseEventTeams } from '@sharklog/core';

/**
 * The advanced bet filter — everything the status and sort pickers do not cover.
 *
 * Fields are kept as the raw strings the user typed, not as parsed numbers and
 * dates: the filter screen has to render exactly what was entered when it
 * reopens, and a half-typed "1." must survive a keystroke without collapsing
 * to 1. Parsing happens once, here, at the moment the filter is applied.
 */
export interface BetsQuery {
  tournament: string;
  team: string;
  oddsFrom: string;
  oddsTo: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_BETS_QUERY: BetsQuery = {
  tournament: '', team: '', oddsFrom: '', oddsTo: '', dateFrom: '', dateTo: '',
};

/** How many criteria are set — the badge on the filter button. */
export function countBetsQuery(q: BetsQuery): number {
  return (Object.keys(EMPTY_BETS_QUERY) as Array<keyof BetsQuery>)
    .filter((k) => q[k].trim() !== '').length;
}

/** A comma is what the Russian numeric keyboard offers for a decimal point. */
function num(raw: string): number | null {
  const v = parseFloat(raw.trim().replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

/** `YYYY-MM-DD` only. A half-typed date must not start hiding bets. */
function ymd(raw: string): string {
  const v = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
}

export function applyBetsQuery(bets: Bet[], q: BetsQuery): Bet[] {
  const tournament = q.tournament.trim().toLowerCase();
  const team = q.team.trim();

  // Bounds entered the wrong way round are a slip, not a request for an empty
  // list: "от 3 до 1" plainly means the range between 1 and 3.
  let lo = num(q.oddsFrom);
  let hi = num(q.oddsTo);
  if (lo != null && hi != null && lo > hi) [lo, hi] = [hi, lo];

  let from = ymd(q.dateFrom);
  let to = ymd(q.dateTo);
  if (from && to && from > to) [from, to] = [to, from];

  if (!tournament && !team && lo == null && hi == null && !from && !to) return bets;

  return bets.filter((b) => {
    // Substring, because the tournament is typed from memory and the stored
    // name carries a season: "StarLadder" has to find "StarLadder StarSeries
    // Fall 26", which was the whole bug.
    if (tournament && !(b.tournament ?? '').toLowerCase().includes(tournament)) return false;
    if (team && !betBacksTeam(b, team, { partial: true })) return false;
    if (lo != null && b.odds < lo) return false;
    if (hi != null && b.odds > hi) return false;
    // Dates are `YYYY-MM-DD`, so a string compare IS a date compare — and
    // unlike `new Date(...)` it cannot drift a day across a timezone.
    if (from && b.date < from) return false;
    if (to && b.date > to) return false;
    return true;
  });
}

/**
 * Every tournament and every team the user has actually entered, for the
 * search suggestions and the filter screen's chips.
 *
 * Suggesting from real data rather than a fixed list is the point: the reason
 * a search for a tournament came back empty is that nothing ever told the user
 * what the stored name looks like.
 */
export function betsVocabulary(bets: Bet[]): { tournaments: string[]; teams: string[] } {
  const tournaments = new Map<string, string>();
  const teams = new Map<string, string>();
  for (const b of bets) {
    const t = (b.tournament ?? '').trim();
    // Keyed on the lowercase form so one casing wins instead of both showing.
    if (t) tournaments.set(t.toLowerCase(), t);
    for (const name of parseEventTeams(b.event)) {
      const n = name.trim();
      if (n) teams.set(n.toLowerCase(), n);
    }
  }
  const byName = (a: string, b: string) => a.localeCompare(b);
  return {
    tournaments: [...tournaments.values()].sort(byName),
    teams: [...teams.values()].sort(byName),
  };
}

/** Case-insensitive `includes`, best (shortest) matches first, capped. */
export function suggest(pool: string[], input: string, limit: number): string[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  return pool
    .filter((v) => {
      const lower = v.toLowerCase();
      // An exact hit is not a suggestion — the user has already typed it.
      return lower !== q && lower.includes(q);
    })
    .sort((a, b) => a.length - b.length)
    .slice(0, limit);
}

/** `2026-09-01` → `01.09`, the same short form the date chip already uses. */
function short(ymdStr: string): string {
  const [y, m, d] = ymdStr.split('-');
  return y && m && d ? `${d}.${m}` : ymdStr;
}

/**
 * One line naming what is filtered, for the chip above the list.
 *
 * A filter set on another screen and then forgotten is what turns a short list
 * into "my bets disappeared" — the count badge says how many criteria are on,
 * this says which, and the chip clears them.
 *
 * Symbols rather than words (`× ≥1.5`, `01.09 →`): the values are the point,
 * and a chip on one line has no room to spend on prose.
 */
export function describeBetsQuery(q: BetsQuery): string | null {
  const parts: string[] = [];
  if (q.tournament.trim()) parts.push(q.tournament.trim());
  if (q.team.trim()) parts.push(q.team.trim());

  const from = q.oddsFrom.trim();
  const to = q.oddsTo.trim();
  if (from && to) parts.push(`× ${from}–${to}`);
  else if (from) parts.push(`× ≥${from}`);
  else if (to) parts.push(`× ≤${to}`);

  // Only complete dates are filtered on, so only complete dates are named —
  // a chip reading "2026-0 →" would describe a filter that is not applied.
  const dFrom = ymd(q.dateFrom);
  const dTo = ymd(q.dateTo);
  if (dFrom && dTo) parts.push(`${short(dFrom)}–${short(dTo)}`);
  else if (dFrom) parts.push(`${short(dFrom)} →`);
  else if (dTo) parts.push(`→ ${short(dTo)}`);

  return parts.length > 0 ? parts.join(' · ') : null;
}
