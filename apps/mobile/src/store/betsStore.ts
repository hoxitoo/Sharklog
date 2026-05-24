import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bet, AppSettings, Bankroll, DiaryEntry } from '@sharklog/core';
import { migrate, CURRENT_SCHEMA_VERSION, FREE_LIMITS } from '@sharklog/core';

const STORAGE_KEY = '@sharklog/data';

interface BetsStore {
  bets: Bet[];
  settings: AppSettings;
  bankroll: Bankroll;
  diary: DiaryEntry[];
  isLoaded: boolean;

  load: () => Promise<void>;
  persist: () => Promise<void>;

  addBet: (bet: Bet) => void;
  updateBet: (id: string, updates: Partial<Bet>) => void;
  deleteBet: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateBankroll: (updates: Partial<Bankroll>) => void;
  addDiaryEntry: (entry: DiaryEntry) => void;

  canAddBet: () => boolean;
}

const defaultSettings: AppSettings = {
  tiltThreshold: FREE_LIMITS.TILT_ALERT_THRESHOLD,
  dailyBetLimit: 0,
  bookmakers: ['1xBet', 'Parimatch', 'Fonbet'],
  isPro: false,
  onboardingComplete: false,
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
  isLoaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        set({ isLoaded: true });
        return;
      }
      const schema = migrate(JSON.parse(raw));
      set({
        bets: schema.bets ?? [],
        settings: { ...defaultSettings, ...schema.settings },
        bankroll: { ...defaultBankroll, ...schema.bankroll },
        diary: schema.diary ?? [],
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  persist: async () => {
    const { bets, settings, bankroll, diary } = get();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bets, settings, bankroll, diary, version: CURRENT_SCHEMA_VERSION }),
    );
  },

  addBet: (bet) => {
    set((s) => ({ bets: [bet, ...s.bets] }));
    get().persist();
  },

  updateBet: (id, updates) => {
    set((s) => ({
      bets: s.bets.map((b) =>
        b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b,
      ),
    }));
    get().persist();
  },

  deleteBet: (id) => {
    set((s) => ({ bets: s.bets.filter((b) => b.id !== id) }));
    get().persist();
  },

  updateSettings: (updates) => {
    set((s) => ({ settings: { ...s.settings, ...updates } }));
    get().persist();
  },

  updateBankroll: (updates) => {
    set((s) => ({ bankroll: { ...s.bankroll, ...updates } }));
    get().persist();
  },

  addDiaryEntry: (entry) => {
    set((s) => ({
      diary: [entry, ...s.diary.filter((d) => d.date !== entry.date)],
    }));
    get().persist();
  },

  canAddBet: () => {
    const { bets, settings } = get();
    if (settings.isPro) return true;
    return bets.length < FREE_LIMITS.MAX_BETS;
  },
}));
