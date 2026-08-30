import type { Bet, BankrollTransaction, EsportsDiscipline } from '../types/bet';
import { ODDS_RANGES } from '../constants/index';

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
  const settled = bets
    .filter((b) => b.status === 'won' || b.status === 'lost' || (b.status === 'cashout' && b.cashoutAmount != null))
    // Ordered by when the match happened, not when the row was typed in: a bet
    // entered after the fact would otherwise land at the end of the curve and
    // put it out of step with the bets list, the dashboard and the bank curve.
    .sort((a, b) => (`${a.date}T${a.time}`).localeCompare(`${b.date}T${b.time}`)
      || a.createdAt.localeCompare(b.createdAt));

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
  const settled = [...bets]
    .filter((b) => b.status === 'won' || b.status === 'lost')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // newest first

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

export function calcByOddsRange(bets: Bet[]): SliceStats[] {
  return ODDS_RANGES.map((range) => {
    const group = bets.filter((b) => b.odds >= range.min && b.odds < range.max);
    return calcSlice(group, range.label);
  });
}

export function calcByDayOfWeek(bets: Bet[]): SliceStats[] {
  const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const groups: Bet[][] = Array.from({ length: 7 }, () => []);

  for (const bet of bets) {
    // Parse as LOCAL midnight ("...T00:00:00"); bare "YYYY-MM-DD" parses as UTC,
    // which shifts the weekday for users west of UTC (off-by-one bucketing).
    const dow = new Date(`${bet.date}T00:00:00`).getDay();
    if (dow >= 0 && dow <= 6) groups[dow]?.push(bet);
  }

  return groups.map((group, i) => calcSlice(group, days[i] ?? ''));
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

export function calcByTournament(bets: Bet[]): TournamentStats[] {
  const groups = new Map<string, Bet[]>();
  for (const bet of bets) {
    const key = (bet.tournament ?? '').trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(bet);
  }

  return Array.from(groups.entries()).map(([tournament, group]) => {
    const slice = calcSlice(group, tournament);

    const sport = dominant(group.map((b) => b.sport)) ?? '';
    // "Киберспорт" alone says almost nothing — CS2 and Dota are different games
    // with different edges. Only meaningful when the group really is esports.
    const discipline = sport === 'esports' ? dominant(group.map((b) => b.discipline)) : undefined;

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
 */
export function betBacksTeam(bet: Bet, team: string): boolean {
  const needle = team.trim().toLowerCase();
  if (!needle) return false;
  return getPickedTeams(bet.event, bet.pick).some((t) => t.toLowerCase() === needle);
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
    const discipline = sport === 'esports' ? dominant(group.map((b) => b.discipline)) : undefined;

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
  return bankCash(transactions) + calcDashboard(bets).pnl;
}

/** Money sitting in unsettled bets — deducted at the bookmaker, not here. */
export function pendingExposure(bets: Bet[]): number {
  return bets
    .filter((b) => b.status === 'pending' && !b.isFreebet)
    .reduce((sum, b) => sum + b.stake, 0);
}
