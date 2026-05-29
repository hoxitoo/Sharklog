import type {
  StrategyAnswers, GeneratedStrategy,
  StrategyGoal, StrategyRisk, StrategyExperience,
} from '../types/bet';

// ── Questions definition ────────────────────────────────────────────────────

export interface StrategyQuestion {
  key: keyof StrategyAnswers;
  text: string;
  options: Array<{ value: string; label: string; desc?: string }>;
}

export const STRATEGY_QUESTIONS: StrategyQuestion[] = [
  {
    key: 'goal',
    text: 'Какова твоя главная цель в ставках?',
    options: [
      { value: 'hobby',        label: 'Хобби',                desc: 'Для интереса, без строгих требований к прибыли' },
      { value: 'income',       label: 'Дополнительный доход',  desc: 'Хочу стабильно зарабатывать сверх основного дохода' },
      { value: 'professional', label: 'Профессиональный беттинг', desc: 'Ставки как основной источник дохода' },
    ],
  },
  {
    key: 'bankroll',
    text: 'Какой у тебя стартовый банкролл?',
    options: [
      { value: 'small',  label: 'До 5 000 ₽',       desc: 'Небольшой стартовый банк' },
      { value: 'medium', label: '5 000 – 30 000 ₽',  desc: 'Средний банк' },
      { value: 'large',  label: '30 000 – 100 000 ₽', desc: 'Крупный банк' },
      { value: 'xlarge', label: 'Более 100 000 ₽',   desc: 'Очень крупный банк' },
    ],
  },
  {
    key: 'risk',
    text: 'Какой уровень риска тебе комфортен?',
    options: [
      { value: 'conservative', label: 'Консервативный', desc: 'Потеря до 10% банка в месяц — это предел' },
      { value: 'moderate',     label: 'Умеренный',       desc: 'Готов к просадке до 20% ради большего роста' },
      { value: 'aggressive',   label: 'Агрессивный',     desc: 'Принимаю высокий риск ради высокой доходности' },
    ],
  },
  {
    key: 'sport',
    text: 'На каком виде спорта сфокусируешься?',
    options: [
      { value: 'football', label: 'Футбол' },
      { value: 'hockey',   label: 'Хоккей' },
      { value: 'tennis',   label: 'Теннис' },
      { value: 'esports',  label: 'Киберспорт' },
      { value: 'mixed',    label: 'Несколько видов', desc: 'Диверсификация по видам спорта' },
    ],
  },
  {
    key: 'betTypes',
    text: 'Какой тип ставок предпочитаешь?',
    options: [
      { value: 'singles', label: 'Одиночные',  desc: 'Только ординары — меньше риск, стабильнее результат' },
      { value: 'express', label: 'Экспрессы',  desc: 'Ставки на несколько событий — выше выигрыш, выше риск' },
      { value: 'both',    label: 'Оба типа',   desc: 'Комбинируй ординары и экспрессы' },
    ],
  },
  {
    key: 'oddsRange',
    text: 'В каком диапазоне коэффициентов ты работаешь?',
    options: [
      { value: 'low',  label: '1.30 – 1.70', desc: 'Фавориты — высокая вероятность, низкий доход' },
      { value: 'mid',  label: '1.70 – 2.50', desc: 'Средние коэффициенты — баланс риска и дохода' },
      { value: 'high', label: '2.50 и выше', desc: 'Аутсайдеры — низкая вероятность, высокий потенциал' },
    ],
  },
  {
    key: 'timePerDay',
    text: 'Сколько времени в день готов тратить на анализ?',
    options: [
      { value: 'minimal',     label: 'До 30 минут',  desc: 'Хочу быстрые решения без глубокого анализа' },
      { value: 'moderate',    label: '30–60 минут',  desc: 'Готов к регулярному, но не интенсивному анализу' },
      { value: 'substantial', label: '1–2 часа',     desc: 'Серьёзный подход с детальным разбором матчей' },
      { value: 'intensive',   label: 'Более 2 часов', desc: 'Профессиональный уровень вовлечённости' },
    ],
  },
  {
    key: 'experience',
    text: 'Какой у тебя опыт в ставках?',
    options: [
      { value: 'beginner',     label: 'Новичок',       desc: 'Менее года, только начинаю разбираться' },
      { value: 'experienced',  label: 'Опытный',       desc: '1–3 года, есть понимание процессов' },
      { value: 'professional', label: 'Профессионал',  desc: 'Более 3 лет, стабильная прибыль' },
    ],
  },
  {
    key: 'tiltReaction',
    text: 'Что ты делаешь после 3 проигрышей подряд?',
    options: [
      { value: 'stop',     label: 'Останавливаюсь на день',   desc: 'Дисциплинированный подход — эмоции в сторону' },
      { value: 'reduce',   label: 'Уменьшаю размер ставки',   desc: 'Снижаю риск до восстановления уверенности' },
      { value: 'continue', label: 'Продолжаю без изменений',  desc: 'Не даю эмоциям влиять на стратегию' },
    ],
  },
  {
    key: 'priority',
    text: 'Что для тебя важнее?',
    options: [
      { value: 'quality',  label: 'Качество анализа', desc: 'Мало ставок, но каждая — тщательно выверена' },
      { value: 'quantity', label: 'Количество ставок', desc: 'Ставлю чаще, пользуясь объёмом событий' },
    ],
  },
];

// ── Generation algorithm ────────────────────────────────────────────────────

function strategyName(goal: StrategyGoal, risk: StrategyRisk, experience: StrategyExperience): string {
  if (experience === 'beginner') return 'Стартовая';
  if (goal === 'professional' && experience === 'professional') return 'Профессиональная';
  if (risk === 'conservative') return 'Консервативная';
  if (risk === 'aggressive') return 'Агрессивная';
  if (goal === 'income' && risk === 'moderate') return 'Ценностная';
  return 'Сбалансированная';
}

function strategyDescription(name: string): string {
  const map: Record<string, string> = {
    'Стартовая':        'Минимальный риск и небольшие ставки для накопления опыта. Фокус на дисциплине и ведении статистики.',
    'Профессиональная': 'Высокая вовлечённость, детальный анализ и строгий контроль банкролла. Ставки только на хорошо изученные события.',
    'Консервативная':   'Защита капитала в приоритете. Ставки на фаворитов с высокой вероятностью, небольшой размер ставки.',
    'Агрессивная':      'Высокие коэффициенты и возможность быстрого роста банка. Требует стальных нервов и чёткой дисциплины.',
    'Ценностная':       'Поиск ставок, где реальная вероятность выше оценки букмекера. Умеренный риск, долгосрочная прибыль.',
    'Сбалансированная': 'Оптимальный баланс между риском и доходностью. Разнообразие ставок с контролем банкролла.',
  };
  return map[name] ?? '';
}

export function buildStrategy(answers: StrategyAnswers): GeneratedStrategy {
  const { goal, risk, experience, oddsRange, timePerDay, betTypes, sport, tiltReaction, priority } = answers;

  // ── Stake % per bet ──────────────────────────────────────────────
  let stakeBase = risk === 'conservative' ? 1 : risk === 'moderate' ? 2 : 3.5;
  if (experience === 'beginner') stakeBase *= 0.5;
  if (experience === 'professional') stakeBase *= 1.3;
  if (goal === 'hobby') stakeBase *= 0.7;
  if (goal === 'professional') stakeBase *= 1.2;
  const stakePercent = Math.min(5, Math.max(0.5, Math.round(stakeBase * 10) / 10));

  // ── Bets per day ─────────────────────────────────────────────────
  const timeMap: Record<string, number> = { minimal: 1, moderate: 2, substantial: 3, intensive: 5 };
  let betsBase = timeMap[timePerDay] ?? 2;
  if (priority === 'quality') betsBase = Math.max(1, Math.round(betsBase * 0.6));
  if (experience === 'beginner') betsBase = Math.max(1, betsBase - 1);
  const betsPerDay = Math.round(betsBase);

  // ── Odds range ───────────────────────────────────────────────────
  const oddsMap: Record<string, [number, number]> = {
    low:  [1.30, 1.65],
    mid:  [1.65, 2.40],
    high: [2.40, 4.00],
  };
  const [oddsMin, oddsMax] = oddsMap[oddsRange] ?? [1.65, 2.40];

  // ── Kelly multiplier ─────────────────────────────────────────────
  const kellyMap: Record<string, number> = { conservative: 0.25, moderate: 0.5, aggressive: 0.75 };
  let kelly = kellyMap[risk] ?? 0.5;
  if (experience === 'beginner') kelly = Math.min(kelly, 0.25);
  if (experience === 'professional' && goal === 'professional') kelly = Math.min(1.0, kelly * 1.3);
  const kellyMultiplier = Math.round(kelly * 100) / 100;

  // ── Tilt threshold ───────────────────────────────────────────────
  const tiltMap: Record<string, number> = { stop: 2, reduce: 3, continue: 4 };
  const tiltThreshold = tiltMap[tiltReaction] ?? 3;

  // ── Bet type advice ──────────────────────────────────────────────
  const betTypeAdvice =
    betTypes === 'singles' ? 'Только одиночные ставки' :
    betTypes === 'express' ? 'Экспрессы (2–3 события максимум)' :
    'Преимущественно одиночные + редкие экспрессы (2 события)';

  // ── Sport advice ─────────────────────────────────────────────────
  const sportLabels: Record<string, string> = {
    football: 'Футбол', hockey: 'Хоккей', tennis: 'Теннис',
    esports: 'Киберспорт', mixed: 'Несколько видов спорта',
  };
  const sportAdvice = sportLabels[sport] ?? sport;

  const name = strategyName(goal, risk, experience);

  return {
    name,
    description: strategyDescription(name),
    betsPerDay,
    stakePercent,
    oddsMin,
    oddsMax,
    kellyMultiplier,
    tiltThreshold,
    betTypeAdvice,
    sportAdvice,
    createdAt: new Date().toISOString(),
    answers,
  };
}
