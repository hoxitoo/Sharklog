import { describe, it, expect } from 'vitest';
import type { Bet, Team } from '../types/bet';
import { upsertTeams, cleanTeamNames } from '../utils/teams';
import { stepProbability } from '../utils/kelly';
import { calcHeatmap, heatLevel } from '../utils/heatmap';
import { splitExtremes } from '../utils/stats';
import { toYmd } from '../utils/daily';

/*
 * Helpers that lived as identical copies in the mobile and desktop apps
 * (audit 2026-11-06, item 24). One copy each now; these pin the behaviour the
 * copies had.
 */

const team = (over: Partial<Team>): Team => ({ id: 't', name: 'NaVi', sport: 'esports', usageCount: 1, lastUsed: '2026-01-01T00:00:00.000Z', ...over });

describe('upsertTeams', () => {
  const now = new Date('2026-11-07T10:00:00.000Z');
  let n = 0;
  const id = () => `id-${++n}`;

  it('counts a known team once more, in any case, and adds a new one with a fresh id', () => {
    const existing = [team({ name: 'NaVi', discipline: 'cs2' })];
    const out = upsertTeams(existing, ['navi', 'G2'], 'esports', 'cs2', id, now);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ name: 'NaVi', usageCount: 2, lastUsed: now.toISOString() });
    expect(out[1]).toMatchObject({ name: 'G2', sport: 'esports', discipline: 'cs2', usageCount: 1 });
    expect(out[1]!.id).toMatch(/^id-/);
    expect(existing[0]!.usageCount).toBe(1); // the input is not changed
  });

  it('keeps the same name in another sport or discipline apart', () => {
    const existing = [team({ name: 'Spirit', discipline: 'cs2' })];
    expect(upsertTeams(existing, ['Spirit'], 'esports', 'dota2', id, now)).toHaveLength(2);
    expect(upsertTeams(existing, ['Spirit'], 'football', undefined, id, now)).toHaveLength(2);
    const plain = upsertTeams([], ['Зенит'], 'football', undefined, id, now);
    expect('discipline' in plain[0]!).toBe(false);
  });

  it('cleanTeamNames drops names an old extractor stored from a whole express', () => {
    const kept = team({ name: 'Yellow submarine' });
    expect(cleanTeamNames([kept, team({ name: 'Yellow submarine|1.45 / Reconix' }), team({ name: 'A / B' })])).toEqual([kept]);
  });
});

describe('stepProbability', () => {
  it('steps five points within 5–95%, in whole percent', () => {
    expect(stepProbability(0.5, 1)).toBe(0.55);
    expect(stepProbability(0.15, -1)).toBe(0.1);
    expect(stepProbability(0.95, 1)).toBe(0.95);
    expect(stepProbability(0.05, -1)).toBe(0.05);
    let p = 0.5;
    for (let i = 0; i < 7; i++) p = stepProbability(p, 1);
    expect(p).toBe(0.85);
  });
});

describe('splitExtremes', () => {
  it('two ends, the next few, and the rest; one entry is not both ends', () => {
    expect(splitExtremes([], 3)).toEqual({ best: undefined, worst: undefined, top: [], rest: [] });
    expect(splitExtremes([1], 3)).toEqual({ best: 1, worst: undefined, top: [], rest: [] });
    expect(splitExtremes([1, 2], 3)).toEqual({ best: 1, worst: 2, top: [], rest: [] });
    expect(splitExtremes([1, 2, 3, 4, 5, 6, 7], 3)).toEqual({ best: 1, worst: 7, top: [2, 3, 4], rest: [5, 6] });
  });
});

describe('calcHeatmap', () => {
  const now = new Date(2026, 10, 7, 15, 0);
  const day = (back: number) => { const d = new Date(now); d.setDate(now.getDate() - back); return toYmd(d); };
  const bet = (over: Partial<Bet>): Bet => ({
    id: Math.random().toString(36), createdAt: '', date: day(0), time: '12:00', sport: 'football', bookmaker: 'x',
    event: 'A vs B', betType: '1X2', pick: 'П1', odds: 1.9, stake: 10_000, status: 'won', strategy: 'value', schemaVersion: 4,
    ...over,
  } as Bet);

  /** The mobile copy as it was before core had this (DashboardScreen, 2026-11-06). */
  function oldMobile(bets: Bet[], today: Date) {
    const pnlByDate: Record<string, number> = {};
    const countByDate: Record<string, number> = {};
    for (const b of bets) {
      if (b.status === 'pending') continue;
      const profit = b.status === 'won' ? Math.round(b.stake * (b.odds - 1))
        : b.status === 'lost' ? (b.isFreebet ? 0 : -b.stake)
        : b.status === 'cashout' && b.cashoutAmount != null ? b.cashoutAmount - b.stake : 0;
      pnlByDate[b.date] = (pnlByDate[b.date] ?? 0) + profit;
      countByDate[b.date] = (countByDate[b.date] ?? 0) + 1;
    }
    if (Object.keys(countByDate).length === 0) return null;
    const days: Array<{ date: string; pnl: number; count: number }> = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const date = toYmd(d);
      days.push({ date, pnl: pnlByDate[date] ?? 0, count: countByDate[date] ?? 0 });
    }
    const cols = [];
    for (let w = 0; w < 12; w++) cols.push(days.slice(w * 7, w * 7 + 7));
    return cols;
  }

  it('matches the old mobile heatmap on random books', () => {
    const statuses = ['won', 'lost', 'pending', 'refund', 'cashout'] as const;
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    for (let book = 0; book < 50; book++) {
      const bets = Array.from({ length: 1 + Math.floor(rnd() * 120) }, () => {
        const status = statuses[Math.floor(rnd() * statuses.length)]!;
        return bet({
          date: day(Math.floor(rnd() * 100)), status, isFreebet: rnd() < 0.15,
          odds: 1.05 + Math.round(rnd() * 400) / 100, stake: Math.floor(rnd() * 900_000) + 100,
          ...(status === 'cashout' && rnd() < 0.8 ? { cashoutAmount: Math.floor(rnd() * 900_000) } : {}),
        });
      });
      expect(calcHeatmap(bets, 12, now)).toEqual(oldMobile(bets, now));
    }
  });

  it('a lost freebet is 0 on the heatmap, as in the bank (the desktop copy took it as −stake)', () => {
    const cols = calcHeatmap([bet({ status: 'lost', isFreebet: true })], 12, now)!;
    expect(cols[11]![6]).toEqual({ date: day(0), pnl: 0, count: 1 });
  });

  it('no settled bet at all: no heatmap; twelve weeks ending today otherwise', () => {
    expect(calcHeatmap([bet({ status: 'pending' })], 12, now)).toBeNull();
    const cols = calcHeatmap([bet({})], 12, now)!;
    expect(cols).toHaveLength(12);
    expect(cols.every((c) => c.length === 7)).toBe(true);
    expect(cols[0]![0]!.date).toBe(day(83));
    expect(cols[11]![6]!.date).toBe(day(0));
  });

  it('heatLevel: none, even, and three steps each way', () => {
    const lv = (pnl: number, count = 1) => heatLevel({ date: '', pnl, count });
    expect(lv(0, 0)).toBeNull();
    expect(lv(0)).toBe(0);
    expect([lv(1), lv(10_000), lv(10_001), lv(50_000), lv(50_001)]).toEqual([1, 1, 2, 2, 3]);
    expect([lv(-1), lv(-10_001), lv(-50_001)]).toEqual([-1, -2, -3]);
  });
});
