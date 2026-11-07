import type { Bet, BankrollTransaction, EsportsDiscipline } from '../types/bet';
import { ODDS_RANGES } from '../constants/index';

/**
 * Chronological order of bets: by when the match was played (date + time), and
 * by when the row was typed in only between bets of the same minute. A bet
 * entered after the fact sorted by `createdAt` lands at the end — out of step
 * with the bets list — and a run of wins or a drawdown counted that way is not
 * the run the user sees in the list.
 */
export function byPlayedAt(a: Bet, b: Bet): number {
  const ka = playedKeys(a);
  const kb = playedKeys(b);
  return compareKey(ka.played, kb.played, ka.playedPlain && kb.playedPlain)
    || compareKey(a.createdAt, b.createdAt, ka.createdPlain && kb.createdPlain);
}

/*
 * Why the keys are cached and compared as plain strings. The comparator used to
 * build two strings and call `localeCompare` on every comparison — tens of
 * thousands per tap on a book of 1 000 bets, each `localeCompare` a call into
 * ICU (on Android, through JNI). For keys of one fixed shape —
 * `YYYY-MM-DDTHH:MM`, or an ISO timestamp with milliseconds — every position
 * holds the same kind of character in both strings, so they differ only at
 * digits, and plain `<` orders them exactly as `localeCompare` does. Anything
 * else (a date an old CSV import kept as typed) still goes through
 * `localeCompare`, so no order changes.
 */
const PLAYED_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const CREATED_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface PlayedKeys {
  date: string; time: string; createdAt: string;
  played: string; playedPlain: boolean; createdPlain: boolean;
}
const keysOf = new WeakMap<Bet, PlayedKeys>();

function playedKeys(b: Bet): PlayedKeys {
  const k = keysOf.get(b);
  // Checked against the bet: the comparator stays right even for a bet edited
  // in place. `playedOrder`'s cache does NOT check — it relies on what both
  // stores do: arrays and bets are replaced, never edited in place.
  if (k && k.date === b.date && k.time === b.time && k.createdAt === b.createdAt) return k;
  const played = `${b.date}T${b.time}`;
  const fresh = {
    date: b.date, time: b.time, createdAt: b.createdAt,
    played, playedPlain: PLAYED_SHAPE.test(played), createdPlain: CREATED_SHAPE.test(b.createdAt),
  };
  keysOf.set(b, fresh);
  return fresh;
}

function compareKey(a: string, b: string, plain: boolean): number {
  if (plain) return a < b ? -1 : a > b ? 1 : 0;
  return a.localeCompare(b);
}

const orderOf = new WeakMap<readonly Bet[], Bet[]>();

/**
 * The bets in `byPlayedAt` order — a sorted copy, cached for this array: the
 * screens of one write ask several times (dashboard, streaks, drawdown, tilt),
 * and the store's array changes only when a bet does — a new array, with new
 * objects for the bets that changed; an array or a bet edited IN PLACE would
 * keep its old order here. Filter the result, do not
 * sort a filtered copy: order (ties included) is the same, the sort runs once.
 * The returned array is shared — never mutate it.
 */
export function playedOrder(bets: readonly Bet[]): readonly Bet[] {
  let sorted = orderOf.get(bets);
  if (!sorted) {
    // Keys looked up once per bet, not twice per comparison: the sort then
    // reads plain fields (on Hermes, without a JIT, the lookups were the cost).
    const keyed = bets.map((b) => ({ b, k: playedKeys(b) }));
    keyed.sort((x, y) =>
      compareKey(x.k.played, y.k.played, x.k.playedPlain && y.k.playedPlain)
      || compareKey(x.k.createdAt, y.k.createdAt, x.k.createdPlain && y.k.createdPlain));
    sorted = keyed.map((e) => e.b);
    orderOf.set(bets, sorted);
  }
  return sorted;
}

/**
 * The newest first, as `.sort((a, b) => byPlayedAt(b, a))` gives it: tied
 * bets (the same minute and the same `createdAt` — a CSV import writes many)
 * keep the order they came in, rather than coming out reversed.
 */
export function newestPlayedFirst(sortedAsc: readonly Bet[]): Bet[] {
  const out: Bet[] = [];
  let end = sortedAsc.length;
  while (end > 0) {
    let start = end - 1;
    while (start > 0 && byPlayedAt(sortedAsc[start - 1]!, sortedAsc[end - 1]!) === 0) start--;
    for (let i = start; i < end; i++) out.push(sortedAsc[i]!);
    end = start;
  }
  return out;
}

export interface SliceStats {
  label: string;
  count: number;
  won: number;
  lost: number;
  refund: number;
  cashout: number;
  pending: number;
  pnl: number;        // in kopecks
  roi: number;        // percentage, e.g. 12.5
  winRate: number;    // percentage
  totalStaked: number;
}

export interface DashboardStats {
  pnl: number;
  roi: number;
  winRate: number;
  totalBets: number;
  wonBets: number;
  lostBets: number;
  pendingCount: number;
  totalStaked: number;    // kopecks, settled bets only
  avgOdds: number;        // average decimal odds across settled bets
  currentStreak: { type: 'win' | 'loss' | 'none'; count: number };
  pnlCurve: Array<{ index: number; pnl: number }>;
}

/** Realized P&L for a single bet, in kopecks. 0 for pending/refund and lost freebets. */
export function betPnl(bet: Bet): number {
  if (bet.status === 'won') return Math.round(bet.stake * bet.odds) - bet.stake;
  if (bet.status === 'lost') return bet.isFreebet ? 0 : -bet.stake;
  if (bet.status === 'cashout' && bet.cashoutAmount != null) return bet.cashoutAmount - bet.stake;
  return 0;
}

function calcSlice(bets: Bet[], label: string): SliceStats {
  const settled = bets.filter((b) => b.status === 'won' || b.status === 'lost');
  const won = bets.filter((b) => b.status === 'won').length;
  const lost = bets.filter((b) => b.status === 'lost').length;
  const refund = bets.filter((b) => b.status === 'refund').length;
  const cashout = bets.filter((b) => b.status === 'cashout').length;
  const pending = bets.filter((b) => b.status === 'pending').length;

  // Freebet stakes are excluded from totalStaked — not the player's own capital
  const totalStaked = bets
    .filter((b) => b.status !== 'pending' && !b.isFreebet)
    .reduce((sum, b) => sum + b.stake, 0);
  const pnl = bets.reduce((sum, b) => {
    if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
    if (b.status === 'lost') return b.isFreebet ? sum : sum - b.stake;
    if (b.status === 'cashout' && b.cashoutAmount != null) return sum + b.cashoutAmount - b.stake;
    return sum;
  }, 0);

  const roi = totalStaked > 0 ? (pnl / totalStaked) * 100 : 0;
  const winRate = settled.length > 0 ? (won / settled.length) * 100 : 0;

  return {
    label,
    count: bets.length,
    won,
    lost,
    refund,
    cashout,
    pending,
    pnl,
    roi: Math.round(roi * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    totalStaked,
  };
}

export function calcDashboard(bets: Bet[]): DashboardStats {
  const stats = calcSlice(bets, 'all');
  // Ordered by when the match happened, not when the row was typed in: a bet
  // entered after the fact would otherwise land at the end of the curve and
  // put it out of step with the bets list, the dashboard and the bank curve.
  const settled = playedOrder(bets)
    .filter((b) => b.status === 'won' || b.status === 'lost' || (b.status === 'cashout' && b.cashoutAmount != null));

  const pendingCount = bets.filter((b) => b.status === 'pending').length;
  const totalStaked = stats.totalStaked;
  const wonLost = settled.filter((b) => b.status === 'won' || b.status === 'lost');
  const avgOdds = wonLost.length > 0
    ? Math.round((wonLost.reduce((sum, b) => sum + b.odds, 0) / wonLost.length) * 100) / 100
    : 0;

  let running = 0;
  const pnlCurve = settled.map((b, i) => {
    if (b.status === 'won') running += Math.round(b.stake * b.odds) - b.stake;
    else if (b.status === 'cashout' && b.cashoutAmount != null) running += b.cashoutAmount - b.stake;
    else if (!b.isFreebet) running -= b.stake;
    return { index: i + 1, pnl: running };
  });

  const streak = calcStreak(bets);

  return {
    pnl: stats.pnl,
    roi: stats.roi,
    winRate: stats.winRate,
    totalBets: stats.count,
    wonBets: stats.won,
    lostBets: stats.lost,
    pendingCount,
    totalStaked,
    avgOdds,
    currentStreak: streak,
    pnlCurve,
  };
}

function calcStreak(bets: Bet[]): DashboardStats['currentStreak'] {
  // Latest MATCH first, as `calcStreaks` counts: by `createdAt`, three old
  // losses typed in after today's win read as a fresh tilt here while
  // Analytics showed the win as the current run.
  const settled = newestPlayedFirst(playedOrder(bets).filter((b) => b.status === 'won' || b.status === 'lost'));

  if (settled.length === 0) return { type: 'none', count: 0 };

  const first = settled[0];
  if (!first) return { type: 'none', count: 0 };

  const streakType = first.status === 'won' ? 'win' : 'loss';
  let count = 0;

  for (const bet of settled) {
    if (bet.status === (streakType === 'win' ? 'won' : 'lost')) count++;
    else break;
  }

  return { type: streakType, count };
}

export function calcByField<K extends keyof Bet>(
  bets: Bet[],
  field: K,
  labelMap?: (value: Bet[K]) => string,
): SliceStats[] {
  const groups = new Map<string, Bet[]>();

  for (const bet of bets) {
    const key = String(bet[field]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bet);
  }

  return Array.from(groups.entries())
    .map(([key, groupBets]) => {
      const label = labelMap ? labelMap(key as Bet[K]) : key;
      return calcSlice(groupBets, label);
    })
    .sort((a, b) => b.pnl - a.pnl);
}

/**
 * `label(min, max)` names a bucket (`min` 1 = "below max", `max` Infinity =
 * "above min"). The default is decimal, as stored; a screen showing American
 * or fractional odds passes its own — the buckets stay decimal either way.
 */
export function calcByOddsRange(bets: Bet[], label?: (min: number, max: number) => string): SliceStats[] {
  return ODDS_RANGES.map((range) => {
    const group = bets.filter((b) => b.odds >= range.min && b.odds < range.max);
    return calcSlice(group, label ? label(range.min, range.max) : range.label);
  });
}

const DAY_NAMES_RU = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

/**
 * `dayName(dow)` names a weekday (0 = Sunday, as `Date.getDay`). The default
 * is Russian so the desktop is unchanged; a translated screen passes its own —
 * otherwise "По дню недели" printed Russian days in every language, and no
 * check on the screen could see it, since the Russian was produced here.
 */
export function calcByDayOfWeek(bets: Bet[], dayName: (dow: number) => string = (d) => DAY_NAMES_RU[d] ?? ''): SliceStats[] {
  const groups: Bet[][] = Array.from({ length: 7 }, () => []);

  for (const bet of bets) {
    // Parse as LOCAL midnight ("...T00:00:00"); bare "YYYY-MM-DD" parses as UTC,
    // which shifts the weekday for users west of UTC (off-by-one bucketing).
    const dow = new Date(`${bet.date}T00:00:00`).getDay();
    if (dow >= 0 && dow <= 6) groups[dow]?.push(bet);
  }

  return groups.map((group, i) => calcSlice(group, dayName(i)));
}

export function calcByHour(bets: Bet[]): SliceStats[] {
  const groups = new Map<number, Bet[]>();

  for (const bet of bets) {
    // `?? '0'` only guards undefined; an empty/malformed time yields NaN. Clamp it.
    const parsed = parseInt((bet.time ?? '').split(':')[0] || '0', 10);
    const hour = Number.isFinite(parsed) ? parsed : 0;
    if (!groups.has(hour)) groups.set(hour, []);
    groups.get(hour)!.push(bet);
  }

  return Array.from(groups.entries())
    .map(([hour, group]) => calcSlice(group, `${hour}:00`))
    .sort((a, b) => parseInt(a.label) - parseInt(b.label));
}

export function isInTilt(bets: Bet[], threshold: number): boolean {
  const streak = calcStreak(bets);
  return streak.type === 'loss' && streak.count >= threshold;
}

/**
 * The current run of wins or losses — `calcDashboard(bets).currentStreak`
 * without the rest of the dashboard: the tilt check after a "lost" tap and the
 * discipline screen need this one field, and the whole dashboard is two more
 * passes and a curve.
 */
export function calcCurrentStreak(bets: Bet[]): DashboardStats['currentStreak'] {
  return calcStreak(bets);
}

/** Realized P&L of all the bets, in kopecks — `calcDashboard(bets).pnl`, without the rest. */
export function totalPnl(bets: readonly Bet[]): number {
  let sum = 0;
  for (const b of bets) sum += betPnl(b);
  return sum;
}

export interface TournamentStats {
  tournament: string;
  sport: string;        // most common sport label in this group
  /** Most common esports discipline in the group, when the sport is esports. */
  discipline?: EsportsDiscipline;
  count: number;
  won: number;
  lost: number;
  pending: number;
  pnl: number;          // kopecks
  roi: number;          // %
  winRate: number;      // %
  totalStaked: number;  // kopecks
}

/** The value that appears most often in a group — its dominant sport or discipline. */
function dominant<T extends string>(values: Array<T | undefined>): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Stats per tournament, ranked by P&L.
 *
 * `includeUntagged` adds the bets that carry no tournament as one group keyed
 * by the empty string. A year breakdown has to account for every bet, and
 * silently dropping the untagged ones would make the parts stop summing to the
 * whole; callers that only want named tournaments leave it off.
 */
/** Dominant discipline among the group's esports bets only — see callers. */
function dominantDiscipline(group: Bet[]): EsportsDiscipline | undefined {
  return dominant(group.filter((b) => b.sport === 'esports').map((b) => b.discipline));
}

export function calcByTournament(
  bets: Bet[],
  opts: { includeUntagged?: boolean } = {},
): TournamentStats[] {
  const groups = new Map<string, Bet[]>();
  for (const bet of bets) {
    const key = (bet.tournament ?? '').trim();
    if (!key && !opts.includeUntagged) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bet);
  }

  return Array.from(groups.entries()).map(([tournament, group]) => {
    const slice = calcSlice(group, tournament);

    const sport = dominant(group.map((b) => b.sport)) ?? '';
    // "Киберспорт" alone says almost nothing — CS2 and Dota are different games
    // with different edges. Only the esports bets get a say: a bet moved off
    // esports keeps its old discipline (updateBet merges, the form omits the
    // key), so counting every bet would let a football row name the game.
    const discipline = sport === 'esports' ? dominantDiscipline(group) : undefined;

    return {
      tournament,
      sport,
      ...(discipline ? { discipline } : {}),
      count: slice.count,
      won: slice.won,
      lost: slice.lost,
      pending: slice.pending,
      pnl: slice.pnl,
      roi: slice.roi,
      winRate: slice.winRate,
      totalStaked: slice.totalStaked,
    };
  }).sort((a, b) => b.pnl - a.pnl);
}

export interface TeamStats {
  name: string;
  sport: string;
  /** Most common esports discipline in the group, when the sport is esports. */
  discipline?: EsportsDiscipline;
  count: number;
  won: number;
  lost: number;
  pnl: number;          // kopecks
  roi: number;          // %
  winRate: number;      // %
  lastTournament: string;
}

// Shared: extract team names from a single event leg (no pick filtering)
function extractLegTeams(leg: string): string[] {
  const cleaned = (leg.split('|')[0] ?? leg).trim();
  const parts = cleaned.split(/\s+(?:—|–|vs\.?|против|-)\s+/i);
  return parts.map((p) => p.trim()).filter((t) => t.length >= 2 && t.length <= 50);
}

export function parseEventTeams(event: string): string[] {
  return event.split(' / ').flatMap((leg) => extractLegTeams(leg));
}

// Returns only the teams the bettor actually backed, respecting П1/П2/Ф1/Ф2 notation
// and direct team name picks. Skips Ничья/X and non-1x2 markets.
function getPickedTeams(event: string, pick: string): string[] {
  const result: string[] = [];
  const eventLegs = event.split(' / ');
  const pickLegs = pick.split(' / ');

  for (let i = 0; i < eventLegs.length; i++) {
    const leg = (eventLegs[i] ?? '').trim();
    const legPick = (pickLegs[i] ?? pickLegs[0] ?? '').trim();

    const legTeams = extractLegTeams(leg);
    const team1 = legTeams[0] ?? '';
    const team2 = legTeams[1] ?? '';

    const pickUp = legPick.toUpperCase();

    if (pickUp.startsWith('П1') || pickUp.startsWith('Ф1')) {
      if (team1.length >= 2) result.push(team1);
    } else if (pickUp.startsWith('П2') || pickUp.startsWith('Ф2')) {
      if (team2.length >= 2) result.push(team2);
    } else if (team1.length >= 2 && legPick.toLowerCase() === team1.toLowerCase()) {
      result.push(team1);
    } else if (team2.length >= 2 && legPick.toLowerCase() === team2.toLowerCase()) {
      result.push(team2);
    }
    // Ничья / X / totals / exact score → no team attribution
  }
  return result;
}

/**
 * Did this bet back that team? Same rule calcByTeam counts by, so a list
 * filtered to a team holds exactly the bets its tile counted.
 *
 * `partial` loosens the comparison to a substring, for a field the user types
 * into rather than a tile they tapped: "Ак" should find "Ак Барс". It stays
 * opt-in because the exact form is what keeps a filtered list's length equal
 * to the number printed on the insights tile that opened it.
 */
export function betBacksTeam(bet: Bet, team: string, opts?: { partial?: boolean }): boolean {
  const needle = team.trim().toLowerCase();
  if (!needle) return false;
  const picked = getPickedTeams(bet.event, bet.pick);
  return opts?.partial
    ? picked.some((t) => t.toLowerCase().includes(needle))
    : picked.some((t) => t.toLowerCase() === needle);
}

export function calcByTeam(bets: Bet[], minBets = 10): TeamStats[] {
  const teamData = new Map<string, { bets: Bet[]; name: string }>();

  for (const bet of bets) {
    // Deduplicate per bet: same-team express (e.g. Team A in two legs) must not count twice
    const seenTeamsThisBet = new Set<string>();
    for (const team of getPickedTeams(bet.event, bet.pick)) {
      const key = team.toLowerCase();
      if (seenTeamsThisBet.has(key)) continue;
      seenTeamsThisBet.add(key);
      if (!teamData.has(key)) teamData.set(key, { bets: [], name: team });
      teamData.get(key)!.bets.push(bet);
    }
  }

  const result: TeamStats[] = [];

  for (const [, { bets: group, name }] of teamData.entries()) {
    if (group.length < minBets) continue;

    const slice = calcSlice(group, '');
    const sport = dominant(group.map((b) => b.sport)) ?? '';
    const discipline = sport === 'esports' ? dominantDiscipline(group) : undefined;

    const sorted = [...group].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const lastTournament = sorted.find((b) => b.tournament?.trim())?.tournament ?? '';

    result.push({
      name,
      sport,
      ...(discipline ? { discipline } : {}),
      count: slice.count,
      won: slice.won,
      lost: slice.lost,
      pnl: slice.pnl,
      roi: slice.roi,
      winRate: slice.winRate,
      lastTournament,
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

// ── Bankroll ─────────────────────────────────────────────────────────────────

/**
 * Cash movements only: deposits in, withdrawals out, adjustments as signed.
 * Every screen used to inline this reduce, which is how a third transaction
 * type would have silently gone missing from half of them.
 */
export function bankCash(transactions: BankrollTransaction[]): number {
  return transactions.reduce((sum, tx) => {
    if (tx.type === 'deposit') return sum + tx.amount;
    if (tx.type === 'withdrawal') return sum - tx.amount;
    return sum + tx.amount; // adjustment — already signed
  }, 0);
}

/**
 * What the app believes is in the account: cash movements plus settled results.
 *
 * NOTE this is not the number a bookmaker shows while bets are open. There the
 * stake leaves the balance the moment a bet is placed, so
 * `bookmakerBalance = currentBank - pendingExposure`.
 */
export function currentBank(transactions: BankrollTransaction[], bets: Bet[]): number {
  // The P&L alone — it used to run the whole dashboard (two sorts) for this one sum.
  return bankCash(transactions) + totalPnl(bets);
}

/**
 * The user's own money in unsettled bets — what the bookmaker has already taken
 * off the balance. Freebets are left out: a freebet is the bookmaker's bonus, not
 * the user's cash, so it never left the balance. This is the number for
 * "balance at the bookmaker" and for reconciliation; counting a freebet here
 * would make a reconciliation record a shortfall that is not there.
 */
export function pendingExposure(bets: Bet[]): number {
  return bets
    .filter((b) => b.status === 'pending' && !b.isFreebet)
    .reduce((sum, b) => sum + b.stake, 0);
}

/**
 * Everything in play: the stakes of all unsettled bets, freebets included —
 * the "в игре" a user reads. Not for balance arithmetic (see pendingExposure).
 */
export function pendingStake(bets: Bet[]): number {
  return bets
    .filter((b) => b.status === 'pending')
    .reduce((sum, b) => sum + b.stake, 0);
}

/**
 * A P&L-ranked list (best first) as the Insights screens show it: the two
 * extremes, the next `topN`, and the rest. With one entry there is no "worst"
 * — one thing cannot be both ends.
 */
export function splitExtremes<T>(list: readonly T[], topN: number): {
  best: T | undefined; worst: T | undefined; top: T[]; rest: T[];
} {
  const best = list[0];
  const worst = list.length > 1 ? list[list.length - 1] : undefined;
  const middle = list.length > 1 ? list.slice(1, -1) : [];
  return { best, worst, top: middle.slice(0, topN), rest: middle.slice(topN) };
}
