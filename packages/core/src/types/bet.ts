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
  date: string;            // YYYY-MM-DD
  time: string;            // HH:MM
  sport: Sport;
  bookmaker: string;
  event: string;
  betType: BetType;
  pick: string;
  odds: number;            // decimal, e.g. 1.85
  stake: number;           // in user currency (kopecks as integer to avoid float issues)
  status: BetStatus;
  strategy: Strategy;
  notes?: string;
  discipline?: EsportsDiscipline; // only when sport === 'esports'
  schemaVersion: number;   // for migrations
}

export interface BankrollTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;          // kopecks
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

export interface AppSettings {
  tiltThreshold: number;   // consecutive losses that trigger alert
  dailyBetLimit: number;   // max bets per day, 0 = unlimited
  bookmakers: string[];    // user-defined list
  isPro: boolean;
  proExpiresAt?: string;   // ISO-8601, undefined = lifetime
  onboardingComplete: boolean;
  reminderHour: number;    // 0-23, daily reminder hour (default 20)
  schemaVersion: number;
}

export interface StorageSchema {
  bets: Bet[];
  bankroll: Bankroll;
  diary: DiaryEntry[];
  settings: AppSettings;
  teams: Team[];
  version: number;
}
