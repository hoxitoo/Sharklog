import { useBetsStore, defaultSettings, defaultBankroll, effectiveTiltThreshold, effectiveDailyLimit } from '../store/betsStore';
import { sendTiltNotification } from '../utils/notifications';
import type { Bet } from '@sharklog/core';
import { toYmd } from '@sharklog/core';

function makeBet(overrides: Partial<Bet> = {}): Bet {
  const now = new Date().toISOString();
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: now,
    updatedAt: now,
    date: toYmd(new Date()),
    time: '12:00',
    sport: 'football',
    bookmaker: '1xBet',
    event: 'Team A vs Team B',
    betType: '1X2',
    pick: 'П1',
    odds: 2.0,
    stake: 100_00,
    status: 'pending',
    strategy: 'value',
    schemaVersion: 2,
    ...overrides,
  };
}

function resetStore() {
  useBetsStore.setState({
    bets: [],
    settings: { ...defaultSettings, onboardingComplete: true },
    bankroll: { ...defaultBankroll },
    diary: [],
    teams: [],
    isLoaded: true,
  });
}

beforeEach(resetStore);

// ─── canAddBet – free tier ────────────────────────────────────────────────────

describe('canAddBet – free tier', () => {
  it('allows bets below 50-bet limit', () => {
    useBetsStore.setState({ settings: { ...defaultSettings, isPro: false, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });

  it('blocks at exactly 50 bets', () => {
    const bets = Array.from({ length: 50 }, () => makeBet({ status: 'lost' }));
    useBetsStore.setState({ bets, settings: { ...defaultSettings, isPro: false, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(false);
  });

  it('PRO bypasses free 50-bet cap', () => {
    const bets = Array.from({ length: 50 }, () => makeBet({ status: 'lost' }));
    useBetsStore.setState({ bets, settings: { ...defaultSettings, isPro: true, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });
});

// ─── PRO daily limit: a warning, not a wall ──────────────────────────────────

describe('PRO daily limit', () => {
  const today = toYmd(new Date());

  it('never refuses a bet — a bet placed at the bookmaker belongs in the book', () => {
    // It used to: past the limit the "+" refused and the form would not save,
    // so a bet that was already placed could not be recorded at all.
    const bets = Array.from({ length: 5 }, () => makeBet({ date: today }));
    useBetsStore.setState({ bets, settings: { ...defaultSettings, isPro: true, dailyBetLimit: 1, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });

  it('is Pro\'s alone — a lapsed Pro keeps the setting, Free never meets it', () => {
    expect(effectiveDailyLimit({ isPro: true, dailyBetLimit: 2 })).toBe(2);
    expect(effectiveDailyLimit({ isPro: false, dailyBetLimit: 2 })).toBe(0);
  });

  it('leaves the Free cap the only wall', () => {
    const bets = Array.from({ length: 50 }, () => makeBet());
    useBetsStore.setState({ bets, settings: { ...defaultSettings, isPro: false, dailyBetLimit: 3, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(false);
  });
});

// ─── addBet ───────────────────────────────────────────────────────────────────

describe('addBet', () => {
  it('prepends to bets list', () => {
    const bet = makeBet();
    useBetsStore.getState().addBet(bet);
    expect(useBetsStore.getState().bets[0]?.id).toBe(bet.id);
    expect(useBetsStore.getState().bets).toHaveLength(1);
  });

  it('extracts two teams from "A vs B" event', () => {
    useBetsStore.getState().addBet(makeBet({ event: 'Manchester City vs Arsenal', sport: 'football' }));
    const names = useBetsStore.getState().teams.map((t) => t.name);
    expect(names).toContain('Manchester City');
    expect(names).toContain('Arsenal');
  });

  it('extracts clean team names from an express event (strips |odds and / legs)', () => {
    // Express event format: "A vs B|1.45 / C vs D|1.70"
    useBetsStore.getState().addBet(makeBet({
      event: 'Nigma vs Yellow submarine|1.45 / Reconix vs Navi|1.70',
      sport: 'esports', discipline: 'dota2', betType: 'express',
    }));
    const names = useBetsStore.getState().teams.map((t) => t.name);
    expect(names).toContain('Nigma');
    expect(names).toContain('Yellow submarine');
    expect(names).toContain('Reconix');
    expect(names).toContain('Navi');
    // No polluted entries with encoding artifacts
    expect(names.some((n) => n.includes('|') || n.includes(' / '))).toBe(false);
  });

  it('increments usageCount on repeated team usage', () => {
    useBetsStore.getState().addBet(makeBet({ event: 'NaVi vs Virtus.pro', sport: 'esports', discipline: 'csgo' }));
    useBetsStore.getState().addBet(makeBet({ event: 'NaVi vs Team Spirit', sport: 'esports', discipline: 'csgo' }));
    const navi = useBetsStore.getState().teams.find((t) => t.name === 'NaVi');
    expect(navi?.usageCount).toBe(2);
  });
});

// ─── deleteBet ────────────────────────────────────────────────────────────────

describe('deleteBet', () => {
  it('removes bet by id', () => {
    const bet = makeBet();
    useBetsStore.getState().addBet(bet);
    useBetsStore.getState().deleteBet(bet.id);
    expect(useBetsStore.getState().bets).toHaveLength(0);
  });

  it('no-op for unknown id', () => {
    useBetsStore.getState().addBet(makeBet());
    useBetsStore.getState().deleteBet('does-not-exist');
    expect(useBetsStore.getState().bets).toHaveLength(1);
  });
});

// ─── updateBet ────────────────────────────────────────────────────────────────

describe('updateBet', () => {
  it('changes status', () => {
    const bet = makeBet();
    useBetsStore.getState().addBet(bet);
    useBetsStore.getState().updateBet(bet.id, { status: 'won' });
    expect(useBetsStore.getState().bets.find((b) => b.id === bet.id)?.status).toBe('won');
  });

  it('bumps updatedAt', async () => {
    const bet = makeBet();
    useBetsStore.getState().addBet(bet);
    await new Promise((r) => setTimeout(r, 2));
    useBetsStore.getState().updateBet(bet.id, { status: 'lost' });
    const updated = useBetsStore.getState().bets.find((b) => b.id === bet.id);
    expect(updated?.updatedAt).not.toBe(bet.updatedAt);
  });

  it('keeps a field that the update simply omits', () => {
    const bet = makeBet({ status: 'cashout', cashoutAmount: 50_00 });
    useBetsStore.getState().addBet(bet);
    useBetsStore.getState().updateBet(bet.id, { status: 'won' });
    expect(useBetsStore.getState().bets.find((b) => b.id === bet.id)?.cashoutAmount).toBe(50_00);
  });

  // This is what the action wheel relies on when a bet is moved off "cashout":
  // an omitted key would leave the old amount to resurface in the editor.
  it('clears a field passed explicitly as undefined', () => {
    const bet = makeBet({ status: 'cashout', cashoutAmount: 50_00 });
    useBetsStore.getState().addBet(bet);
    useBetsStore.getState().updateBet(bet.id, { status: 'won', cashoutAmount: undefined } as Partial<Bet>);
    expect(useBetsStore.getState().bets.find((b) => b.id === bet.id)?.cashoutAmount).toBeUndefined();
  });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe('clearAll', () => {
  it('resets data but keeps onboardingComplete=true', () => {
    useBetsStore.getState().addBet(makeBet());
    useBetsStore.getState().clearAll();
    const { bets, diary, teams, settings } = useBetsStore.getState();
    expect(bets).toHaveLength(0);
    expect(diary).toHaveLength(0);
    expect(teams).toHaveLength(0);
    expect(settings.onboardingComplete).toBe(true);
  });

  it('preserves subscription and locale preferences (no silent downgrade)', () => {
    useBetsStore.getState().updateSettings({ isPro: true, language: 'en', dailyBetLimit: 7 });
    useBetsStore.getState().addBet(makeBet());
    useBetsStore.getState().clearAll();
    const { settings } = useBetsStore.getState();
    expect(settings.isPro).toBe(true);
    expect(settings.language).toBe('en');
    expect(settings.dailyBetLimit).toBe(7);
  });
});

// ─── updateSettings / updateBankroll ─────────────────────────────────────────

describe('settings and bankroll updates', () => {
  it('merges settings updates', () => {
    useBetsStore.getState().updateSettings({ tiltThreshold: 5 });
    expect(useBetsStore.getState().settings.tiltThreshold).toBe(5);
    expect(useBetsStore.getState().settings.bookmakers).toEqual(defaultSettings.bookmakers);
  });

  it('merges bankroll updates', () => {
    useBetsStore.getState().updateBankroll({ unitPercent: 3 });
    expect(useBetsStore.getState().bankroll.unitPercent).toBe(3);
    expect(useBetsStore.getState().bankroll.currency).toBe('RUB');
  });
});

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe('defaults for a new install', () => {
  it('leaves the pre-bet checklist off — it is opt-in', () => {
    expect(defaultSettings.disableChecklist).toBe(true);
  });
});

describe('a changed default does not rewrite stored settings', () => {
  it('keeps the checklist ON for settings saved before the key existed', async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const { disableChecklist: _drop, ...old } = { ...defaultSettings, onboardingComplete: true };
    await AsyncStorage.setItem('@sharklog/data', JSON.stringify({ bets: [], diary: [], teams: [], version: 3, settings: old }));
    await useBetsStore.getState().load();
    expect(useBetsStore.getState().settings.disableChecklist).toBe(false);
  });
});

// ─── tilt threshold: what Settings shows is what the app judges by ───────────

describe('effectiveTiltThreshold', () => {
  // Settings showed a lapsed Pro user 3 while the banner, the list and the
  // notification still waited for the 6 they had set as Pro.

  it('is fixed for Free and the user\'s own for Pro', () => {
    expect(effectiveTiltThreshold({ isPro: false, tiltThreshold: 6 })).toBe(3);
    expect(effectiveTiltThreshold({ isPro: true, tiltThreshold: 6 })).toBe(6);
  });

  it('decides the tilt notification', () => {
    const lose3 = () => {
      const bets = [1, 2, 3].map((n) => makeBet({ id: `l${n}`, time: `1${n}:00` }));
      useBetsStore.setState({ bets });
      for (const b of bets) useBetsStore.getState().updateBet(b.id, { status: 'lost' });
    };
    (sendTiltNotification as jest.Mock).mockClear();
    useBetsStore.setState({ settings: { ...defaultSettings, onboardingComplete: true, isPro: false, tiltThreshold: 6 } });
    lose3();
    expect(sendTiltNotification).toHaveBeenCalled();

    (sendTiltNotification as jest.Mock).mockClear();
    useBetsStore.setState({ settings: { ...defaultSettings, onboardingComplete: true, isPro: true, tiltThreshold: 6 } });
    lose3();
    expect(sendTiltNotification).not.toHaveBeenCalled();
  });

  it('is the only way screens read it — the Settings stepper edits the raw value', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const root = path.join(__dirname, '..');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__') walk(p); }
        else if (/\.tsx?$/.test(e.name)) files.push(p);
      }
    };
    walk(root);
    const raw = files.flatMap((p) => fs.readFileSync(p, 'utf8').split('\n')
      .filter((l) => /settings\.tiltThreshold/.test(l) && !/value=\{settings\.tiltThreshold\}/.test(l))
      .map((l) => `${path.relative(root, p)}: ${l.trim()}`));
    expect(raw).toEqual([]);
  });
});
