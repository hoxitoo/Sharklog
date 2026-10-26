import { describe, it, expect } from 'vitest';
import { sanitizeBets, sanitizeBet, sanitizeBankroll, sanitizeDiary, sanitizeTeams, normalizeDay } from './sanitize';

const good = {
  id: 'b1', createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  date: '2026-10-01', time: '19:30', sport: 'football', bookmaker: 'Winline', event: 'A vs B',
  betType: '1X2', pick: 'П1', odds: 1.85, stake: 100_000, status: 'won', strategy: 'value', schemaVersion: 3,
};

describe('sanitizeBet', () => {
  it('keeps a good bet exactly', () => {
    expect(sanitizeBet(good)).toEqual(good);
  });

  it('drops a bet without what makes it a bet', () => {
    for (const broken of [
      { ...good, id: '' }, { ...good, id: 7 }, { ...good, status: 'void' }, { ...good, date: 20261001 },
      { ...good, date: null }, { ...good, odds: 'x' }, { ...good, odds: 0 }, { ...good, stake: -1 },
      { ...good, stake: Infinity }, { ...good, event: null }, { ...good, sport: undefined }, null, 'bet', [],
    ]) {
      expect(sanitizeBet(broken)).toBeNull();
    }
  });

  it('mends what can be mended and drops broken optional fields', () => {
    const b = sanitizeBet({
      ...good, time: undefined, pick: 42, bookmaker: null, createdAt: 'yesterday', schemaVersion: 'x',
      closingOdds: 'high', cashoutAmount: 5000, notes: { evil: true }, tournament: 'РПЛ', isFreebet: 'yes',
    })!;
    expect(b.time).toBe('00:00'); // missing → start of the day
    expect(b.pick).toBe('');
    expect(b.bookmaker).toBe('');
    expect(b.createdAt).toBe('2026-10-01T00:00:00');
    expect(typeof b.schemaVersion).toBe('number');
    expect(b).not.toHaveProperty('closingOdds');
    expect(b).not.toHaveProperty('notes');
    expect(b).not.toHaveProperty('isFreebet');
    expect(b.cashoutAmount).toBe(5000);
    expect(b.tournament).toBe('РПЛ');
  });

  it('keeps an unknown sport or strategy — screens show those as stored', () => {
    expect(sanitizeBet({ ...good, sport: 'mma', strategy: 'gut' })?.sport).toBe('mma');
  });

  it('brings an imported date to YYYY-MM-DD, and keeps one it cannot read as it was', () => {
    expect(sanitizeBet({ ...good, date: '1.10.2026' })?.date).toBe('2026-10-01');
    expect(sanitizeBet({ ...good, date: '2026-10-01T19:30:00' })?.date).toBe('2026-10-01');
    expect(sanitizeBet({ ...good, time: '19:30:15' })?.time).toBe('19:30');
    expect(sanitizeBet({ ...good, time: '7:05:30' })?.time).toBe('07:05'); // not '7:05:', and padded to sort
    // What an older CSV import stored: the user's own backup must carry it to a new phone.
    expect(sanitizeBet({ ...good, date: '2026/10/01' })?.date).toBe('2026/10/01');
    expect(sanitizeBet({ ...good, date: '45200' })?.date).toBe('45200');
  });

  it('turns the empty sport the old desktop import left into "other" instead of refusing the bet', () => {
    const b = sanitizeBet({ ...good, sport: '', betType: '', strategy: '' })!;
    expect([b.sport, b.betType, b.strategy]).toEqual(['other', 'other', 'other']);
  });
});

describe('stored mode — the app\'s own file at launch', () => {
  it('drops only what would crash a screen, and touches nothing else', () => {
    // What an older CSV import may have left: a date it could not read, kept as it was.
    const loose = { ...good, date: '1.10.2026 19:30', time: '7:5', odds: 0, createdAt: 'when', sport: '' };
    expect(sanitizeBet(loose, 'stored')).toEqual(loose);
    for (const crash of [{ ...good, event: null }, { ...good, odds: 'x' }, { ...good, date: 5 }, { ...good, status: 'void' }]) {
      expect(sanitizeBet(crash, 'stored')).toBeNull();
    }
  });

  it('keeps an old negative withdrawal as it was: dropping it would move the bank', () => {
    const r = sanitizeBankroll({ transactions: [{ id: 't', type: 'withdrawal', amount: -100, date: '2026-10-01' }] });
    expect(r.bankroll.transactions).toHaveLength(1);
    expect(r.dropped).toBe(0);
  });
});

describe('normalizeDay', () => {
  it('reads the forms people write and refuses days that do not exist', () => {
    expect(normalizeDay('2026-10-01')).toBe('2026-10-01');
    expect(normalizeDay('01/10/2026')).toBe('2026-10-01');
    expect(normalizeDay('2026-02-30')).toBeNull();
    expect(normalizeDay('yesterday')).toBeNull();
    expect(normalizeDay(20261001)).toBeNull();
  });
});

describe('sanitizeBets', () => {
  it('counts what it drops, and of two bets under one id keeps the one edited last', () => {
    // The old "add to current" restore put the backup's stale pending copy first.
    const stale = { ...good, status: 'pending', updatedAt: '2026-10-01T09:00:00.000Z' };
    const settled = { ...good, status: 'won', updatedAt: '2026-10-02T09:00:00.000Z' };
    const r = sanitizeBets([stale, { ...good, id: 'x', event: null }, settled, { ...good, id: 'b2' }]);
    expect(r.items.map((b) => [b.id, b.status])).toEqual([['b1', 'won'], ['b2', 'won']]);
    expect(r.dropped).toBe(2);
  });

  it('reads anything that is not a list as nothing', () => {
    expect(sanitizeBets({ bets: [] })).toEqual({ items: [], dropped: 0 });
  });
});

describe('sanitizeBankroll', () => {
  it('keeps the fields that check out and drops broken transactions', () => {
    const r = sanitizeBankroll({
      name: 'Банк', currency: 'RUB', unitPercent: 'two', createdAt: 5,
      transactions: [
        { id: 't1', type: 'deposit', amount: 500_000, date: '2026-10-01T10:00:00.000Z' },
        { id: 't2', type: 'adjustment', amount: -2_500, date: '2026-10-02T10:00:00.000Z', note: 'Сверка' },
        { id: 't3', type: 'withdrawal', amount: 'all', date: '2026-10-02T10:00:00.000Z' },
        { id: 't4', type: 'gift', amount: 100, date: '2026-10-02T10:00:00.000Z' },
        { id: 't1', type: 'deposit', amount: 1, date: '2026-10-03T10:00:00.000Z' },
      ],
    });
    expect(r.bankroll).toEqual({
      name: 'Банк', currency: 'RUB',
      transactions: [
        { id: 't1', type: 'deposit', amount: 500_000, date: '2026-10-01T10:00:00.000Z' },
        { id: 't2', type: 'adjustment', amount: -2_500, date: '2026-10-02T10:00:00.000Z', note: 'Сверка' },
      ],
    });
    expect(r.dropped).toBe(3);
  });

  it('gives nothing to merge for something that is not a bankroll', () => {
    expect(sanitizeBankroll('x')).toEqual({ bankroll: {}, dropped: 0 });
  });
});

describe('sanitizeDiary and sanitizeTeams', () => {
  it('keeps good entries and drops the rest', () => {
    const d = sanitizeDiary([{ id: 'd1', date: '2026-10-01', mood: 4, text: 'ok' }, { id: 'd2', date: '2026-10-01', mood: 9 }]);
    expect(d.items).toEqual([{ id: 'd1', date: '2026-10-01', mood: 4, text: 'ok' }]);
    expect(d.dropped).toBe(1);
    const t = sanitizeTeams([{ id: 't', name: 'NaVi', sport: 'esports', discipline: 'csgo', usageCount: 3, lastUsed: '2026-10-01T00:00:00.000Z' }, { id: 'x', name: 5 }]);
    expect(t.items[0]!.name).toBe('NaVi');
    expect(t.dropped).toBe(1);
  });
});
