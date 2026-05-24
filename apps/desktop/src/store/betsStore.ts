import { create } from 'zustand';
import type { Bet, AppSettings, Bankroll, DiaryEntry, Team, Sport, EsportsDiscipline } from '@sharklog/core';
import { migrate, CURRENT_SCHEMA_VERSION, FREE_LIMITS, isInTilt } from '@sharklog/core';

const STORAGE_KEY = 'sharklog-data';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function extractTeamNames(event: string): string[] {
  for (const sep of [' vs ', ' VS ', ' — ', ' v ']) {
    if (event.includes(sep)) {
      return event.split(sep).map((s) => s.trim()).filter((s) => s.length > 1);
    }
  }
  return event.trim().length > 1 ? [event.trim()] : [];
}

function upsertTeams(
  existing: Team[],
  names: string[],
  sport: Sport,
  discipline?: EsportsDiscipline,
): Team[] {
  const result = [...existing];
  const now = new Date().toISOString();
  for (const name of names) {
    const idx = result.findIndex(
      (t) => t.name.toLowerCase() === name.toLowerCase() &&
             t.sport === sport && t.discipline === discipline,
    );
    if (idx >= 0) {
      result[idx] = { ...result[idx]!, usageCount: result[idx]!.usageCount + 1, lastUsed: now };
    } else {
      result.push({ id: uuid(), name, sport, ...(discipline !== undefined ? { discipline } : {}), usageCount: 1, lastUsed: now });
    }
  }
  return result;
}

interface BetsStore {
  bets: Bet[];
  settings: AppSettings;
  bankroll: Bankroll;
  diary: DiaryEntry[];
  teams: Team[];
  isLoaded: boolean;

  load: () => void;
  persist: () => void;

  addBet: (bet: Bet) => void;
  updateBet: (id: string, updates: Partial<Bet>) => void;
  deleteBet: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateBankroll: (updates: Partial<Bankroll>) => void;
  addDiaryEntry: (entry: DiaryEntry) => void;
  deleteTeam: (id: string) => void;
  canAddBet: () => boolean;
}

const defaultSettings: AppSettings = {
  tiltThreshold: FREE_LIMITS.TILT_ALERT_THRESHOLD,
  dailyBetLimit: 0,
  bookmakers: ['1xBet', 'Parimatch', 'Fonbet'],
  isPro: false,
  onboardingComplete: true, // desktop skips mobile onboarding
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

const defaultBankroll: Bankroll = {
  id: 'default',
  name: 'Основной банк',
  currency: 'RUB',
  unitPercent: 2,
  transactions: [],
  createdAt: new Date().toISOString(),
};

export const useBetsStore = create<BetsStore>((set, get) => ({
  bets: [],
  settings: defaultSettings,
  bankroll: defaultBankroll,
  diary: [],
  teams: [],
  isLoaded: false,

  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) { set({ isLoaded: true }); return; }
      const schema = migrate(JSON.parse(raw));
      set({
        bets: schema.bets ?? [],
        settings: { ...defaultSettings, ...schema.settings, onboardingComplete: true },
        bankroll: { ...defaultBankroll, ...schema.bankroll },
        diary: schema.diary ?? [],
        teams: schema.teams ?? [],
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  persist: () => {
    const { bets, settings, bankroll, diary, teams } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      bets, settings, bankroll, diary, teams, version: CURRENT_SCHEMA_VERSION,
    }));
  },

  addBet: (bet) => {
    const teams = upsertTeams(get().teams, extractTeamNames(bet.event), bet.sport, bet.discipline);
    set((s) => ({ bets: [bet, ...s.bets], teams }));
    get().persist();
  },

  updateBet: (id, updates) => {
    set((s) => {
      const bets = s.bets.map((b) =>
        b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b,
      );
      const updated = bets.find((b) => b.id === id);
      const teams = updated
        ? upsertTeams(s.teams, extractTeamNames(updated.event), updated.sport, updated.discipline)
        : s.teams;
      return { bets, teams };
    });
    get().persist();
  },

  deleteBet: (id) => {
    set((s) => ({ bets: s.bets.filter((b) => b.id !== id) }));
    get().persist();
  },

  updateSettings: (u) => { set((s) => ({ settings: { ...s.settings, ...u } })); get().persist(); },
  updateBankroll: (u) => { set((s) => ({ bankroll: { ...s.bankroll, ...u } })); get().persist(); },

  addDiaryEntry: (entry) => {
    set((s) => ({ diary: [entry, ...s.diary.filter((d) => d.date !== entry.date)] }));
    get().persist();
  },

  deleteTeam: (id) => {
    set((s) => ({ teams: s.teams.filter((t) => t.id !== id) }));
    get().persist();
  },

  canAddBet: () => {
    const { bets, settings } = get();
    if (settings.isPro) return true;
    return bets.length < FREE_LIMITS.MAX_BETS;
  },
}));
