import type { Sport, BetType, Strategy, EsportsDiscipline } from '../types/bet';

/**
 * Pick values as they are STORED on a bet — a data format, not interface text.
 *
 * `getPickedTeams` reads П1/П2/Ф1/Ф2 to know which side the money is on (team
 * stats, the team filter), the bet form parses these back when a bet is
 * edited, and CSV carries them between devices. Translating them would break
 * all three for every non-Russian user, and switching language would orphan
 * every bet already saved. So they are written in one language, always; a
 * screen that SHOWS a pick may translate it, but nothing may store anything
 * other than these.
 */
export const PICK = {
  HOME: 'П1',
  AWAY: 'П2',
  DRAW: 'Ничья',
  HANDICAP_HOME: 'Ф1',
  HANDICAP_AWAY: 'Ф2',
  OVER: 'ТБ',
  UNDER: 'ТМ',
  YES: 'Да',
  NO: 'Нет',
  EXPRESS: 'Экспресс',
} as const;

/**
 * The name a new bankroll is created with. STORED, never shown — no screen
 * reads `bankroll.name` — so it stays as it always was rather than following
 * the interface language; kept here so that is a decision, not an oversight.
 */
export const DEFAULT_BANKROLL_NAME = 'Основной банк';

/**
 * Notes the app writes onto a transaction by itself — STORED, like PICK.
 *
 * They are kept on existing transactions and shown in the history, so the
 * strings are a data format: a screen may display them translated
 * (`txNoteLabel`), but the app keeps writing exactly these. A note the user
 * typed is theirs and is shown as typed.
 */
export const TX_NOTE = {
  ADJUSTMENT: 'Сверка с букмекером',
  INITIAL_DEPOSIT: 'Начальный депозит',
} as const;

export const SPORTS: Record<Sport, string> = {
  football: 'Футбол',
  hockey: 'Хоккей',
  basketball: 'Баскетбол',
  tennis: 'Теннис',
  esports: 'Киберспорт',
  volleyball: 'Волейбол',
  baseball: 'Бейсбол',
  other: 'Другое',
};

export const BET_TYPES: Record<BetType, string> = {
  '1X2': '1X2',
  total_over: 'Тотал ТБ',
  total_under: 'Тотал ТМ',
  handicap: 'Фора',
  both_score: 'Обе забьют',
  exact_score: 'Точный счёт',
  express: 'Экспресс',
  corners: 'Угловые',
  other: 'Другое',
};

export const STRATEGIES: Record<Strategy, string> = {
  value: 'Value',
  stats: 'Статистика',
  form: 'Форма',
  intuition: 'Интуиция',
  system: 'Система',
  other: 'Другое',
};

export const ESPORTS_DISCIPLINES: Record<EsportsDiscipline, string> = {
  dota2: 'Dota 2',
  csgo: 'CS2',
  lol: 'League of Legends',
  valorant: 'Valorant',
  pubg: 'PUBG',
  r6: 'Rainbow Six',
  apex: 'Apex Legends',
  other_esports: 'Другая дисциплина',
};

export const DEFAULT_BOOKMAKERS = [
  '1xBet',
  'Parimatch',
  'Melbet',
  'BetWinner',
  'Fonbet',
  'Leon',
  'Winline',
];

export const FREE_LIMITS = {
  MAX_BETS: 50,
  TILT_ALERT_THRESHOLD: 3,   // fixed, not configurable on free
  DAILY_BET_LIMIT: 0,        // not available on free
} as const;

export const CURRENT_SCHEMA_VERSION = 3;

export const ODDS_RANGES = [
  { label: '< 1.5', min: 1.0, max: 1.5 },
  { label: '1.5 – 1.8', min: 1.5, max: 1.8 },
  { label: '1.8 – 2.2', min: 1.8, max: 2.2 },
  { label: '2.2 – 2.8', min: 2.2, max: 2.8 },
  { label: '2.8 – 4.0', min: 2.8, max: 4.0 },
  { label: '> 4.0', min: 4.0, max: Infinity },
] as const;
