import { create } from 'zustand';
import type { Bet, AppSettings, Bankroll, DiaryEntry, Team } from '@sharklog/core';
import { migrate, CURRENT_SCHEMA_VERSION, FREE_LIMITS, isInTilt, parseEventTeams, preselectedBookmakers, cleanTeamNames, upsertTeams } from '@sharklog/core';
import { loadData, saveData } from '../storage/storageService';

function uuid(): string {
  return crypto.randomUUID();
}

// Serialize all writes so rapid successive mutations can't race and clobber each other.
let writeChain: Promise<void> = Promise.resolve();

interface BetsStore {
  bets: Bet[];
  settings: AppSettings;
  bankroll: Bankroll;
  diary: DiaryEntry[];
  teams: Team[];
  isLoaded: boolean;

  load: () => Promise<void>;
  persist: () => void;

  addBet: (bet: Bet) => void;
  updateBet: (id: string, updates: Partial<Bet>) => void;
  deleteBet: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateBankroll: (updates: Partial<Bankroll>) => void;
  addDiaryEntry: (entry: DiaryEntry) => void;
  deleteTeam: (id: string) => void;
  canAddBet: () => boolean;
  clearAll: () => void;
}

const OWNER_PRO = import.meta.env.VITE_OWNER_PRO === 'true';

export const defaultSettings: AppSettings = {
  tiltThreshold: FREE_LIMITS.TILT_ALERT_THRESHOLD,
  dailyBetLimit: 0,
  bookmakers: preselectedBookmakers(),
  isPro: OWNER_PRO,
  onboardingComplete: false,
  reminderHour: 20,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  roundAmounts: false,
};

export const defaultBankroll: Bankroll = {
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

  load: async () => {
    try {
      const raw = await loadData();
      if (!raw) { set({ isLoaded: true }); return; }
      const schema = migrate(raw as Parameters<typeof migrate>[0]);
      const savedSettings = schema.settings ?? {};
      const trialExpired = savedSettings.proExpiresAt != null && new Date(savedSettings.proExpiresAt) < new Date();
      set({
        bets: schema.bets ?? [],
        settings: {
          ...defaultSettings,
          ...savedSettings,
          onboardingComplete: savedSettings.onboardingComplete ?? true,
          ...(OWNER_PRO ? { isPro: true } : {}),
          ...(trialExpired && !OWNER_PRO ? { isPro: false } : {}),
        },
        bankroll: { ...defaultBankroll, ...schema.bankroll },
        diary: schema.diary ?? [],
        teams: cleanTeamNames(schema.teams ?? []),
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  persist: () => {
    const { bets, settings, bankroll, diary, teams } = get();
    const payload = { bets, settings, bankroll, diary, teams, version: CURRENT_SCHEMA_VERSION };
    writeChain = writeChain.then(() => saveData(payload)).catch(console.error);
  },

  addBet: (bet) => {
    const teams = upsertTeams(get().teams, parseEventTeams(bet.event), bet.sport, bet.discipline, uuid);
    set((s) => ({ bets: [bet, ...s.bets], teams }));
    get().persist();
  },

  updateBet: (id, updates) => {
    set((s) => {
      const old = s.bets.find((b) => b.id === id);
      const bets = s.bets.map((b) =>
        b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b,
      );
      const updated = bets.find((b) => b.id === id);
      // Only upsert teams when event or sport actually changed — avoids inflating
      // usageCount on every status/notes edit (mirrors the mobile store guard).
      const eventChanged = updated && old && (old.event !== updated.event || old.sport !== updated.sport);
      const teams = eventChanged
        ? upsertTeams(s.teams, parseEventTeams(updated.event), updated.sport, updated.discipline, uuid)
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

  // The one wall is Free's 50 bets. Pro's daily limit is a warning in the form,
  // not a refusal: a bet already placed at the bookmaker belongs in the book.
  canAddBet: () => {
    const { bets, settings } = get();
    return settings.isPro || bets.length < FREE_LIMITS.MAX_BETS;
  },

  clearAll: () => {
    // Clear DATA only — preserve user preferences and subscription state.
    set((s) => ({
      bets: [],
      diary: [],
      teams: [],
      bankroll: { ...defaultBankroll, createdAt: new Date().toISOString() },
      settings: { ...s.settings, onboardingComplete: true },
    }));
    get().persist();
  },
}));
