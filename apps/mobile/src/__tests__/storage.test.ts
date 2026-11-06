import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bet } from '@sharklog/core';
import { useBetsStore, defaultSettings, defaultBankroll } from '../store/betsStore';
import {
  CHUNK_CHARS, MIN_RECORD_CHARS, STORAGE_KEY, assembleGeneration, buildSave, parsePieceKey, recordPieces,
} from '../utils/storageLayout';

/*
 * The store on disk. On Android AsyncStorage keeps a value as one SQLite row,
 * and a row over 2 MB is written fine and then cannot be read back; all data
 * used to sit under one key — about 4 000 bets in, the app would have saved
 * its data and never opened it again. And a failed read started an empty app
 * whose first save (onboarding) replaced the real file.
 *
 * What these tests hold: bets in pieces far below the limit; a save that can
 * be killed at ANY step and leaves either the old state or the new one, whole
 * (iOS writes a multi-set file by file — storageLayout.ts); nothing deleted at
 * load; bets rebuilt from the pieces when the record is lost, broken, or was
 * rewritten by an older build; and no write at all until a read succeeds.
 */

type Mock = jest.Mock;
const storage = AsyncStorage as unknown as {
  getItem: Mock; setItem: Mock; getMany: Mock; setMany: Mock; removeMany: Mock; getAllKeys: Mock;
  clear: () => Promise<void>;
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
const many = (n: number, from = 0) => Array.from({ length: n }, (_, i) => bet(from + i));
const ids = () => useBetsStore.getState().bets.map((b) => b.id).sort();
const flush = () => new Promise((r) => setTimeout(r, 0));

async function reset() {
  await storage.clear();
  useBetsStore.setState({
    bets: [], diary: [], teams: [], goals: [],
    settings: { ...defaultSettings, onboardingComplete: true },
    bankroll: { ...defaultBankroll }, isLoaded: true, loadError: false,
  });
}

/** A launch: the state in memory is gone, the store reads the disk. */
async function relaunch() {
  useBetsStore.setState({ bets: [], isLoaded: false, loadError: false, settings: { ...defaultSettings } });
  await useBetsStore.getState().load();
}

async function save(bets: Bet[]) {
  useBetsStore.setState({ bets });
  await useBetsStore.getState().persist();
}

const pieceKeys = async () => ((await storage.getAllKeys()) as string[]).filter((k) => parsePieceKey(k) !== null);

beforeEach(async () => {
  jest.clearAllMocks();
  await reset();
});

describe('the layout', () => {
  it('pieces say what they are, stay under the limit, and give the bets back in order', () => {
    const bets = many(60);
    const { pieces, record, chunks } = buildSave({ bets, settings: {}, version: 4 }, 7, 2_000);
    expect(chunks).toBeGreaterThan(5);
    const texts = Object.keys(pieces).map((k, i) => {
      expect(parsePieceKey(k)).toEqual({ gen: 7, index: i });
      expect(JSON.parse(pieces[k]!).bets.length).toBeGreaterThan(0);
      return pieces[k]!;
    });
    for (const t of texts) expect(JSON.stringify(JSON.parse(t).bets).length).toBeLessThanOrEqual(2_000);
    expect(assembleGeneration(7, texts, 60)).toEqual({ bets, whole: true });
    // A piece from another save, a missing one, or a wrong count is not whole.
    expect(assembleGeneration(8, texts).whole).toBe(false);
    expect(assembleGeneration(7, [texts[0]!, null, ...texts.slice(2)]).whole).toBe(false);
    expect(assembleGeneration(7, texts, 59).whole).toBe(false);
    const meta = JSON.parse(record);
    expect(meta.bets).toBeUndefined();
    expect(recordPieces(meta)).toEqual({ gen: 7, chunks, count: 60 });
  });

  it('keeps the record above the inline limit of iOS, even with nothing in it', () => {
    const { record } = buildSave({ bets: [], settings: {} }, 1);
    expect(record.length).toBeGreaterThanOrEqual(MIN_RECORD_CHARS);
    expect(MIN_RECORD_CHARS).toBeGreaterThan(1024);
  });

  it('writes a hole in the list as null, as the single-key layout did, instead of failing every save', () => {
    const { pieces } = buildSave({ bets: [bet(1), undefined as unknown as Bet] }, 1);
    expect(JSON.parse(Object.values(pieces)[0]!).bets).toEqual([bet(1), null]);
  });
});

describe('ten thousand bets', () => {
  it('fit in pieces far below the 2 MB row, and come back as they went in', async () => {
    const bets = many(10_000);
    expect(JSON.stringify(bets).length).toBeGreaterThan(2 * 1024 * 1024); // one key would not be readable
    await save(bets);
    await relaunch();
    expect(useBetsStore.getState().bets).toEqual(bets);
    for (const k of await pieceKeys()) expect((await storage.getItem(k))!.length).toBeLessThanOrEqual(CHUNK_CHARS + 100);
    expect((await storage.getItem(STORAGE_KEY))!.length).toBeLessThan(50_000);
  });
});

describe('a save killed at any step', () => {
  beforeEach(async () => {
    await save(many(3_000));
  });

  it('pieces written, record not: the old state, whole', async () => {
    storage.setItem.mockImplementationOnce(async () => { throw new Error('killed'); });
    await save(many(3_001));
    await relaunch();
    expect(useBetsStore.getState().bets).toHaveLength(3_000);
    expect(useBetsStore.getState().loadError).toBe(false);
  });

  it('killed half-way through the pieces (iOS writes them one by one): the old state, whole', async () => {
    storage.setMany.mockImplementationOnce(async (entries: Record<string, string>) => {
      const [k, v] = Object.entries(entries)[0]!;
      await storage.setItem(k, v); // the first file landed, then the process died
      throw new Error('killed');
    });
    await save(many(3_001));
    await relaunch();
    expect(useBetsStore.getState().bets).toHaveLength(3_000);
  });

  it('record written, old pieces not yet removed: the new state, and the old pieces go on the next save', async () => {
    storage.removeMany.mockImplementationOnce(async () => { throw new Error('killed'); });
    await save(many(3_001));
    await relaunch();
    expect(useBetsStore.getState().bets).toHaveLength(3_001);
    const gens = new Set((await pieceKeys()).map((k) => parsePieceKey(k)!.gen));
    expect(gens.size).toBe(2);
    await useBetsStore.getState().persist();
    expect(new Set((await pieceKeys()).map((k) => parsePieceKey(k)!.gen)).size).toBe(1);
  });

  it('a load deletes nothing — only a save that has written its record does', async () => {
    storage.removeMany.mockClear();
    await relaunch();
    expect(storage.removeMany).not.toHaveBeenCalled();
  });
});

describe('the record lost, broken, or rewritten by an older build', () => {
  it('an older build (knows no pieces) rewrote the record: its bets and the pieces\' are both kept', async () => {
    await save(many(3_000));
    // The old build read no bets, the user added one, and it saved the old way.
    const record = JSON.parse((await storage.getItem(STORAGE_KEY))!);
    await storage.setItem(STORAGE_KEY, JSON.stringify({ settings: record.settings, version: 4, bets: [bet(9_999)] }));
    await relaunch();
    expect(useBetsStore.getState().bets).toHaveLength(3_001);
    expect(ids()).toContain('bet-9999');
    // And the next save keeps them all, in the new layout.
    await useBetsStore.getState().persist();
    await relaunch();
    expect(useBetsStore.getState().bets).toHaveLength(3_001);
  });

  it('the record is gone (iOS can lose a key mid-write): the bets come back from the pieces', async () => {
    await save(many(2_000));
    await storage.clear();
    const { pieces } = buildSave({ bets: many(2_000) }, 5);
    for (const [k, v] of Object.entries(pieces)) await storage.setItem(k, v);
    await relaunch();
    expect(useBetsStore.getState().bets).toHaveLength(2_000);
    expect(useBetsStore.getState().settings.onboardingComplete).toBe(true);
  });

  it('the record is unreadable: the bets come back from the pieces, and the record is kept for support', async () => {
    await save(many(2_000));
    await storage.setItem(STORAGE_KEY, '{"settings": {');
    await relaunch();
    await flush(); await flush();
    expect(useBetsStore.getState().bets).toHaveLength(2_000);
    expect(useBetsStore.getState().isLoaded).toBe(true);
    expect(await storage.getItem('@sharklog/data_quarantine')).toBe('{"settings": {');
  });

  it('reads the old single-key file, and writes it back in pieces', async () => {
    const bets = [bet(1), bet(2)];
    await storage.setItem(STORAGE_KEY, JSON.stringify({ version: 4, bets, diary: [], teams: [] }));
    await relaunch();
    expect(useBetsStore.getState().bets).toEqual(bets);
    await useBetsStore.getState().persist();
    expect(JSON.parse((await storage.getItem(STORAGE_KEY))!).bets).toBeUndefined();
    await relaunch();
    expect(useBetsStore.getState().bets).toEqual(bets);
  });

  it('a piece of the named save is damaged: the rest loads, and record and pieces go to quarantine', async () => {
    await save(many(3_000));
    const keys = await pieceKeys();
    const broken = keys[1]!;
    await storage.setItem(broken, '{"g": 1, "bets": [');
    await relaunch();
    await flush(); await flush();
    expect(useBetsStore.getState().bets.length).toBeLessThan(3_000);
    expect(useBetsStore.getState().bets.length).toBeGreaterThan(0);
    expect(await storage.getItem('@sharklog/data_quarantine#1')).toBe('{"g": 1, "bets": [');
  });
});

describe('a read that fails', () => {
  it('shows the error state and writes nothing — the data on disk stays as it was', async () => {
    await save([bet(1), bet(2)]);
    const onDisk = await storage.getItem(STORAGE_KEY);
    useBetsStore.setState({ bets: [], isLoaded: false });
    storage.getItem.mockImplementationOnce(async () => { throw new Error('Row too big to fit into CursorWindow'); });
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().loadError).toBe(true);
    expect(useBetsStore.getState().isLoaded).toBe(false);
    storage.setMany.mockClear();
    storage.setItem.mockClear();
    useBetsStore.getState().addBet(bet(3));
    useBetsStore.getState().updateSettings({ onboardingComplete: true });
    await useBetsStore.getState().persist();
    expect(storage.setMany).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(await storage.getItem(STORAGE_KEY)).toBe(onDisk);
    await useBetsStore.getState().load(); // the retry
    expect(useBetsStore.getState().loadError).toBe(false);
    expect(ids()).toEqual(['bet-1', 'bet-2']);
  });

  it('treats a failed read of the pieces or of the key list the same way', async () => {
    await save([bet(1)]);
    useBetsStore.setState({ isLoaded: false });
    storage.getMany.mockImplementationOnce(async () => { throw new Error('disk I/O error'); });
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().loadError).toBe(true);
    useBetsStore.setState({ loadError: false });
    storage.getAllKeys.mockImplementationOnce(async () => { throw new Error('disk I/O error'); });
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().loadError).toBe(true);
  });

  it('writes nothing before a load has finished', async () => {
    useBetsStore.setState({ isLoaded: false });
    storage.setMany.mockClear();
    await useBetsStore.getState().persist();
    expect(storage.setMany).not.toHaveBeenCalled();
  });

  it('tells a caller whether its save reached the disk', async () => {
    useBetsStore.setState({ bets: [bet(1)] });
    useBetsStore.getState().persist();
    expect(await useBetsStore.getState().flush()).toBe(true);
    storage.setItem.mockImplementationOnce(async () => { throw new Error('disk full'); });
    useBetsStore.getState().persist();
    expect(await useBetsStore.getState().flush()).toBe(false);
  });
});

describe('clear all data', () => {
  it('leaves no piece behind', async () => {
    await save(many(3_000));
    useBetsStore.getState().clearAll();
    await useBetsStore.getState().flush();
    expect(await pieceKeys()).toEqual([]);
    await relaunch();
    expect(useBetsStore.getState().bets).toEqual([]);
  });
});
