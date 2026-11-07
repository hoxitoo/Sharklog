import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bet, AppSettings, Bankroll, DiaryEntry, Goal, Team, Sport, EsportsDiscipline } from '@sharklog/core';
import {
  migrate, CURRENT_SCHEMA_VERSION, FREE_LIMITS, DEFAULT_BANKROLL_NAME, calcCurrentStreak, parseEventTeams,
  preselectedBookmakers, sanitizeBets, sanitizeBankroll, sanitizeDiary, sanitizeTeams, sanitizeGoals,
} from '@sharklog/core';
import {
  sendTiltNotification, scheduleBetResultReminder,
  cancelBetResultReminder, cancelAllBetResultReminders, syncBetResultReminders,
} from '../utils/notifications';
import { verifyLicense, resolvePro, trialEnd, extractLicense, hasLicense, readLicense, type LicensePayload } from '../utils/license';
import { BILLING, LICENSE_PUBKEY } from '../services/billing';
import { distribution } from '../utils/storeLinks';
import { uuid } from '../utils/uuid';
import {
  STORAGE_KEY, LANDED_KEY, IOS_INLINE_CHARS, pieceKey, parsePieceKey, buildSave, recordPieces, assembleGeneration,
  parsePiece, generationsOnDisk, textHash, failedRecordMayLand,
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
  // On the write chain: «Clear all data» queued after it removes this copy
  // too, instead of racing a multi-megabyte write still on its way.
  writeChain = writeChain.then(async () => {
    const keys = (await AsyncStorage.getAllKeys())
      .filter((k) => k === QUARANTINE_KEY || k.startsWith(`${QUARANTINE_KEY}:`));
    const bases = keys.filter((k) => !k.includes('#'));
    const copies = await AsyncStorage.getMany(bases);
    for (const base of bases) {
      if (copies[base] !== main) continue;
      if (pieces.length === 0) return;
      const saved = await AsyncStorage.getMany(pieces.map((_, i) => `${base}#${i}`));
      const at = (i: number) => saved[`${base}#${i}`] ?? null;
      if (pieces.every((p, i) => at(i) === p)) return;
      // This very copy, left half-written (iOS lists the pieces that fitted
      // before a full disk stopped it): finish it rather than start another —
      // each launch began a new half and spent the space a save needed. Only
      // pieces it lacks are written: one that differs means another event.
      if (pieces.every((p, i) => at(i) === null || at(i) === p)) {
        const rest: Record<string, string> = {};
        pieces.forEach((p, i) => { if (p !== null && at(i) === null) rest[`${base}#${i}`] = p; });
        await AsyncStorage.setMany(rest);
        return;
      }
    }
    const base = keys.includes(QUARANTINE_KEY) ? `${QUARANTINE_KEY}:${Date.now()}` : QUARANTINE_KEY;
    const entries: Record<string, string> = { [base]: main };
    pieces.forEach((p, i) => { if (p !== null) entries[`${base}#${i}`] = p; });
    await AsyncStorage.setMany(entries);
  }).catch(() => {});
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
/**
 * The generation the record on disk names — known once it is read or written
 * this session; null after an old-layout record, which names none.
 */
let committedGen: number | null = null;
/**
 * Generations besides `committedGen` that may not be cleared before a save
 * lands: the pieces an old-layout or lost record was rebuilt from (their bets
 * are not in that record), and a save whose record write failed in a way that
 * may still have put it on disk (see persist).
 */
let keepGens = new Set<number>();
/**
 * The record on disk is a FILE on iOS (over 1 024 characters, or written by
 * this build, which pads it). Then rewriting it either lands whole or leaves
 * the old one: a failed write is not on disk.
 */
let recordIsFile = false;
/**
 * The hash of the old-layout record this session loaded (storageLayout.ts,
 * "Why a base"); null otherwise. Every piece written this session carries it.
 */
let loadedBase: string | null = null;
/**
 * Saves asked for, and the last of them that reached the disk. flush()
 * compares the two, so a save that failed — or was refused, before a load —
 * never reads as "on disk".
 */
let savesAsked = 0;
let savedThrough = 0;
/** The newest save actually queued (a refused one is not): a link behind which a newer one waits skips. */
let lastQueued = 0;
/** Pieces that no record will ever name may be on disk, eating the space the next save needs. */
let orphansPossible = false;

/** The load in progress: a second call (a double-tapped retry) waits for it instead of reading again. */
let loading: Promise<void> | null = null;

/** What made the last load fail — for the error report the user can send (StorageErrorScreen). */
let storageFailure: unknown = null;
export function lastStorageFailure(): unknown {
  return storageFailure;
}

/** The texts of a generation's pieces, in index order (null — missing). */
async function readGeneration(gen: number, count: number): Promise<(string | null)[]> {
  if (count === 0) return [];
  const keys = Array.from({ length: count }, (_, i) => pieceKey(gen, i));
  const got = await AsyncStorage.getMany(keys);
  return keys.map((k) => got[k] ?? null);
}

/**
 * The bets the pieces hold when the main record cannot name them (lost,
 * unreadable, or an old-layout record): the newest WHOLE generation — or, when
 * none is whole, what still reads of the generation that keeps the MOST bets
 * (`whole: false`; starting empty would let the next save remove them — and
 * an unreadable newest generation must not win over an older one with 299
 * bets in it). `broken`: the texts of every generation that was not whole,
 * for the quarantine — the next save removes them all. A generation whose base
 * is `skipBase` is passed over (`skipped`): it is a save of that very record,
 * killed before its own record landed — unless it is the `landed` one, whose
 * record DID land, and which an older build then overwrote (storageLayout.ts,
 * "Why a base").
 */
async function piecesWithoutRecord(
  keys: readonly string[],
  skipBase: string | null,
  landed: number | null,
): Promise<{
  found: { texts: (string | null)[]; bets: unknown[]; whole: boolean } | null;
  skipped: number[];
  broken: (string | null)[];
}> {
  let partial: { texts: (string | null)[]; bets: unknown[]; whole: boolean } | null = null;
  const skipped: number[] = [];
  const broken: (string | null)[] = [];
  for (const { gen, indices } of generationsOnDisk(keys)) {
    const listed = await readGeneration(gen, Math.max(...indices) + 1);
    const own = listed.map(parsePiece).filter((p): p is NonNullable<typeof p> => p !== null && p.g === gen);
    if (skipBase !== null && gen !== landed && own.some((p) => p.b === skipBase)) {
      skipped.push(gen);
      continue;
    }
    // Every piece names its generation's count; read exactly that many.
    const n = own[0]?.n ?? listed.length;
    const texts = Array.from({ length: n }, (_, i) => listed[i] ?? null);
    const { bets, whole } = assembleGeneration(gen, texts);
    if (whole && n > 0) return { found: { texts, bets, whole: true }, skipped, broken };
    broken.push(...listed);
    if (!partial || bets.length > partial.bets.length) partial = { texts: listed, bets, whole: false };
  }
  return { found: partial, skipped, broken };
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
  /**
   * The last save did not reach the disk (most likely a full phone). Cleared
   * by the next save that does. App.tsx tells the user: what is on screen
   * would be lost when the app closes.
   */
  saveFailed: boolean;

  load: () => Promise<void>;
  persist: () => Promise<void>;
  /**
   * Waits for the saves queued so far; true when everything asked to be saved
   * is on disk — false after a save that failed or was refused (before a load).
   */
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
 * Bet reminders brought in line with the store as it is NOW: after anything
 * that changes bets past `addBet`/`updateBet` (CSV/JSON import, restoring a
 * backup), when the reminders switch or the permission changes, and on every
 * return to the app. Settings, App.tsx and the permission prompt each had
 * their own copy of these two lines.
 */
export function resyncBetReminders(): void {
  const { bets, settings } = useBetsStore.getState();
  syncBetResultReminders(bets, settings.betResultReminders !== false);
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
  saveFailed: false,

  load: async () => {
    if (loading) return loading;
    // Loaded already (a dev reload re-running the mount effect): a second read
    // could only trade what is on screen — and saves on their way — for older data.
    if (get().isLoaded && !get().loadError) return;
    let release!: () => void;
    loading = new Promise<void>((r) => { release = r; });
    try {
      // A save already queued lands before the disk is read: read first, and
      // the state on screen would lose what that save carries.
      await writeChain;
      // Read first; decide after. A failed READ is not "no data": writes stay
      // blocked (persist checks loadError) until a retry reads it — the app used
      // to start empty here, and its first save (onboarding's) replaced the file.
      let raw: string | null;
      let keys: string[];
      let landedText: string | null;
      try {
        raw = await AsyncStorage.getItem(STORAGE_KEY);
        keys = await AsyncStorage.getAllKeys();
        landedText = await AsyncStorage.getItem(LANDED_KEY);
      } catch (e) {
        storageFailure = e;
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
        const landed = landedText !== null && /^\d+$/.test(landedText) ? Number(landedText) : null;
        // Every new generation is above anything on disk AND the landed mark: a
        // number reused below a stale mark would read, in a killed save, as one
        // whose record landed (storageLayout.ts, LANDED_KEY).
        const genFloor = Math.max(named?.gen ?? 0, onDisk[0]?.gen ?? 0, landed ?? 0);
        committedGen = named ? named.gen : null;
        keepGens = new Set();
        recordIsFile = raw !== null && raw.length > IOS_INLINE_CHARS;
        loadedBase = null;
        orphansPossible = false;
        // Saves asked for before this load (refused: nothing was read yet) are
        // superseded by what is on disk — they no longer count as unsaved.
        savedThrough = savesAsked;
        if (named) {
          // The usual case: the record names its generation; it must be whole.
          pieces = await readGeneration(named.gen, named.chunks);
          const { bets, whole } = assembleGeneration(named.gen, pieces, named.count);
          if (!whole) damaged = true;
          parsed = { ...record, bets };
          // Other generations are leftovers of a save that failed or was killed
          // last session: the first save clears them before writing (on a full
          // phone they may be the space it needs). Not when the named one is
          // damaged — then they wait for a save that has landed, as before.
          const others = onDisk.filter((g) => g.gen !== named.gen).map((g) => g.gen);
          if (damaged) keepGens = new Set(others);
          else orphansPossible = others.length > 0;
        } else {
          // No record that names pieces: the old single-key layout, a record
          // lost or unreadable, or one an older build rewrote without them. If
          // pieces are on disk, their bets are kept alongside the record's;
          // sanitize keeps the later edit of a bet that is in both — except a
          // killed save of this very record (storageLayout.ts, "Why a base").
          if (record) loadedBase = textHash(raw!);
          const { found, skipped, broken } = onDisk.length > 0
            ? await piecesWithoutRecord(keys, loadedBase, landed)
            : { found: null, skipped: [] as number[], broken: [] as (string | null)[] };
          // Until a save lands, only the skipped ones are garbage: any other
          // generation may hold bets this record does not have.
          keepGens = new Set(onDisk.map((g) => g.gen).filter((g) => !skipped.includes(g)));
          orphansPossible = skipped.length > 0;
          // Pieces that were not whole: what still reads is kept, and every such
          // set is quarantined for support — the next save would remove them.
          pieces = [...(found?.whole ? found.texts : []), ...broken];
          if (broken.length > 0) damaged = true;
          if (raw === null && onDisk.length === 0) {
            // A fresh install.
            lastGen = genFloor;
            set({ isLoaded: true, loadError: false });
            return;
          }
          const own = record?.['bets'];
          // A list that is not a list, about to be replaced by the pieces' list.
          if (found && own !== undefined && !Array.isArray(own)) damaged = true;
          parsed = {
            ...(record ?? {}),
            bets: found ? [...(Array.isArray(own) ? own : []), ...found.bets] : own,
          };
          if (!record && !(found && found.bets.length > 0)) {
            // Nothing readable at all: start as a new install did — but the
            // damaged file is kept first.
            if (raw !== null || pieces.length > 0) quarantine(raw ?? '', pieces);
            lastGen = genFloor;
            set({ isLoaded: true, loadError: false });
            return;
          }
          if (!record) parsed['settings'] = { onboardingComplete: true };
        }
        lastGen = genFloor;
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
      } catch (e) {
        // Something failed AFTER the read — a bug in migration or sanitizing.
        // Not a reason to start empty over data that is there: keep writes off.
        storageFailure = e;
        set({ loadError: true });
      }
    } finally {
      loading = null;
      release();
    }
  },

  persist: async () => {
    const seq = ++savesAsked;
    const { isLoaded, loadError } = get();
    // Never before a load has succeeded: the state is then the empty default,
    // and writing it would replace data that is on disk but was not read.
    if (!isLoaded || loadError) return writeChain;
    lastQueued = seq;
    let gen = 0;
    // Every generation but this one, the one the record on disk names, and
    // the ones that must wait for a landed save (keepGens) is garbage.
    const removeGarbage = async () => {
      const old = (await AsyncStorage.getAllKeys()).filter((k) => {
        const p = parsePieceKey(k);
        return p !== null && p.gen !== gen && p.gen !== committedGen && !keepGens.has(p.gen);
      });
      if (old.length > 0) await AsyncStorage.removeMany(old);
    };
    // Most likely a full phone. Nothing is lost YET — the state is in memory,
    // the last good save on disk — but it will be when the app closes: App.tsx
    // tells the user and saves again on their return.
    const failed = () => {
      orphansPossible = true;
      if (!get().saveFailed) set({ saveFailed: true });
    };
    writeChain = writeChain.then(async () => {
      // A newer save is queued behind this one and will write the newer state:
      // this one would be a full rewrite for nothing (ten quick W/L taps on
      // 10 000 bets were ten 5 MB writes). The state is taken HERE, when it is
      // written, not when it was asked for. flush() waits for the save that
      // covers it.
      // And the state must still be a loaded one: a load that failed after this
      // was queued leaves an empty default in memory.
      if (seq < lastQueued || !get().isLoaded || get().loadError) return;
      const { bets, settings, bankroll, diary, teams, goals } = get();
      gen = ++lastGen;
      const { pieces, record } = buildSave(
        { bets, settings, bankroll, diary, teams, goals, version: CURRENT_SCHEMA_VERSION }, gen, undefined, loadedBase,
      );
      // 0. Pieces no record will ever name (a failed save's, a killed save
      //    skipped at load) take, on a full phone, the space this save needs.
      if (orphansPossible) {
        try { await removeGarbage(); orphansPossible = false; } catch { /* the save below decides */ }
      }
      // 1. The new pieces, under keys no reader uses yet. Failed: no record
      //    was written, so they are garbage.
      try {
        if (Object.keys(pieces).length > 0) await AsyncStorage.setMany(pieces);
      } catch { failed(); return; }
      // 2. The record that names them. Until this lands, the old one names
      //    the old pieces, which are all still there. Failed: on iOS a record
      //    that was not yet a file may be in its file without the manifest
      //    entry, and a later manifest write would make it the live one — its
      //    pieces then stay until a save lands (on iOS only: failedRecordMayLand).
      try {
        await AsyncStorage.setItem(STORAGE_KEY, record);
      } catch {
        if (!recordIsFile && failedRecordMayLand()) keepGens.add(gen);
        failed();
        return;
      }
      // 3. The landed mark: a changed inline value makes iOS write its
      //    manifest, so only now is the record on disk for sure. Failed: the
      //    record may or may not be the live one — keep both its pieces and
      //    the previous ones.
      try {
        await AsyncStorage.setItem(LANDED_KEY, String(gen));
      } catch {
        keepGens.add(gen);
        failed();
        return;
      }
      committedGen = gen;
      keepGens = new Set();
      recordIsFile = true; // padded past the inline limit (buildSave)
      savedThrough = Math.max(savedThrough, seq);
      if (get().saveFailed) set({ saveFailed: false });
      // 4. Only now is every other generation garbage. A failure here costs
      //    space, not data: the next save clears them.
      try { await removeGarbage(); orphansPossible = false; } catch { orphansPossible = true; }
    }).catch(() => {});
    return writeChain;
  },

  // "Saved" means everything asked for UP TO NOW: a save asked for later —
  // while this one is in flight — does not make a landed save read as lost.
  // A save skipped for a newer one (persist) leaves its job to that one, so
  // this waits for the chain to catch up, not only for the link it saw.
  flush: async () => {
    const target = savesAsked;
    for (;;) {
      const chain = writeChain;
      await chain;
      if (savedThrough >= target) return true;
      if (chain === writeChain) return false;
    }
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
      // One pass for the check and the count (the whole dashboard used to run for the count).
      const streak = calcCurrentStreak(bets);
      if (streak.type === 'loss' && streak.count >= effectiveTiltThreshold(settings)) {
        sendTiltNotification(streak.count);
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
    // The quarantine copies hold the bets too: «Clear all data» means them as
    // well — and on a full phone, theirs is the space the user wants back.
    writeChain = writeChain.then(async () => {
      const copies = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(QUARANTINE_KEY));
      if (copies.length > 0) await AsyncStorage.removeMany(copies);
    }).catch(() => {});
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
