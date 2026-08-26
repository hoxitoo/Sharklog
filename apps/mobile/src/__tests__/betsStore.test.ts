import { useBetsStore, defaultSettings, defaultBankroll } from '../store/betsStore';
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

// ─── canAddBet – PRO daily limit ─────────────────────────────────────────────

describe('canAddBet – PRO daily limit', () => {
  const today = toYmd(new Date());

  it('allows first bet of the day when limit is 5', () => {
    useBetsStore.setState({ settings: { ...defaultSettings, isPro: true, dailyBetLimit: 5, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });

  it('blocks when daily limit reached', () => {
    const bets = Array.from({ length: 5 }, () => makeBet({ date: today }));
    useBetsStore.setState({ bets, settings: { ...defaultSettings, isPro: true, dailyBetLimit: 5, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(false);
  });

  it('ignores yesterday bets for today limit', () => {
    const yesterday = toYmd(new Date(Date.now() - 86_400_000));
    const bets = Array.from({ length: 5 }, () => makeBet({ date: yesterday }));
    useBetsStore.setState({ bets, settings: { ...defaultSettings, isPro: true, dailyBetLimit: 5, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });

  it('unlimited when dailyBetLimit is 0', () => {
    const bets = Array.from({ length: 100 }, () => makeBet({ date: today }));
    useBetsStore.setState({ bets, settings: { ...defaultSettings, isPro: true, dailyBetLimit: 0, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
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
