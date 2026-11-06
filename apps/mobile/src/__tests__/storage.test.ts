import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bet } from '@sharklog/core';
import { useBetsStore, defaultSettings, defaultBankroll } from '../store/betsStore';
import { CHUNK_CHARS, STORAGE_KEY, chunkIndex, chunkKey, namedChunks, splitBets, storageEntries } from '../utils/storageLayout';

/*
 * The store on disk. On Android AsyncStorage keeps a value as one SQLite row,
 * and a row over 2 MB is written fine and then cannot be read back. Everything
 * used to sit under one key — about 4 000 bets in, the app would have saved its
 * data and never opened it again; and a failed read started an empty app whose
 * first save (onboarding) replaced the real file. These tests hold the two
 * defences: bets in pieces well under the limit, and no write until a read.
 */

const storage = AsyncStorage as unknown as {
  getItem: jest.Mock; getMany: jest.Mock; setMany: jest.Mock; getAllKeys: jest.Mock;
  setItem: (k: string, v: string) => Promise<void>; clear: () => Promise<void>;
};

function bet(i: number, over: Partial<Bet> = {}): Bet {
  const day = new Date(2024, 0, 1 + (i % 900));
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  return {
    id: `bet-${i}`, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`,
    date, time: '19:30', sport: 'football', bookmaker: 'Fonbet',
    event: `Команда ${i} vs Соперник ${i}`, betType: '1X2', pick: 'П1', odds: 1.85, stake: 150_000,
    status: i % 3 === 0 ? 'lost' : 'won', strategy: 'value', schemaVersion: 2,
    tournament: 'Российская Премьер-Лига 2024/25',
    notes: 'Заметка к ставке: состав, мотивация, погода и прочее, что повлияло на решение.',
    ...over,
  } as Bet;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function reset(over: Record<string, unknown> = {}) {
  await storage.clear();
  useBetsStore.setState({
    bets: [], diary: [], teams: [], goals: [],
    settings: { ...defaultSettings, onboardingComplete: true },
    bankroll: { ...defaultBankroll }, isLoaded: true, loadError: false, ...over,
  });
}

async function saveAndReload(bets: Bet[]): Promise<Bet[]> {
  useBetsStore.setState({ bets });
  await useBetsStore.getState().persist();
  useBetsStore.setState({ bets: [] });
  await useBetsStore.getState().load();
  return useBetsStore.getState().bets;
}

const pieceKeys = async () => ((await storage.getAllKeys()) as string[]).filter((k) => chunkIndex(k) !== null).sort();

beforeEach(() => reset());

describe('the layout on disk', () => {
  it('splits the bets into pieces under the limit and gets the same array back', () => {
    const bets = Array.from({ length: 50 }, (_, i) => bet(i));
    const pieces = splitBets(bets, 2_000);
    expect(pieces.length).toBeGreaterThan(5);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(2_000);
    expect(pieces.flatMap((p) => JSON.parse(p))).toEqual(bets);
    // The same text JSON.stringify would give for the whole array.
    expect(splitBets(bets, Infinity)).toEqual([JSON.stringify(bets)]);
    expect(splitBets([])).toEqual([]);
  });

  it('gives a bet longer than the limit a piece of its own', () => {
    const big = bet(1, { notes: 'x'.repeat(5_000) });
    const pieces = splitBets([bet(0), big, bet(2)], 2_000);
    expect(pieces).toHaveLength(3);
    expect(JSON.parse(pieces[1]!)).toEqual([big]);
  });

  it('writes the record that names the pieces last, without the bets in it', () => {
    const { entries, chunks } = storageEntries({ bets: [bet(0), bet(1)], settings: {}, version: 4 }, 1_000);
    const keys = Object.keys(entries);
    expect(keys[keys.length - 1]).toBe(STORAGE_KEY);
    const main = JSON.parse(entries[STORAGE_KEY]!);
    expect(main.bets).toBeUndefined();
    expect(namedChunks(main)).toBe(chunks);
    expect(namedChunks({ bets: [] })).toBeNull();
  });
});

describe('ten thousand bets', () => {
  it('fit in pieces far below the 2 MB row, and come back as they went in', async () => {
    const bets = Array.from({ length: 10_000 }, (_, i) => bet(i));
    const total = JSON.stringify(bets).length;
    expect(total).toBeGreaterThan(2 * 1024 * 1024); // one key would not be readable
    const back = await saveAndReload(bets);
    expect(back).toEqual(bets);
    const keys = await pieceKeys();
    expect(keys.length).toBeGreaterThanOrEqual(Math.ceil(total / CHUNK_CHARS));
    for (const k of keys) expect((await storage.getItem(k))!.length).toBeLessThanOrEqual(CHUNK_CHARS);
    // Everything else stays small: the record carries no bets.
    expect((await storage.getItem(STORAGE_KEY))!.length).toBeLessThan(50_000);
  });

  it('writes the pieces and the record in one call', async () => {
    useBetsStore.setState({ bets: Array.from({ length: 2_000 }, (_, i) => bet(i)) });
    storage.setMany.mockClear();
    await useBetsStore.getState().persist();
    expect(storage.setMany).toHaveBeenCalledTimes(1);
    expect(Object.keys(storage.setMany.mock.calls[0][0])).toContain(STORAGE_KEY);
  });
});

describe('moving between layouts', () => {
  it('reads the old single-key file and writes it back in pieces', async () => {
    const bets = [bet(1), bet(2)];
    await storage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, bets, diary: [], teams: [] }));
    useBetsStore.setState({ isLoaded: false });
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().bets).toEqual(bets);
    await useBetsStore.getState().persist();
    const main = JSON.parse((await storage.getItem(STORAGE_KEY))!);
    expect(main.bets).toBeUndefined();
    expect(main.betChunks).toBe(1);
    expect(JSON.parse((await storage.getItem(chunkKey(0)))!)).toEqual(bets);
  });

  it('removes the pieces a smaller history no longer needs — after the new record is written', async () => {
    await saveAndReload(Array.from({ length: 3_000 }, (_, i) => bet(i)));
    const before = (await pieceKeys()).length;
    expect(before).toBeGreaterThan(1);
    useBetsStore.setState({ bets: [bet(1)] });
    await useBetsStore.getState().persist();
    expect(await pieceKeys()).toEqual([chunkKey(0)]);
    // "Clear all data" leaves no piece behind either.
    useBetsStore.getState().clearAll();
    await flush();
    expect(await pieceKeys()).toEqual([]);
    expect(JSON.parse((await storage.getItem(STORAGE_KEY))!).betChunks).toBe(0);
  });

  it('ignores and tidies leftovers of a save that was cut short', async () => {
    await saveAndReload([bet(1)]);
    await storage.setItem(chunkKey(5), JSON.stringify([bet(99)]));
    useBetsStore.setState({ isLoaded: false });
    await useBetsStore.getState().load();
    await flush();
    expect(useBetsStore.getState().bets.map((b) => b.id)).toEqual(['bet-1']);
    expect(await pieceKeys()).toEqual([chunkKey(0)]);
  });
});

describe('a read that fails', () => {
  it('shows the error state and writes nothing — the data on disk stays as it was', async () => {
    const bets = [bet(1), bet(2)];
    await saveAndReload(bets);
    const onDisk = await storage.getItem(STORAGE_KEY);
    useBetsStore.setState({ bets: [], isLoaded: false });
    storage.getItem.mockImplementationOnce(async () => { throw new Error('Row too big to fit into CursorWindow'); });
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().loadError).toBe(true);
    expect(useBetsStore.getState().isLoaded).toBe(false);
    // What onboarding or any tap would do next: nothing reaches the disk.
    storage.setMany.mockClear();
    useBetsStore.getState().addBet(bet(3));
    useBetsStore.getState().updateSettings({ onboardingComplete: true });
    await useBetsStore.getState().persist();
    expect(storage.setMany).not.toHaveBeenCalled();
    expect(await storage.getItem(STORAGE_KEY)).toBe(onDisk);
    // A retry that reads lifts it.
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().loadError).toBe(false);
    expect(useBetsStore.getState().bets).toEqual(bets);
  });

  it('treats a failed read of the pieces the same way', async () => {
    await saveAndReload([bet(1)]);
    useBetsStore.setState({ bets: [], isLoaded: false });
    storage.getMany.mockImplementationOnce(async () => { throw new Error('disk I/O error'); });
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().loadError).toBe(true);
    expect(useBetsStore.getState().isLoaded).toBe(false);
  });

  it('writes nothing before a load has finished at all', async () => {
    useBetsStore.setState({ isLoaded: false });
    storage.setMany.mockClear();
    await useBetsStore.getState().persist();
    expect(storage.setMany).not.toHaveBeenCalled();
  });
});

describe('a damaged piece', () => {
  const quarantined = async () => ((await storage.getAllKeys()) as string[]).filter((k) => k.startsWith('@sharklog/data_quarantine')).sort();

  it('loads the rest and keeps the file — record and pieces — in quarantine', async () => {
    await saveAndReload(Array.from({ length: 3_000 }, (_, i) => bet(i)));
    const main = (await storage.getItem(STORAGE_KEY))!;
    const p0 = (await storage.getItem(chunkKey(0)))!;
    await storage.setItem(chunkKey(1), '[{"id": "half');
    useBetsStore.setState({ bets: [], isLoaded: false });
    await useBetsStore.getState().load();
    await flush(); await flush();
    const ids = new Set(useBetsStore.getState().bets.map((b) => b.id));
    expect(ids.has('bet-0')).toBe(true);
    expect(useBetsStore.getState().bets.length).toBeLessThan(3_000);
    const q = await quarantined();
    expect(q).toContain('@sharklog/data_quarantine');
    expect(await storage.getItem('@sharklog/data_quarantine')).toBe(main);
    expect(await storage.getItem('@sharklog/data_quarantine#0')).toBe(p0);
    expect(await storage.getItem('@sharklog/data_quarantine#1')).toBe('[{"id": "half');
  });

  it('keeps every piece when the record itself cannot be read — the next save would remove them', async () => {
    await saveAndReload(Array.from({ length: 3_000 }, (_, i) => bet(i)));
    const pieces = await Promise.all((await pieceKeys()).map((k) => storage.getItem(k)));
    await storage.setItem(STORAGE_KEY, '{"settings": {');
    useBetsStore.setState({ bets: [], isLoaded: false });
    await useBetsStore.getState().load();
    await flush(); await flush();
    expect(useBetsStore.getState().isLoaded).toBe(true);
    for (let i = 0; i < pieces.length; i++) {
      expect(await storage.getItem(`@sharklog/data_quarantine#${i}`)).toBe(pieces[i]);
    }
  });
});
