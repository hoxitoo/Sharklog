import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bet, AppSettings, Bankroll, DiaryEntry, Goal, Team, Sport, EsportsDiscipline } from '@sharklog/core';
import {
  migrate, CURRENT_SCHEMA_VERSION, FREE_LIMITS, DEFAULT_BANKROLL_NAME, isInTilt, calcDashboard, parseEventTeams,
  preselectedBookmakers, sanitizeBets, sanitizeBankroll, sanitizeDiary, sanitizeTeams, sanitizeGoals,
} from '@sharklog/core';
import {
  sendTiltNotification, scheduleBetResultReminder,
  cancelBetResultReminder, cancelAllBetResultReminders,
} from '../utils/notifications';
import { verifyLicense, resolvePro, trialEnd, extractLicense, hasLicense, readLicense, type LicensePayload } from '../utils/license';
import { BILLING, LICENSE_PUBKEY } from '../services/billing';
import { distribution } from '../utils/storeLinks';
import {
  STORAGE_KEY, pieceKey, parsePieceKey, buildSave, recordPieces, assembleGeneration, parsePiece, generationsOnDisk,
} from '../utils/storageLayout';

/** The stored file as it was, when loading had to leave records out. */
const QUARANTINE_KEY = '@sharklog/data_quarantine';

/**
 * Keep a damaged file: its main record under a quarantine key, its bets pieces
 * (null — a piece that was missing) next to it as `<key>#<i>`. Never over an
 * earlier copy: a second damage event must not overwrite the first. And never
 * the same file twice: the damaged file stays until the app next writes, and a
 * launch that only reads would otherwise add a full copy each time.
 */
function quarantine(main: string, pieces: readonly (string | null)[] = []): void {
  (async () => {
    const keys = (await AsyncStorage.getAllKeys())
      .filter((k) => k === QUARANTINE_KEY || k.startsWith(`${QUARANTINE_KEY}:`));
    const bases = keys.filter((k) => !k.includes('#'));
    const copies = await AsyncStorage.getMany(bases);
    for (const base of bases) {
      if (copies[base] !== main) continue;
      if (pieces.length === 0) return;
      const saved = await AsyncStorage.getMany(pieces.map((_, i) => `${base}#${i}`));
      if (pieces.every((p, i) => (saved[`${base}#${i}`] ?? null) === p)) return;
    }
    const base = keys.includes(QUARANTINE_KEY) ? `${QUARANTINE_KEY}:${Date.now()}` : QUARANTINE_KEY;
    const entries: Record<string, string> = { [base]: main };
    pieces.forEach((p, i) => { if (p !== null) entries[`${base}#${i}`] = p; });
    await AsyncStorage.setMany(entries);
  })().catch(() => {});
}

// Serialize all writes through a single chain so rapid successive mutations
// (e.g. quick W/L taps) can't race and clobber each other's snapshot.
let writeChain: Promise<void> = Promise.resolve();

/**
 * The newest bets generation on disk or written this session. Each save takes
 * the next one, so its pieces never land on keys a reader may be using
 * (storageLayout.ts, "Why generations").
 */
let lastGen = 0;
/** Whether the last save reached the disk — for a caller that must know (a paid licence). */
let lastWriteOk = true;

/** The texts of a generation's pieces, in index order (null — missing). */
async function readGeneration(gen: number, count: number): Promise<(string | null)[]> {
  if (count === 0) return [];
  const keys = Array.from({ length: count }, (_, i) => pieceKey(gen, i));
  const got = await AsyncStorage.getMany(keys);
  return keys.map((k) => got[k] ?? null);
}

/**
 * The newest generation on disk that is whole — the bets when the main record
 * cannot name them (lost, unreadable, or rewritten by an older build that
 * knows no pieces). Every piece carries its generation's piece count.
 */
async function newestWholeGeneration(keys: readonly string[]): Promise<{ texts: (string | null)[]; bets: unknown[] } | null> {
  for (const { gen, indices } of generationsOnDisk(keys)) {
    const first = parsePiece((await readGeneration(gen, 1))[0] ?? null);
    if (!first || first.n === 0 || indices.length < first.n) continue;
    const texts = await readGeneration(gen, first.n);
    const { bets, whole } = assembleGeneration(gen, texts);
    if (whole) return { texts, bets };
  }
  return null;
}

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
function sanitizeTeamNames(teams: Team[]): Team[] {
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
  /** The user's goals, in their order: the first active one is on the bets screen's header. */
  goals: Goal[];
  isLoaded: boolean;
  /**
   * The stored data could not be READ (not "there is none"). The app shows an
   * error screen and writes nothing: starting empty, as it used to, let the
   * first save — onboarding's — replace the real file.
   */
  loadError: boolean;

  load: () => Promise<void>;
  persist: () => Promise<void>;
  /** Waits for the saves queued so far; true when the last of them reached the disk. */
  flush: () => Promise<boolean>;

  addBet: (bet: Bet) => void;
  updateBet: (id: string, updates: Partial<Bet>) => void;
  deleteBet: (id: string) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateBankroll: (updates: Partial<Bankroll>) => void;
  addDiaryEntry: (entry: DiaryEntry) => void;
  deleteTeam: (id: string) => void;
  /** Add a goal (to the end) or replace the one with its id. */
  saveGoal: (goal: Goal) => void;
  deleteGoal: (id: string) => void;
  /** Move a goal to the front: the header button shows the first active one. */
  makeMainGoal: (id: string) => void;
  clearAll: () => void;

  /**
   * Room for one more bet: false only when Free has used its 50. Pro's daily
   * limit is NOT a wall — the form warns past it (`effectiveDailyLimit`) and saves.
   */
  canAddBet: () => boolean;

  /**
   * Recompute Pro from every source (licence, trial, store). `storeEntitled` is
   * what RevenueCat answered — null when it was not asked or not reached.
   */
  refreshPro: (storeEntitled?: boolean | null) => void;
  /** Store a licence if it checks out; false (and nothing changed) if it does not. */
  applyLicense: (token: string) => boolean;
  /**
   * The server revoked this invoice's licence (a refund): drop the licence if it
   * is the stored one, remember the number, recompute Pro.
   */
  revokeLicense: (invoiceId: string) => void;
  /** The server says this invoice is fine again (a mistaken revoke undone): accept its code. */
  forgetRevocation: (invoiceId: string) => void;
  /** Seven days of Pro for a new user. Never twice, never over a licence. */
  startTrial: () => void;
}

const IS_OWNER_PRO = process.env.EXPO_PUBLIC_OWNER_PRO === 'true';

/**
 * Only the store build (RevenueCat) has a Pro that can sit in the cached flag
 * with nothing behind it — an offline launch of a subscriber. In the Robokassa
 * build Pro is a licence, the trial or the owner build; see resolvePro.
 */
const KEEP_CACHED_PRO = BILLING === 'revenuecat';

/** Test-mode licences are for builds installed by hand (testers, the owner), never a store build. */
const ACCEPTS_TEST_LICENSES = distribution() === 'direct';

/**
 * The payload of a pasted code if it is a licence THIS build accepts (signed
 * by our key; a test licence only in a hand-installed build) — revocation aside.
 */
export function verifyCode(text: string): LicensePayload | null {
  return verifyLicense(extractLicense(text), LICENSE_PUBKEY, new Date(), { allowTest: ACCEPTS_TEST_LICENSES });
}

/**
 * Whether a stored licence counts on this build: licence-shaped, not a test
 * licence carried into a store build (installed over a test build), not revoked.
 */
function licenseCounts(token: string | undefined, revoked: readonly string[] | undefined): token is string {
  if (!hasLicense(token)) return false;
  const p = readLicense(token);
  if (!p) return false;
  if (p.test && !ACCEPTS_TEST_LICENSES) return false;
  // Expiry is checked on every launch, not only on the way in: a 30-day test
  // licence (and a subscription later) must run out on a phone that keeps it.
  if (p.exp !== undefined && p.exp * 1000 <= Date.now()) return false;
  return !(revoked ?? []).includes(p.id);
}

export const defaultSettings: AppSettings = {
  tiltThreshold: FREE_LIMITS.TILT_ALERT_THRESHOLD,
  dailyBetLimit: 0,
  bookmakers: preselectedBookmakers(),
  isPro: IS_OWNER_PRO,
  onboardingComplete: false,
  reminderHour: 20,
  schemaVersion: CURRENT_SCHEMA_VERSION,
  roundAmounts: false,
  // Off for a new install: the pre-bet checklist is opt-in. New users are Pro
  // for their first seven days, and a five-question gate on the very first bet
  // was the first thing they met. Stored settings keep whatever they hold.
  disableChecklist: true,
};

/**
 * The hour the daily reminder actually fires at. Free is fixed to the default;
 * only Pro picks. A lapsed Pro user keeps their old `reminderHour` in settings,
 * and reading it raw made the Settings row say 20:00 while the reminder kept
 * arriving at 09:00. Everything that SHOWS or SCHEDULES the hour goes through here.
 */
export function effectiveReminderHour(s: Pick<AppSettings, 'isPro' | 'reminderHour'>): number {
  return s.isPro ? s.reminderHour : defaultSettings.reminderHour;
}

/**
 * The losing streak that counts as tilt. Free is fixed at 3; only Pro sets it.
 * Settings showed 3 to a lapsed Pro user while the banner, the list and the
 * notification still used the threshold they had set as Pro — the same split
 * as the reminder hour. Everything that SHOWS or JUDGES tilt goes through here.
 */
export function effectiveTiltThreshold(s: Pick<AppSettings, 'isPro' | 'tiltThreshold'>): number {
  return s.isPro ? s.tiltThreshold : FREE_LIMITS.TILT_ALERT_THRESHOLD;
}

/**
 * Bets a day before the form WARNS: Pro's own limit, 0 = none. A warning, not a
 * wall: a bet already placed at the bookmaker belongs in the book, and refusing
 * it made the tracker lie. Free has the 50-bet cap instead.
 */
export function effectiveDailyLimit(s: Pick<AppSettings, 'isPro' | 'dailyBetLimit'>): number {
  return s.isPro ? s.dailyBetLimit : 0;
}

/**
 * Pro that was BOUGHT — a licence, or store / older-build Pro with no trial
 * date behind it. (A stored licence was verified on the way in: hasLicense.) Not the same as `isPro`: a trial user is Pro and still has
 * to be offered the purchase. Used where the screen must tell the two apart.
 */
export function ownsPro(s: Pick<AppSettings, 'isPro' | 'license' | 'proExpiresAt'>): boolean {
  return hasLicense(s.license) || (s.isPro && !s.proExpiresAt);
}

export const defaultBankroll: Bankroll = {
  id: 'default',
  name: DEFAULT_BANKROLL_NAME,
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
  goals: [],
  isLoaded: false,
  loadError: false,

  load: async () => {
    // Read first; decide after. A failed READ is not "no data": writes stay
    // blocked (persist checks loadError) until a retry reads it — the app used
    // to start empty here, and its first save (onboarding's) replaced the file.
    let raw: string | null;
    let keys: string[];
    try {
      raw = await AsyncStorage.getItem(STORAGE_KEY);
      keys = await AsyncStorage.getAllKeys();
    } catch {
      set({ loadError: true });
      return;
    }
    try {
      const onDisk = generationsOnDisk(keys);
      let record: Record<string, unknown> | null = null;
      // The record exists but is not readable JSON (a crash mid-write).
      let recordBroken = false;
      if (raw !== null) {
        try {
          const p: unknown = JSON.parse(raw);
          if (typeof p === 'object' && p !== null && !Array.isArray(p)) record = p as Record<string, unknown>;
          else recordBroken = true;
        } catch {
          recordBroken = true;
        }
      }
      let damaged = recordBroken;
      let pieces: (string | null)[] = [];
      let parsed: Record<string, unknown>;
      const named = record ? recordPieces(record) : null;
      if (named) {
        // The usual case: the record names its generation; it must be whole.
        pieces = await readGeneration(named.gen, named.chunks);
        const { bets, whole } = assembleGeneration(named.gen, pieces, named.count);
        if (!whole) damaged = true;
        parsed = { ...record, bets };
      } else {
        // No record that names pieces: the old single-key layout, a record
        // lost or unreadable, or one an older build rewrote without them. If
        // pieces are on disk, their bets are kept alongside the record's;
        // sanitize keeps the later edit of a bet that is in both.
        const found = onDisk.length > 0 ? await newestWholeGeneration(keys) : null;
        if (found) {
          pieces = found.texts;
        } else if (onDisk.length > 0) {
          // Pieces, none of them whole: keep the newest set for support — the
          // next save would remove them.
          damaged = true;
          const newest = onDisk[0]!;
          pieces = await readGeneration(newest.gen, Math.max(...newest.indices) + 1);
        }
        if (raw === null && !found && onDisk.length === 0) {
          // A fresh install.
          lastGen = 0;
          set({ isLoaded: true, loadError: false });
          return;
        }
        const own = record?.['bets'];
        parsed = {
          ...(record ?? {}),
          bets: found ? [...(Array.isArray(own) ? own : []), ...found.bets] : own,
        };
        if (!record && !(found && found.bets.length > 0)) {
          // Nothing readable at all: start as a new install did — but the
          // damaged file is kept first.
          if (raw !== null || pieces.length > 0) quarantine(raw ?? '', pieces);
          lastGen = onDisk[0]?.gen ?? 0;
          set({ isLoaded: true, loadError: false });
          return;
        }
        if (!record) parsed['settings'] = { onboardingComplete: true };
      }
      lastGen = Math.max(named?.gen ?? 0, onDisk[0]?.gen ?? 0);
      // A list that is not a list is damage too, even before anything is dropped.
      const shapeBroken = (['bets', 'diary', 'teams', 'goals'] as const).some((k) => {
        const v = parsed[k];
        return v !== undefined && !Array.isArray(v);
      });
      const schema = migrate(parsed as Parameters<typeof migrate>[0]);
      const savedSettings: Partial<AppSettings> = schema.settings ?? {};
      // A licence that does not count on this build (a test licence in a store
      // build, a revoked one) is dropped, not just ignored.
      const { license: storedLicense, ...savedRest } = savedSettings;
      const license = licenseCounts(storedLicense, savedSettings.revokedLicenses) ? storedLicense : undefined;
      // The stored flag is a cache. Pro is decided again on every launch from
      // what can actually grant it: a run-out trial closes the gates. (The
      // licence was verified when it was stored — see hasLicense.)
      const isPro = resolvePro({
        owner: IS_OWNER_PRO,
        licenseValid: license !== undefined,
        trialEndsAt: savedSettings.proExpiresAt,
        storeEntitled: null,
        previous: savedSettings.isPro ?? false,
        keepCached: KEEP_CACHED_PRO,
      });
      // Only what would crash a screen is dropped (sanitize.ts, 'stored' mode);
      // anything the app wrote loosely in an older version stays as it was.
      const bets = sanitizeBets(schema.bets, 'stored');
      const bank = sanitizeBankroll(schema.bankroll);
      const diary = sanitizeDiary(schema.diary, 'stored');
      const teams = sanitizeTeams(schema.teams);
      const goals = sanitizeGoals(schema.goals, 'stored');
      if (damaged || shapeBroken || bets.dropped + bank.dropped + diary.dropped + teams.dropped + goals.dropped > 0) {
        // The next write would make the loss final: keep the file as it was,
        // so support can still get those records back.
        quarantine(raw ?? '', pieces);
      }
      set({
        bets: bets.items,
        settings: {
          ...defaultSettings,
          ...savedRest,
          ...(license !== undefined ? { license } : {}),
          // Existing users (data already present) shouldn't be re-onboarded on upgrade.
          onboardingComplete: savedSettings.onboardingComplete ?? true,
          // Settings saved before the key existed meant "checklist on"; the new
          // default (off) is for new installs only, not a change to theirs.
          disableChecklist: savedSettings.disableChecklist ?? false,
          isPro,
        },
        bankroll: { ...defaultBankroll, ...bank.bankroll },
        diary: diary.items,
        teams: sanitizeTeamNames(teams.items),
        goals: goals.items,
        isLoaded: true,
        loadError: false,
      });
    } catch {
      // Something failed AFTER the read — a bug in migration or sanitizing.
      // Not a reason to start empty over data that is there: keep writes off.
      set({ loadError: true });
    }
  },

  persist: async () => {
    const { bets, settings, bankroll, diary, teams, goals, isLoaded, loadError } = get();
    // Never before a load has succeeded: the state is then the empty default,
    // and writing it would replace data that is on disk but was not read.
    if (!isLoaded || loadError) return writeChain;
    const gen = ++lastGen;
    const { pieces, record } = buildSave({ bets, settings, bankroll, diary, teams, goals, version: CURRENT_SCHEMA_VERSION }, gen);
    writeChain = writeChain.then(async () => {
      lastWriteOk = false;
      // 1. The new pieces, under keys no reader uses yet.
      if (Object.keys(pieces).length > 0) await AsyncStorage.setMany(pieces);
      // 2. The record that names them. Until this lands, the old one names
      //    the old pieces, which are all still there.
      await AsyncStorage.setItem(STORAGE_KEY, record);
      lastWriteOk = true;
      // 3. Only now is every other generation garbage.
      const old = (await AsyncStorage.getAllKeys()).filter((k) => {
        const p = parsePieceKey(k);
        return p !== null && p.gen !== gen;
      });
      if (old.length > 0) await AsyncStorage.removeMany(old);
    }).catch(() => {});
    return writeChain;
  },

  flush: () => writeChain.then(() => lastWriteOk),

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
      if (isInTilt(bets, effectiveTiltThreshold(settings))) {
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

  saveGoal: (goal) => {
    set((s) => ({
      goals: s.goals.some((g) => g.id === goal.id)
        ? s.goals.map((g) => (g.id === goal.id ? goal : g))
        : [...s.goals, goal],
    }));
    get().persist();
  },

  deleteGoal: (id) => {
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    get().persist();
  },

  makeMainGoal: (id) => {
    set((s) => {
      const g = s.goals.find((x) => x.id === id);
      return g ? { goals: [g, ...s.goals.filter((x) => x.id !== id)] } : {};
    });
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
      // Goals are data, measured against the bets just wiped.
      goals: [],
      bankroll: { ...defaultBankroll, createdAt: new Date().toISOString() },
      settings: { ...s.settings, onboardingComplete: true },
    }));
    get().persist();
  },

  refreshPro: (storeEntitled = null) => {
    const { settings } = get();
    const isPro = resolvePro({
      owner: IS_OWNER_PRO,
      licenseValid: licenseCounts(settings.license, settings.revokedLicenses),
      trialEndsAt: settings.proExpiresAt,
      storeEntitled,
      previous: settings.isPro,
      keepCached: KEEP_CACHED_PRO,
    });
    // A store purchase outlives the trial it may have started in: drop the
    // trial date, or an offline launch after the trial would read as "ran out".
    const clearTrial = storeEntitled === true && settings.proExpiresAt !== undefined;
    if (isPro === settings.isPro && !clearTrial) return;
    set((s) => {
      // Omitted, not set to undefined: exactOptionalPropertyTypes.
      const { proExpiresAt: _trial, ...rest } = s.settings;
      return { settings: clearTrial ? { ...rest, isPro } : { ...s.settings, isPro } };
    });
    get().persist();
  },

  applyLicense: (text) => {
    // The ONE place a licence enters the device — so the one place it is verified.
    const token = extractLicense(text);
    const payload = verifyCode(token);
    if (payload === null) return false;
    // Refunded: the same code from the user's Telegram must not bring Pro back,
    // online or off.
    if ((get().settings.revokedLicenses ?? []).includes(payload.id)) return false;
    set((s) => {
      // Bought: the trial date no longer means anything (omitted, not undefined).
      const { proExpiresAt: _trial, ...rest } = s.settings;
      return { settings: { ...rest, license: token, isPro: true } };
    });
    get().persist();
    return true;
  },

  revokeLicense: (invoiceId) => {
    set((s) => {
      const revoked = s.settings.revokedLicenses ?? [];
      const { license, ...rest } = s.settings;
      const drop = readLicense(license)?.id === invoiceId;
      return {
        settings: {
          ...(drop ? rest : s.settings),
          revokedLicenses: revoked.includes(invoiceId) ? revoked : [...revoked, invoiceId],
          // Whatever the licence held is gone; refreshPro asks the other sources.
          ...(drop ? { isPro: false } : {}),
        },
      };
    });
    get().refreshPro(null);
    get().persist();
  },

  forgetRevocation: (invoiceId) => {
    const revoked = get().settings.revokedLicenses ?? [];
    if (!revoked.includes(invoiceId)) return;
    set((s) => ({ settings: { ...s.settings, revokedLicenses: revoked.filter((id) => id !== invoiceId) } }));
    get().persist();
  },

  startTrial: () => {
    const { settings } = get();
    if (settings.proExpiresAt || settings.license || settings.isPro) return;
    set((s) => ({ settings: { ...s.settings, isPro: true, proExpiresAt: trialEnd() } }));
    get().persist();
  },

  canAddBet: () => {
    const { bets, settings } = get();
    return settings.isPro || bets.length < FREE_LIMITS.MAX_BETS;
  },
}));
