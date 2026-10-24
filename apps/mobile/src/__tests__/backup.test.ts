import { importFromJSON } from '../utils/importBets';

/*
 * Data from outside the app — a backup file — and the app's own file damaged
 * mid-write. One record with `event: null` used to crash every screen that
 * splits events into teams, on every launch, with no way out but clearing all
 * data. The checks themselves are core's sanitize.ts; this is the wiring.
 */

const bet = (over: object = {}) => ({
  id: 'b1', createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  date: '2026-10-01', time: '19:30', sport: 'football', bookmaker: 'Winline', event: 'A vs B',
  betType: '1X2', pick: 'П1', odds: 1.85, stake: 100_000, status: 'won', strategy: 'value', schemaVersion: 3,
  ...over,
});

describe('importFromJSON', () => {
  it('keeps the good records, drops the broken ones and counts them', () => {
    const backup = importFromJSON(JSON.stringify({
      version: 3,
      bets: [bet(), bet({ id: 'b2', event: null }), bet({ id: 'b3', odds: 'many' }), bet({ id: 'b4', date: '2.10.2026' })],
      bankroll: { name: 'Банк', unitPercent: 2, transactions: [{ id: 't', type: 'deposit', amount: 'all', date: '2026-10-01T00:00:00Z' }] },
      diary: [{ id: 'd', date: '2026-10-01', mood: 3 }, { id: 'e', date: '2026-10-01', mood: 0 }],
      settings: { license: 'SL1.x.y', isPro: true },
    }))!;
    expect(backup.bets.map((b) => b.id)).toEqual(['b1', 'b4']);
    expect(backup.bets[1]!.date).toBe('2026-10-02');
    expect(backup.bankroll).toEqual({ name: 'Банк', unitPercent: 2, transactions: [] });
    expect(backup.diary).toHaveLength(1);
    expect(backup.dropped).toBe(4);
    // Settings travel only for the licence, which is verified separately.
    expect(backup.settings?.['license']).toBe('SL1.x.y');
  });

  it('is not a backup without a list of bets', () => {
    expect(importFromJSON('{"bets": "none"}')).toBeNull();
    expect(importFromJSON('not json')).toBeNull();
  });
});

describe('load of a damaged store', () => {
  it('drops only what would crash, keeps what an older version wrote loosely, and quarantines the file', async () => {
    const { useBetsStore } = require('../store/betsStore') as typeof import('../store/betsStore');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    // An older CSV import kept a date it could not read as it was.
    const loose = bet({ id: 'old', date: '2.10.2026 19:30' });
    const raw = JSON.stringify({ version: 3, bets: [bet(), loose, bet({ id: 'bad', event: null })], diary: [], teams: [] });
    await AsyncStorage.setItem('@sharklog/data', raw);
    await useBetsStore.getState().load();
    const ids = useBetsStore.getState().bets.map((b) => b.id);
    expect(ids).toEqual(['b1', 'old']);
    expect(useBetsStore.getState().bets[1]!.date).toBe('2.10.2026 19:30');
    await flush();
    expect(await AsyncStorage.getItem('@sharklog/data_quarantine')).toBe(raw);
  });

  it('keeps an unreadable file instead of letting the first write replace it, and never overwrites an earlier copy', async () => {
    const { useBetsStore } = require('../store/betsStore') as typeof import('../store/betsStore');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const first = await AsyncStorage.getItem('@sharklog/data_quarantine');
    await AsyncStorage.setItem('@sharklog/data', '{"bets": [{"id": "b1"');
    await useBetsStore.getState().load();
    await flush();
    expect(useBetsStore.getState().isLoaded).toBe(true);
    // The earlier copy stays; this one goes next to it.
    expect(await AsyncStorage.getItem('@sharklog/data_quarantine')).toBe(first);
    const keys: string[] = await AsyncStorage.getAllKeys();
    const extra = keys.filter((k) => k.startsWith('@sharklog/data_quarantine:'));
    expect(extra).toHaveLength(1);
    expect(await AsyncStorage.getItem(extra[0]!)).toBe('{"bets": [{"id": "b1"');
  });
});

const flush = () => new Promise((r) => setTimeout(r, 0));
