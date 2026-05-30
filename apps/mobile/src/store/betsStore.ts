import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bet, AppSettings, Bankroll, DiaryEntry, Team, Sport, EsportsDiscipline } from '@sharklog/core';
import { migrate, CURRENT_SCHEMA_VERSION, FREE_LIMITS, isInTilt, calcDashboard } from '@sharklog/core';
import { sendTiltNotification } from '../utils/notifications';

const STORAGE_KEY = '@sharklog/data';

function uuid(): string {
  const buf = new Uint8Array(16);
  (globalThis.crypto as Crypto).getRandomValues(buf);
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  let s = '';
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
    s += buf[i]!.toString(16).padStart(2, '0');
  }
  return s;
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
             t.sport === sport &&
             t.discipline === discipline,
    );
    if (idx >= 0) {
      result[idx] = { ...result[idx]!, usageCount: (result[idx]!.usageCount) + 1, lastUsed: now };
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

  load: () => Promise<void>;
  persist: () => Promise<void>;

  addBet: (bet: Bet) => void;
  updateBet: (id: string, updates: Partial<Bet>) => void;
  deleteBet: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateBankroll: (updates: Partial<Bankroll>) => void;
  addDiaryEntry: (entry: DiaryEntry) => void;
  deleteTeam: (id: string) => void;
  clearAll: () => void;

  canAddBet: () => boolean;
}

const IS_OWNER_PRO = process.env.EXPO_PUBLIC_OWNER_PRO === 'true';

export const defaultSettings: AppSettings = {
  tiltThreshold: FREE_LIMITS.TILT_ALERT_THRESHOLD,
  dailyBetLimit: 0,
  bookmakers: ['1xBet', 'Parimatch', 'Fonbet'],
  isPro: IS_OWNER_PRO,
  onboardingComplete: false,
  reminderHour: 20,
  schemaVersion: CURRENT_SCHEMA_VERSION,
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
        teams: schema.teams ?? [],
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  persist: async () => {
    const { bets, settings, bankroll, diary, teams } = get();
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bets, settings, bankroll, diary, teams, version: CURRENT_SCHEMA_VERSION }),
    );
  },

  addBet: (bet) => {
    const names = extractTeamNames(bet.event);
    const updatedTeams = upsertTeams(get().teams, names, bet.sport, bet.discipline);
    set((s) => ({ bets: [bet, ...s.bets], teams: updatedTeams }));
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
    // Fire tilt notification after state update so we work with final bets array
    if (updates.status === 'lost') {
      const { bets, settings } = get();
      if (isInTilt(bets, settings.tiltThreshold)) {
        sendTiltNotification(calcDashboard(bets).currentStreak.count);
      }
    }
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

  deleteTeam: (id) => {
    set((s) => ({ teams: s.teams.filter((t) => t.id !== id) }));
    get().persist();
  },

  clearAll: () => {
    set({
      bets: [],
      diary: [],
      teams: [],
      bankroll: { ...defaultBankroll, createdAt: new Date().toISOString() },
      settings: { ...defaultSettings, onboardingComplete: true },
    });
    get().persist();
  },

  canAddBet: () => {
    const { bets, settings } = get();
    if (!settings.isPro) return bets.length < FREE_LIMITS.MAX_BETS;
    if (settings.dailyBetLimit > 0) {
      const today = new Date().toISOString().split('T')[0] ?? '';
      const todayCount = bets.filter((b) => b.date === today).length;
      if (todayCount >= settings.dailyBetLimit) return false;
    }
    return true;
  },
}));
