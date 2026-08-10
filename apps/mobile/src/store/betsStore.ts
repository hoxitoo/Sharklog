import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bet, AppSettings, Bankroll, DiaryEntry, Team, Sport, EsportsDiscipline } from '@sharklog/core';
import { migrate, CURRENT_SCHEMA_VERSION, FREE_LIMITS, isInTilt, calcDashboard, parseEventTeams, toYmd } from '@sharklog/core';
import {
  sendTiltNotification, scheduleBetResultReminder,
  cancelBetResultReminder, cancelAllBetResultReminders,
} from '../utils/notifications';

const STORAGE_KEY = '@sharklog/data';

// Serialize all writes through a single chain so rapid successive mutations
// (e.g. quick W/L taps) can't race and clobber each other's snapshot.
let writeChain: Promise<void> = Promise.resolve();

function uuid(): string {
  const c = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    buf[6] = (buf[6]! & 0x0f) | 0x40;
    buf[8] = (buf[8]! & 0x3f) | 0x80;
    let s = '';
    for (let i = 0; i < 16; i++) {
      if (i === 4 || i === 6 || i === 8 || i === 10) s += '-';
      s += buf[i]!.toString(16).padStart(2, '0');
    }
    return s;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Extract clean team names from an event string. Delegates to the shared core
// parser so express events ("A vs B|1.45 / C vs D|1.70") yield individual team
// names instead of the raw encoded string (pipe odds + " / " leg separators).
function extractTeamNames(event: string): string[] {
  return parseEventTeams(event);
}

// A clean team name never contains the express encoding chars. Drop entries that
// were polluted by the old extractTeamNames (e.g. "Yellow submarine|1.45 / Reconix").
function sanitizeTeams(teams: Team[]): Team[] {
  return teams.filter((t) => !t.name.includes('|') && !t.name.includes(' / '));
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
  roundAmounts: false,
  disableChecklist: false,
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
      const savedSettings = schema.settings ?? {};
      // Expire a lapsed free-trial / subscription so PRO gates don't stay open forever.
      const trialExpired = savedSettings.proExpiresAt != null
        && new Date(savedSettings.proExpiresAt) < new Date();
      set({
        bets: schema.bets ?? [],
        settings: {
          ...defaultSettings,
          ...savedSettings,
          // Existing users (data already present) shouldn't be re-onboarded on upgrade.
          onboardingComplete: savedSettings.onboardingComplete ?? true,
          ...(trialExpired && !IS_OWNER_PRO ? { isPro: false } : {}),
        },
        bankroll: { ...defaultBankroll, ...schema.bankroll },
        diary: schema.diary ?? [],
        teams: sanitizeTeams(schema.teams ?? []),
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  persist: async () => {
    const { bets, settings, bankroll, diary, teams } = get();
    const payload = JSON.stringify({ bets, settings, bankroll, diary, teams, version: CURRENT_SCHEMA_VERSION });
    writeChain = writeChain.then(() => AsyncStorage.setItem(STORAGE_KEY, payload)).catch(() => {});
    return writeChain;
  },

  addBet: (bet) => {
    const names = extractTeamNames(bet.event);
    const updatedTeams = upsertTeams(get().teams, names, bet.sport, bet.discipline);
    set((s) => ({ bets: [bet, ...s.bets], teams: updatedTeams }));
    if (bet.status === 'pending' && get().settings.betResultReminders !== false) {
      scheduleBetResultReminder(bet);
    }
    get().persist();
  },

  updateBet: (id, updates) => {
    const prevStatus = get().bets.find((b) => b.id === id)?.status;
    set((s) => {
      const old = s.bets.find((b) => b.id === id);
      const bets = s.bets.map((b) =>
        b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b,
      );
      const updated = bets.find((b) => b.id === id);
      // Only upsert teams when event or sport actually changed to avoid inflating usageCount
      const eventChanged = updated && old && (old.event !== updated.event || old.sport !== updated.sport);
      const teams = eventChanged
        ? upsertTeams(s.teams, extractTeamNames(updated.event), updated.sport, updated.discipline)
        : s.teams;
      return { bets, teams };
    });
    // Fire tilt notification only on a real transition INTO lost (not on re-saving an
    // already-lost bet), after the state update so we work with the final bets array.
    // Keep the settle reminder in sync: drop it once settled, re-arm if the bet
    // went back to pending or its kick-off moved.
    const after = get().bets.find((b) => b.id === id);
    if (after) {
      if (after.status !== 'pending') cancelBetResultReminder(id);
      else if (get().settings.betResultReminders !== false) scheduleBetResultReminder(after);
    }

    if (updates.status === 'lost' && prevStatus !== 'lost') {
      const { bets, settings } = get();
      if (isInTilt(bets, settings.tiltThreshold)) {
        sendTiltNotification(calcDashboard(bets).currentStreak.count);
      }
    }
    get().persist();
  },

  deleteBet: (id) => {
    cancelBetResultReminder(id);
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
    cancelAllBetResultReminders();
    // Clear DATA only — preserve user preferences and subscription state. Wiping
    // bets must not silently downgrade a PRO user or reset their language/bookmakers.
    set((s) => ({
      bets: [],
      diary: [],
      teams: [],
      bankroll: { ...defaultBankroll, createdAt: new Date().toISOString() },
      settings: { ...s.settings, onboardingComplete: true },
    }));
    get().persist();
  },

  canAddBet: () => {
    const { bets, settings } = get();
    if (!settings.isPro) return bets.length < FREE_LIMITS.MAX_BETS;
    if (settings.dailyBetLimit > 0) {
      const today = toYmd(new Date()); // local day — the daily limit must roll at local midnight
      const todayCount = bets.filter((b) => b.date === today).length;
      if (todayCount >= settings.dailyBetLimit) return false;
    }
    return true;
  },
}));
