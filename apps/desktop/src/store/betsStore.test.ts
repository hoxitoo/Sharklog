import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBetsStore, defaultSettings, defaultBankroll } from './betsStore';
import type { Bet } from '@sharklog/core';

function makeBet(overrides: Partial<Bet> = {}): Bet {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    date: new Date().toISOString().split('T')[0]!,
    time: '12:00',
    sport: 'football',
    bookmaker: '1xBet',
    event: 'Team A vs Team B',
    betType: '1X2',
    pick: 'П1',
    odds: 2.0,
    stake: 100_00,     // 100 ₽
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

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

// ─── canAddBet ────────────────────────────────────────────────────────────────

describe('canAddBet – free tier', () => {
  it('allows bets below the 50-bet limit', () => {
    useBetsStore.setState({ settings: { ...defaultSettings, isPro: false, onboardingComplete: true } });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });

  it('blocks when exactly 50 bets exist', () => {
    const bets = Array.from({ length: 50 }, () => makeBet({ status: 'lost' }));
    useBetsStore.setState({
      bets,
      settings: { ...defaultSettings, isPro: false, onboardingComplete: true },
    });
    expect(useBetsStore.getState().canAddBet()).toBe(false);
  });

  it('does not block PRO user at 50 bets', () => {
    const bets = Array.from({ length: 50 }, () => makeBet({ status: 'lost' }));
    useBetsStore.setState({
      bets,
      settings: { ...defaultSettings, isPro: true, onboardingComplete: true },
    });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });
});

describe('canAddBet – PRO daily limit', () => {
  const today = new Date().toISOString().split('T')[0]!;

  it('allows first bet of the day when limit is 5', () => {
    useBetsStore.setState({
      settings: { ...defaultSettings, isPro: true, dailyBetLimit: 5, onboardingComplete: true },
    });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });

  it('blocks when daily limit is reached', () => {
    const bets = Array.from({ length: 5 }, () => makeBet({ date: today }));
    useBetsStore.setState({
      bets,
      settings: { ...defaultSettings, isPro: true, dailyBetLimit: 5, onboardingComplete: true },
    });
    expect(useBetsStore.getState().canAddBet()).toBe(false);
  });

  it('does not count yesterday bets against today limit', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;
    const bets = Array.from({ length: 5 }, () => makeBet({ date: yesterday }));
    useBetsStore.setState({
      bets,
      settings: { ...defaultSettings, isPro: true, dailyBetLimit: 5, onboardingComplete: true },
    });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });

  it('allows unlimited bets when dailyBetLimit is 0', () => {
    const bets = Array.from({ length: 100 }, () => makeBet({ date: today }));
    useBetsStore.setState({
      bets,
      settings: { ...defaultSettings, isPro: true, dailyBetLimit: 0, onboardingComplete: true },
    });
    expect(useBetsStore.getState().canAddBet()).toBe(true);
  });
});

// ─── addBet / deleteBet ───────────────────────────────────────────────────────

describe('addBet', () => {
  it('prepends the bet to the list', () => {
    const bet = makeBet();
    useBetsStore.getState().addBet(bet);
    const { bets } = useBetsStore.getState();
    expect(bets[0]?.id).toBe(bet.id);
    expect(bets).toHaveLength(1);
  });

  it('extracts teams from "A vs B" event', () => {
    const bet = makeBet({ event: 'Manchester City vs Arsenal', sport: 'football' });
    useBetsStore.getState().addBet(bet);
    const { teams } = useBetsStore.getState();
    expect(teams.map((t) => t.name)).toContain('Manchester City');
    expect(teams.map((t) => t.name)).toContain('Arsenal');
  });

  it('increments team usageCount on repeated use', () => {
    const bet1 = makeBet({ event: 'NaVi vs Virtus.pro', sport: 'esports', discipline: 'csgo' });
    const bet2 = makeBet({ event: 'NaVi vs Team Vitality', sport: 'esports', discipline: 'csgo' });
    useBetsStore.getState().addBet(bet1);
    useBetsStore.getState().addBet(bet2);
    const navi = useBetsStore.getState().teams.find((t) => t.name === 'NaVi');
    expect(navi?.usageCount).toBe(2);
  });
});

describe('deleteBet', () => {
  it('removes the bet by id', () => {
    const bet = makeBet();
    useBetsStore.getState().addBet(bet);
    useBetsStore.getState().deleteBet(bet.id);
    expect(useBetsStore.getState().bets).toHaveLength(0);
  });

  it('is a no-op for unknown id', () => {
    const bet = makeBet();
    useBetsStore.getState().addBet(bet);
    useBetsStore.getState().deleteBet('non-existent-id');
    expect(useBetsStore.getState().bets).toHaveLength(1);
  });
});

// ─── updateBet ────────────────────────────────────────────────────────────────

describe('updateBet', () => {
  it('updates status and bumps updatedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    const bet = makeBet();
    useBetsStore.getState().addBet(bet);
    vi.setSystemTime(new Date('2024-01-01T12:00:01.000Z'));
    useBetsStore.getState().updateBet(bet.id, { status: 'won' });
    const updated = useBetsStore.getState().bets.find((b) => b.id === bet.id);
    expect(updated?.status).toBe('won');
    expect(updated?.updatedAt).not.toBe(bet.updatedAt);
    vi.useRealTimers();
  });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe('clearAll', () => {
  it('resets bets, diary, teams while preserving onboardingComplete', () => {
    useBetsStore.getState().addBet(makeBet());
    useBetsStore.getState().clearAll();
    const { bets, diary, teams, settings } = useBetsStore.getState();
    expect(bets).toHaveLength(0);
    expect(diary).toHaveLength(0);
    expect(teams).toHaveLength(0);
    expect(settings.onboardingComplete).toBe(true);
  });
});
