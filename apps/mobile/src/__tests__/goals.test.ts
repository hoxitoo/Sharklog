import type { TFunction } from 'i18next';
import type { Goal } from '@sharklog/core';
import { useBetsStore, defaultSettings, defaultBankroll } from '../store/betsStore';
import { importFromJSON } from '../utils/importBets';
import { compactMoney } from '../utils/compactMoney';
import { dayLabel, durationLabel, goalPercent } from '../utils/goalText';

/*
 * Goals on the phone: they are data (stored, in the backup, gone with "clear
 * all data"), the header button's sums are short, and the card's words are
 * the same in every language. The arithmetic itself is core's goals.test.ts.
 */

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', title: 'Банк до 100 000', kind: 'bank', target: 100_000_00, startDate: '2026-10-01',
  createdAt: '2026-10-01T10:00:00.000Z', ...over,
});

function reset() {
  useBetsStore.setState({
    bets: [], diary: [], teams: [], goals: [],
    settings: { ...defaultSettings, onboardingComplete: true },
    bankroll: { ...defaultBankroll }, isLoaded: true,
  });
}
beforeEach(reset);

describe('goals in the store', () => {
  it('adds new goals to the end, replaces one by its id, deletes', () => {
    const s = useBetsStore.getState();
    s.saveGoal(goal({ id: 'a' }));
    s.saveGoal(goal({ id: 'b' }));
    s.saveGoal(goal({ id: 'a', title: 'Новое имя' }));
    expect(useBetsStore.getState().goals.map((g) => [g.id, g.title])).toEqual([['a', 'Новое имя'], ['b', 'Банк до 100 000']]);
    s.deleteGoal('a');
    expect(useBetsStore.getState().goals.map((g) => g.id)).toEqual(['b']);
  });

  it('moves the chosen goal to the front — the header button shows the first', () => {
    const s = useBetsStore.getState();
    ['a', 'b', 'c'].forEach((id) => s.saveGoal(goal({ id })));
    s.makeMainGoal('c');
    expect(useBetsStore.getState().goals.map((g) => g.id)).toEqual(['c', 'a', 'b']);
  });

  it('are wiped with the data, as they measure the bets just wiped', () => {
    useBetsStore.getState().saveGoal(goal());
    useBetsStore.getState().clearAll();
    expect(useBetsStore.getState().goals).toEqual([]);
  });

  it('survive a restart', async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    useBetsStore.getState().saveGoal(goal({ note: 'план' }));
    await useBetsStore.getState().persist();
    useBetsStore.setState({ goals: [] });
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().goals).toEqual([goal({ note: 'план' })]);
    // A file from before goals existed loads with none.
    await AsyncStorage.setItem('@sharklog/data', JSON.stringify({ bets: [], version: 4 }));
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().goals).toEqual([]);
  });
});

describe('goals in the backup', () => {
  it('come back from the file, checked like everything else', () => {
    const backup = importFromJSON(JSON.stringify({
      version: 4, bets: [],
      goals: [goal(), { id: 'x', title: 'битая', kind: 'jackpot', target: 1, startDate: '2026-10-01' }],
    }))!;
    expect(backup.goals).toEqual([goal()]);
    expect(backup.dropped).toBe(1);
    // A backup from before goals: nothing to restore, nothing dropped.
    expect(importFromJSON(JSON.stringify({ version: 4, bets: [] }))!.goals).toBeUndefined();
  });
});

describe('the header button\'s short sums', () => {
  const units = { thousand: 'тыс', million: 'млн' };
  // Intl groups digits with a no-break space, as formatMoney does everywhere.
  const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');
  it('keep small sums whole and shorten big ones', () => {
    expect(plain(compactMoney(7_500_00, '$', units))).toBe('7 500 $');
    expect(compactMoney(12_345_00, '$', units)).toBe('12,3 тыс $');
    expect(compactMoney(350_000_00, '$', units)).toBe('350 тыс $');
    expect(compactMoney(1_200_000_00, '$', units)).toBe('1,2 млн $');
    expect(compactMoney(3_000_000_00, '$', units)).toBe('3 млн $');
    expect(compactMoney(-25_000_00, '$', units)).toBe('-25 тыс $');
  });

  it('never prints "1 000 тыс": that is a million', () => {
    expect(compactMoney(999_960_00, '$', units)).toBe('1 млн $');
    expect(compactMoney(999_400_00, '$', units)).toBe('999 тыс $');
  });
});

describe('what the goals screen says', () => {
  // The reality check once quoted "professionals manage 2–5%" — an unsourced
  // figure of the kind the strategy texts were cleaned of. The screen states
  // the user's own numbers; it has no business promising returns or citing them.
  const locales = ['ru', 'en', 'kz', 'by'].map((l) => require(`../i18n/locales/${l}.json`).goals as Record<string, unknown>);
  const texts = (o: unknown): string[] => (typeof o === 'string' ? [o] : Object.values(o as object).flatMap(texts));
  it('quotes no one else\'s returns and promises none', () => {
    const banned = [/\d+\s*[–-]\s*\d+\s*%/, /профессионал/i, /professional/i, /кәсіпқой/i, /прафесіянал/i, /гарант/i, /guarantee/i];
    const hits = locales.flatMap(texts).filter((t) => banned.some((re) => re.test(t)));
    expect(hits).toEqual([]);
  });
});

describe('the words around a goal', () => {
  const t = ((key: string, v: Record<string, number>) => `${key}:${JSON.stringify(v)}`) as unknown as TFunction;
  it('say a stretch of time in short units — no plural forms to get wrong', () => {
    expect(durationLabel(t, 12)).toBe('goals.dur.days:{"d":12}');
    expect(durationLabel(t, 150)).toBe('goals.dur.months:{"m":5}');
    expect(durationLabel(t, 365)).toBe('goals.dur.years:{"y":1}');
    expect(durationLabel(t, 1060)).toBe('goals.dur.yearsMonths:{"y":2,"m":11}');
  });

  it('give one percentage to the button and the card, cut down — never 100% short of the goal', () => {
    expect(goalPercent(0.117)).toBe(11);
    expect(goalPercent(0.999)).toBe(99);
    expect(goalPercent(1)).toBe(100);
    expect(goalPercent(-0.2)).toBe(0);
  });

  it('write a day the same way in every language', () => {
    expect(dayLabel('2029-11-03')).toBe('03.11.2029');
  });
});
