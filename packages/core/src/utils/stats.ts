import type { Bet } from '../types/bet';
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

function calcSlice(bets: Bet[], label: string): SliceStats {
  const settled = bets.filter((b) => b.status === 'won' || b.status === 'lost');
  const won = bets.filter((b) => b.status === 'won').length;
  const lost = bets.filter((b) => b.status === 'lost').length;
  const refund = bets.filter((b) => b.status === 'refund').length;
  const cashout = bets.filter((b) => b.status === 'cashout').length;
  const pending = bets.filter((b) => b.status === 'pending').length;

  // Include refund/cashout stakes in totalStaked — capital was wagered even if returned
  const totalStaked = bets.filter((b) => b.status !== 'pending').reduce((sum, b) => sum + b.stake, 0);
  const pnl = bets.reduce((sum, b) => {
    if (b.status === 'won') return sum + Math.round(b.stake * b.odds) - b.stake;
    if (b.status === 'lost') return sum - b.stake;
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
    .filter((b) => b.status === 'won' || b.status === 'lost')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const pendingCount = bets.filter((b) => b.status === 'pending').length;
  const totalStaked = stats.totalStaked;
  const avgOdds = settled.length > 0
    ? Math.round((settled.reduce((sum, b) => sum + b.odds, 0) / settled.length) * 100) / 100
    : 0;

  let running = 0;
  const pnlCurve = settled.map((b, i) => {
    if (b.status === 'won') running += Math.round(b.stake * b.odds) - b.stake;
    else running -= b.stake;
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
    const dow = new Date(bet.date).getDay();
    groups[dow]?.push(bet);
  }

  return groups.map((group, i) => calcSlice(group, days[i] ?? ''));
}

export function calcByHour(bets: Bet[]): SliceStats[] {
  const groups = new Map<number, Bet[]>();

  for (const bet of bets) {
    const hour = parseInt(bet.time.split(':')[0] ?? '0', 10);
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
  count: number;
  won: number;
  lost: number;
  pending: number;
  pnl: number;          // kopecks
  roi: number;          // %
  winRate: number;      // %
  totalStaked: number;  // kopecks
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

    // Most common sport in group
    const sportCount = new Map<string, number>();
    for (const b of group) {
      sportCount.set(b.sport, (sportCount.get(b.sport) ?? 0) + 1);
    }
    const sport = [...sportCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    return {
      tournament,
      sport,
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
  count: number;
  won: number;
  lost: number;
  pnl: number;          // kopecks
  roi: number;          // %
  winRate: number;      // %
  lastTournament: string;
}

function parseEventTeams(event: string): string[] {
  const parts = event.split(/\s+(?:—|–|vs\.?|против|-)\s+/i);
  return parts.map((p) => p.trim()).filter((p) => p.length >= 2 && p.length <= 50);
}

export function calcByTeam(bets: Bet[], minBets = 10): TeamStats[] {
  const teamBets = new Map<string, Bet[]>();

  for (const bet of bets) {
    for (const team of parseEventTeams(bet.event)) {
      const key = team.toLowerCase();
      if (!teamBets.has(key)) teamBets.set(key, []);
      teamBets.get(key)!.push(bet);
    }
  }

  const result: TeamStats[] = [];

  for (const [, group] of teamBets.entries()) {
    if (group.length < minBets) continue;

    const slice = calcSlice(group, '');
    // Canonical name: from most recent bet's event part matching this team
    const sorted = [...group].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const name = parseEventTeams(sorted[0]?.event ?? '').find(
      (t) => group.some((b) => parseEventTeams(b.event).some((et) => et.toLowerCase() === t.toLowerCase()))
    ) ?? sorted[0]?.event ?? '';

    const sportCount = new Map<string, number>();
    for (const b of group) sportCount.set(b.sport, (sportCount.get(b.sport) ?? 0) + 1);
    const sport = [...sportCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    const lastTournament = sorted.find((b) => b.tournament?.trim())?.tournament ?? '';

    result.push({
      name,
      sport,
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
