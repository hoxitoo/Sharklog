import type { Sport, BetType, Strategy, EsportsDiscipline } from '../types/bet.js';

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

export const CURRENT_SCHEMA_VERSION = 2;

export const ODDS_RANGES = [
  { label: '< 1.5', min: 1.0, max: 1.5 },
  { label: '1.5 – 1.8', min: 1.5, max: 1.8 },
  { label: '1.8 – 2.2', min: 1.8, max: 2.2 },
  { label: '2.2 – 2.8', min: 2.2, max: 2.8 },
  { label: '2.8 – 4.0', min: 2.8, max: 4.0 },
  { label: '> 4.0', min: 4.0, max: Infinity },
] as const;
