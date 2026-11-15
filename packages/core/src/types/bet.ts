export type BetStatus = 'pending' | 'won' | 'lost' | 'refund' | 'cashout';

export type EsportsDiscipline =
  | 'dota2'
  | 'csgo'
  | 'lol'
  | 'valorant'
  | 'pubg'
  | 'r6'
  | 'apex'
  | 'other_esports';

export interface Team {
  id: string;
  name: string;
  sport: Sport;
  discipline?: EsportsDiscipline;
  usageCount: number;
  lastUsed: string; // ISO-8601
}

export type Sport =
  | 'football'
  | 'hockey'
  | 'basketball'
  | 'tennis'
  | 'esports'
  | 'volleyball'
  | 'baseball'
  | 'other';

export type BetType =
  | '1X2'
  | 'total_over'
  | 'total_under'
  | 'handicap'
  | 'both_score'
  | 'exact_score'
  | 'express'
  | 'corners'
  | 'other';

export type Strategy =
  | 'value'
  | 'stats'
  | 'form'
  | 'intuition'
  | 'system'
  | 'other';

export interface Bet {
  id: string;              // UUID v4
  createdAt: string;       // ISO-8601
  updatedAt: string;       // ISO-8601
  /**
   * ISO-8601: when the result went into the book (`stampSettlement`) — not the
   * match. None on a pending bet, and on bets saved before the field existed
   * (their last edit, `updatedAt`, stands in). Tells `bankAtBetTime` which
   * results a bet entered later could already have seen.
   */
  settledAt?: string;
  /**
   * ISO-8601: when a result first went into the book. Unlike `settledAt` it
   * does not move when the result is corrected, nor go when the bet goes back
   * to pending. A frozen goal counts the bets whose result was first recorded
   * by its freeze, with the result they have now: a result corrected since is
   * re-counted, not dropped (`GoalReached`). None on bets settled before the
   * field existed — `settledAt` (or `legacySettledAt`) stands in.
   */
  firstSettledAt?: string;
  date: string;            // YYYY-MM-DD
  time: string;            // HH:MM
  sport: Sport;
  bookmaker: string;
  event: string;
  betType: BetType;
  pick: string;
  odds: number;            // decimal, e.g. 1.85
  closingOdds?: number;    // closing line (decimal); enables CLV analytics
  stake: number;           // in user currency (kopecks as integer to avoid float issues)
  status: BetStatus;
  strategy: Strategy;
  notes?: string;
  cashoutAmount?: number;   // kopecks; only set when status === 'cashout'
  isFreebet?: boolean;      // freebet: loss P&L = 0 (stake is a bonus, not own funds)
  tournament?: string;       // league / cup name, e.g. "Лига Чемпионов"
  discipline?: EsportsDiscipline; // only when sport === 'esports'
  customSport?: string;     // free-text label when sport === 'other'
  customBetType?: string;   // free-text label when betType === 'other'
  customStrategy?: string;  // free-text label when strategy === 'other'
  schemaVersion: number;   // for migrations
}

export type BankrollTxType = 'deposit' | 'withdrawal' | 'adjustment';

export interface BankrollTransaction {
  id: string;
  type: BankrollTxType;
  /**
   * Kopecks. Always positive for deposit/withdrawal — the type carries the
   * sign. SIGNED for 'adjustment': a reconciliation against the real balance
   * at the bookmaker can go either way, and forcing it positive would need a
   * fake withdrawal to express "the app counted 25 ₽ too much".
   */
  amount: number;
  date: string;            // ISO-8601
  note?: string;
}

export interface Bankroll {
  id: string;
  name: string;
  currency: string;        // 'RUB' | 'USD' | 'EUR'
  unitPercent: number;     // % of bank per unit, e.g. 2.0
  transactions: BankrollTransaction[];
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  date: string;            // YYYY-MM-DD
  mood: 1 | 2 | 3 | 4 | 5;
  text?: string;
}

/**
 * What a goal measures (`calcGoalProgress`):
 *  - `profit`   — the result of bets settled from the start day: wins, losses,
 *                 cashouts as they came out. Deposits and withdrawals do NOT
 *                 move it: paying in your own money is not earning it.
 *  - `bank`     — the bank itself: bets, deposits, withdrawals, reconciliations.
 *  - `withdraw` — money taken out beyond what was paid in, from the start day.
 *  - `lossCap`  — protective: lose no more than `target` in a calendar month.
 */
export type GoalKind = 'profit' | 'bank' | 'withdraw' | 'lossCap';

/** A user's goal. Data, not a setting: it rides in the backup and goes with "clear all data". */
export interface Goal {
  id: string;
  title: string;
  kind: GoalKind;
  /** Hundredths of the book's currency, > 0. For `lossCap` — the most to lose in a month. */
  target: number;
  /** YYYY-MM-DD: the first day that counts. Bets dated before it are not the goal's. */
  startDate: string;
  /** YYYY-MM-DD; none — no deadline. Not used by `lossCap`. */
  deadline?: string;
  /** The user's own words: the plan, the why. */
  note?: string;
  createdAt: string;
  /** Kept, out of the way: not on the main screen, not counted against the Free limit. */
  archived?: boolean;
  /**
   * Frozen when it was reached (freezeReachedGoals): its numbers are the book
   * as it was recorded at that moment, so nothing recorded later moves it — a
   * loss once took a reached goal back under 100% and out of «Достигнутые»
   * (report from a phone).
   */
  reached?: GoalReached;
}

/** A reached goal, frozen. */
export interface GoalReached {
  /**
   * ISO moment of the freeze. The goal counts the bets whose result was first
   * recorded by it (`firstSettledAt`), with the result they carry now, and the
   * transfers entered by it (a transfer's `date`); nothing recorded after. A
   * result corrected since is counted as corrected, a bet deleted or back in
   * play is not counted: if the goal no longer reaches its target there, it is
   * shown live — a mis-tap on «Выиграла» must not freeze a goal for good — and
   * the freeze is kept, so undoing the change brings it back.
   */
  at: string;
  /**
   * The day it was reached on (YYYY-MM-DD, the phone's local day then): the
   * frozen book is counted with it as "today", so neither a clock set back
   * nor another time zone pushes the reaching bets past "today". A freeze
   * without one (saved before the field) uses the local day of `at`.
   */
  day?: string;
}

export type StrategyGoal = 'income' | 'hobby' | 'professional';
export type StrategyBankroll = 'small' | 'medium' | 'large' | 'xlarge';
export type StrategyRisk = 'conservative' | 'moderate' | 'aggressive';
export type StrategySport = 'football' | 'hockey' | 'tennis' | 'esports' | 'mixed';
export type StrategyBetType = 'singles' | 'express' | 'both';
export type StrategyOdds = 'low' | 'mid' | 'high';
export type StrategyTime = 'minimal' | 'moderate' | 'substantial' | 'intensive';
export type StrategyExperience = 'beginner' | 'experienced' | 'professional';
export type StrategyTilt = 'stop' | 'reduce' | 'continue';
export type StrategyPriority = 'quantity' | 'quality';

export interface StrategyAnswers {
  goal: StrategyGoal;
  bankroll: StrategyBankroll;
  risk: StrategyRisk;
  sport: StrategySport;
  betTypes: StrategyBetType;
  oddsRange: StrategyOdds;
  timePerDay: StrategyTime;
  experience: StrategyExperience;
  tiltReaction: StrategyTilt;
  priority: StrategyPriority;
}

export interface GeneratedStrategy {
  name: string;
  description: string;
  betsPerDay: number;
  stakePercent: number;      // % of bankroll per bet
  oddsMin: number;
  oddsMax: number;
  kellyMultiplier: number;   // e.g. 0.25 = quarter-Kelly
  tiltThreshold: number;     // suggested consecutive losses threshold
  betTypeAdvice: string;
  sportAdvice: string;
  // Rich output fields (added in v2)
  rationale?: string;              // why this strategy fits the profile
  keyPrinciples?: string[];        // 3-4 actionable rules
  recommendedApproaches?: Strategy[];  // value/stats/form/intuition/system
  recommendedBetTypes?: BetType[];     // total_over/handicap/1X2 etc.
  betTypeRationale?: string;       // why these bet markets
  oddsRationale?: string;          // why this odds range
  createdAt: string;
  answers: StrategyAnswers;
  /**
   * Switched off by the user: kept, but nothing checks bets against it — the
   * form, Kelly and Analytics work as with no strategy. Read the strategy that
   * applies through `activeStrategy`, never `settings.generatedStrategy` raw.
   */
  disabled?: boolean;
  /**
   * When it was last switched back on. Bets placed while it was off were told
   * "not checked", so the plan judges from here, not from `createdAt`
   * (`strategySince`).
   */
  enabledAt?: string;
}

/** Colour themes of the mobile app. Stored in the device's settings; restoring a backup does not change it. */
export type AppTheme = 'dark' | 'light' | 'olive' | 'navy';

/** The currency a book is kept in. Every amount is stored in its 1/100 units. */
export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'USDT' | 'BYN';

/** How odds are typed and shown. Stored odds are always decimal. */
export type OddsFormat = 'decimal' | 'fractional' | 'american' | 'hongkong' | 'malay' | 'indo';

export interface AppSettings {
  tiltThreshold: number;
  dailyBetLimit: number;
  bookmakers: string[];
  isPro: boolean;
  /** End of the local free trial (mobile). Past it, the trial no longer holds Pro. */
  proExpiresAt?: string;
  /**
   * Signed Pro licence from a one-time purchase (mobile, Robokassa). Verified
   * against the licence server's public key when it enters the device (restore
   * code, backup, server) — the only way it is written. Travels with a JSON
   * backup, so Pro survives a new phone.
   */
  license?: string;
  /**
   * Invoice numbers whose licence the server revoked (a refund). Kept so the
   * same code pasted again is refused offline too, not only at the next check.
   */
  revokedLicenses?: string[];
  onboardingComplete: boolean;
  reminderHour: number;
  schemaVersion: number;
  roundAmounts: boolean;
  generatedStrategy?: GeneratedStrategy;
  lastBackupAt?: string;
  language?: 'ru' | 'en' | 'kz' | 'by';
  /** Mobile colour theme; missing = dark. The desktop ignores it. */
  theme?: AppTheme;
  /**
   * The currency of the whole book; missing = RUB (everything saved before the
   * setting existed was roubles). A label: switching it converts nothing.
   */
  currency?: CurrencyCode;
  /** How odds are typed and shown; missing = decimal. `Bet.odds` stays decimal. */
  oddsFormat?: OddsFormat;
  disableChecklist?: boolean;
  betResultReminders?: boolean; // local reminder with W/L buttons when a match should be over (default: on)
}

export interface StorageSchema {
  bets: Bet[];
  bankroll: Bankroll;
  diary: DiaryEntry[];
  settings: AppSettings;
  teams: Team[];
  /** Absent in data saved before goals existed. */
  goals?: Goal[];
  version: number;
}
