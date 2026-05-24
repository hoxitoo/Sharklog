import type { Bet } from '../types/bet.js';
import { ODDS_RANGES } from '../constants/index.js';

export interface SliceStats {
  label: string;
  count: number;
  won: number;
  lost: number;
  refund: number;
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
  currentStreak: { type: 'win' | 'loss' | 'none'; count: number };
  pnlCurve: Array<{ index: number; pnl: number }>;
}

function calcSlice(bets: Bet[], label: string): SliceStats {
  const settled = bets.filter((b) => b.status !== 'pending' && b.status !== 'refund');
  const won = bets.filter((b) => b.status === 'won').length;
  const lost = bets.filter((b) => b.status === 'lost').length;
  const refund = bets.filter((b) => b.status === 'refund').length;
  const pending = bets.filter((b) => b.status === 'pending').length;

  const totalStaked = settled.reduce((sum, b) => sum + b.stake, 0);
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
