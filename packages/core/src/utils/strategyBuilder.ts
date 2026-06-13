import type {
  StrategyAnswers, GeneratedStrategy,
  StrategyGoal, StrategyRisk, StrategyExperience,
  Strategy, BetType,
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
      { value: 'hobby',        label: 'Хобби',                   desc: 'Для интереса, без строгих требований к прибыли' },
      { value: 'income',       label: 'Дополнительный доход',    desc: 'Хочу стабильно зарабатывать сверх основного дохода' },
      { value: 'professional', label: 'Профессиональный беттинг', desc: 'Ставки как основной источник дохода' },
    ],
  },
  {
    key: 'bankroll',
    text: 'Какой у тебя стартовый банкролл?',
    options: [
      { value: 'small',  label: 'До 5 000 ₽',        desc: 'Небольшой стартовый банк' },
      { value: 'medium', label: '5 000 – 30 000 ₽',  desc: 'Средний банк' },
      { value: 'large',  label: '30 000 – 100 000 ₽', desc: 'Крупный банк' },
      { value: 'xlarge', label: 'Более 100 000 ₽',    desc: 'Очень крупный банк' },
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
      { value: 'minimal',     label: 'До 30 минут',   desc: 'Хочу быстрые решения без глубокого анализа' },
      { value: 'moderate',    label: '30–60 минут',   desc: 'Готов к регулярному, но не интенсивному анализу' },
      { value: 'substantial', label: '1–2 часа',      desc: 'Серьёзный подход с детальным разбором матчей' },
      { value: 'intensive',   label: 'Более 2 часов', desc: 'Профессиональный уровень вовлечённости' },
    ],
  },
  {
    key: 'experience',
    text: 'Какой у тебя опыт в ставках?',
    options: [
      { value: 'beginner',     label: 'Новичок',      desc: 'Менее года, только начинаю разбираться' },
      { value: 'experienced',  label: 'Опытный',      desc: '1–3 года, есть понимание процессов' },
      { value: 'professional', label: 'Профессионал', desc: 'Более 3 лет, стабильная прибыль' },
    ],
  },
  {
    key: 'tiltReaction',
    text: 'Что ты делаешь после 3 проигрышей подряд?',
    options: [
      { value: 'stop',     label: 'Останавливаюсь на день',  desc: 'Дисциплинированный подход — эмоции в сторону' },
      { value: 'reduce',   label: 'Уменьшаю размер ставки',  desc: 'Снижаю риск до восстановления уверенности' },
      { value: 'continue', label: 'Продолжаю без изменений', desc: 'Не даю эмоциям влиять на стратегию' },
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

// ── Name & description ──────────────────────────────────────────────────────

type LangKey = 'ru' | 'en';
function lang2(lang: string, ru: string, en: string): string {
  return lang === 'ru' ? ru : en;
}

function strategyName(goal: StrategyGoal, risk: StrategyRisk, experience: StrategyExperience, lang: string): string {
  if (experience === 'beginner') return lang2(lang, 'Стартовая', 'Starter');
  if (goal === 'professional' && experience === 'professional') return lang2(lang, 'Профессиональная', 'Professional');
  if (risk === 'conservative') return lang2(lang, 'Консервативная', 'Conservative');
  if (risk === 'aggressive') return lang2(lang, 'Агрессивная', 'Aggressive');
  if (goal === 'income' && risk === 'moderate') return lang2(lang, 'Ценностная', 'Value Betting');
  return lang2(lang, 'Сбалансированная', 'Balanced');
}

function strategyDescription(name: string, lang: string): string {
  const mapRu: Record<string, string> = {
    'Стартовая':        'Минимальный риск и небольшие ставки для накопления опыта. Фокус на дисциплине и ведении статистики.',
    'Профессиональная': 'Высокая вовлечённость, детальный анализ и строгий контроль банкролла. Ставки только на хорошо изученные события.',
    'Консервативная':   'Защита капитала в приоритете. Ставки на фаворитов с высокой вероятностью, небольшой размер ставки.',
    'Агрессивная':      'Высокие коэффициенты и возможность быстрого роста банкролла. Требует стальных нервов и чёткой дисциплины.',
    'Ценностная':       'Поиск ставок, где реальная вероятность выше оценки букмекера. Умеренный риск, долгосрочная прибыль.',
    'Сбалансированная': 'Оптимальный баланс между риском и доходностью. Разнообразие ставок с контролем банкролла.',
  };
  const mapEn: Record<string, string> = {
    'Starter':       'Low risk and small stakes to build experience. Focus on discipline and tracking your stats.',
    'Professional':  'Deep involvement, detailed analysis and strict bankroll management. Bet only on well-researched events.',
    'Conservative':  'Capital protection first. Bet on heavy favourites with high probability at small stake sizes.',
    'Aggressive':    'High odds and fast bankroll growth potential. Requires nerves of steel and strict discipline.',
    'Value Betting': 'Find bets where the real probability exceeds the bookmaker\'s estimate. Moderate risk, long-term profit.',
    'Balanced':      'Optimal balance of risk and return. Diverse bets with solid bankroll management.',
  };
  return (lang === 'ru' ? mapRu[name] : mapEn[name]) ?? '';
}

// ── Rationale paragraph ─────────────────────────────────────────────────────

function buildRationale(a: StrategyAnswers, lang: string): string {
  const isEn = lang !== 'ru';
  const expLabel = isEn
    ? ({ beginner: 'beginner', experienced: 'experienced bettor', professional: 'professional bettor' } as Record<string, string>)[a.experience] ?? a.experience
    : ({ beginner: 'начинающего беттора', experienced: 'опытного беттора', professional: 'профессионального беттора' } as Record<string, string>)[a.experience] ?? a.experience;

  const goalLabel = isEn
    ? ({ hobby: 'as a hobby', income: 'for extra income', professional: 'as a primary income source' } as Record<string, string>)[a.goal] ?? a.goal
    : ({ hobby: 'как хобби', income: 'для дополнительного дохода', professional: 'как основной заработок' } as Record<string, string>)[a.goal] ?? a.goal;

  const parts: string[] = [];
  parts.push(isEn
    ? `You approach betting ${goalLabel}. Profile: ${expLabel}.`
    : `Ты подходишь к ставкам ${goalLabel}. Профиль ${expLabel}.`);

  if (a.risk === 'conservative') {
    parts.push(isEn
      ? 'A conservative approach protects the bankroll from large drawdowns — preserving capital is the priority.'
      : 'Консервативный подход защищает банкролл от крупных просадок — в приоритете сохранение капитала.');
  } else if (a.risk === 'aggressive') {
    parts.push(isEn
      ? 'High risk tolerance opens the door to higher odds and faster bankroll growth — but demands iron discipline.'
      : 'Высокая толерантность к риску открывает возможности с более высокими кэфами и ускоренным ростом банкролла — но требует железной дисциплины.');
  } else {
    parts.push(isEn
      ? 'Moderate risk is the optimal balance: the bankroll grows without the threat of critical drawdowns.'
      : 'Умеренный риск — оптимальный баланс: капитал растёт без угрозы критических просадок.');
  }

  if (a.experience === 'beginner') {
    parts.push(isEn
      ? 'At the start, the most important thing is to collect 100+ bets for reliable stats — profit comes with experience.'
      : 'На старте важнее всего собрать 100+ ставок для достоверной статистики — прибыль придёт с опытом.');
  } else if (a.experience === 'professional') {
    parts.push(isEn
      ? 'Professional-level experience lets you work with line movement, live betting and value hunting.'
      : 'Профессиональный уровень позволяет работать с движением линий, live-ставками и поиском value.');
  } else {
    parts.push(isEn
      ? 'Accumulated experience lets you separate value bets from noise and build strategy on data, not intuition.'
      : 'Накопленный опыт позволяет отделять ценные ставки от шума и строить стратегию на данных, а не на интуиции.');
  }

  if (a.timePerDay === 'minimal') {
    parts.push(isEn
      ? 'With limited time, bet only on well-covered matches — don\'t guess on poorly-researched events.'
      : 'С ограниченным временем ставь только на матчи с обилием информации — не угадывай по малоизученным событиям.');
  } else if (a.timePerDay === 'intensive') {
    parts.push(isEn
      ? 'High involvement gives a competitive edge: tracking line movement and live betting opportunities.'
      : 'Высокая вовлечённость даёт конкурентное преимущество: отслеживание движения линий и live-ставки.');
  }

  return parts.join(' ');
}

// ── Key principles ──────────────────────────────────────────────────────────

function buildKeyPrinciples(a: StrategyAnswers, lang: string): string[] {
  const isEn = lang !== 'ru';
  const rules: string[] = [];

  // Risk-based
  if (a.risk === 'conservative') {
    rules.push(isEn
      ? 'Bet only when 75%+ confident — skipping an event is not a loss, it\'s discipline'
      : 'Ставь только если уверен на 75%+ — пропустить событие не потеря, это дисциплина');
  } else if (a.risk === 'moderate') {
    rules.push(isEn
      ? 'Don\'t adjust stake size based on "confidence" — discipline beats intuition'
      : 'Не меняй размер ставки в зависимости от «уверенности» — дисциплина важнее интуиции');
  } else {
    rules.push(isEn
      ? 'Hard stop-loss: a 25% drawdown in one week means a minimum 3-day break'
      : 'Жёсткий стоп-лосс: просадка 25% банкролла за неделю = пауза минимум 3 дня');
  }

  // Experience-based
  if (a.experience === 'beginner') {
    rules.push(isEn
      ? 'First 3 months: data collection only. Don\'t expect profit — the goal is stats for analysis'
      : 'Первые 3 месяца — только сбор статистики. Не жди прибыли, цель — данные для анализа');
  } else if (a.experience === 'professional') {
    rules.push(isEn
      ? 'Track line movement: a sharp odds shift 1–2 hours before a match signals insider information'
      : 'Отслеживай движение линий: резкий сдвиг кэфа за 1–2 часа до матча сигнализирует о закрытой информации');
  } else {
    rules.push(isEn
      ? 'Keep detailed stats per bet type — cut non-performing markets once a month'
      : 'Веди детальную статистику по каждому типу ставок — отсеивай неработающие рынки раз в месяц');
  }

  // Sport-based
  if (a.sport === 'football') {
    rules.push(isEn
      ? 'Study last 5 matches and H2H — home/away form is especially important in football'
      : 'Изучай форму команд за последние 5 матчей и H2H — особенно важно на своём/чужом поле');
  } else if (a.sport === 'esports') {
    rules.push(isEn
      ? 'Watch active rosters: player substitutions 24h before a match sharply change the odds'
      : 'Следи за актуальными составами: замены игроков за 24 часа до матча резко меняют шансы');
  } else if (a.sport === 'tennis') {
    rules.push(isEn
      ? 'Factor in court surface and physical load from recent tournaments — tennis is physically demanding'
      : 'Учитывай покрытие корта и физическую нагрузку предыдущих турниров — теннис физически затратен');
  } else if (a.sport === 'hockey') {
    rules.push(isEn
      ? 'The goaltender decides up to 40% of hockey outcomes — always check who\'s in net before betting'
      : 'До 40% успеха в хоккее определяет вратарь — всегда проверяй кто защищает перед ставкой');
  } else {
    rules.push(isEn
      ? 'Specialise in at most 2–3 sports — spreading across 5+ halves your ROI'
      : 'Специализируйся максимум на 2–3 видах спорта — распыление по 5+ снижает ROI вдвое');
  }

  // Time/goal-based
  if (a.timePerDay === 'minimal') {
    rules.push(isEn
      ? 'With limited time, bet only on top matches: more media coverage = fewer mispriced events'
      : 'С ограниченным временем ставь только топ-матчи: больше медиаосвещения = меньше ошибок в оценке');
  } else if (a.timePerDay === 'intensive' && a.experience !== 'beginner') {
    rules.push(isEn
      ? 'Use live line monitoring — a sharp odds shift 1–2 hours pre-match often contains value'
      : 'Используй live-мониторинг линий — резкий сдвиг кэфа за 1–2 часа до матча часто содержит value');
  } else if (a.goal === 'income' || a.goal === 'professional') {
    rules.push(isEn
      ? 'Target ROI: a steady 5–8% per month yields 60–100% bankroll growth per year'
      : 'Целевой ROI: стабильные 5–8% в месяц дают 60–100% роста банкролла за год');
  } else {
    rules.push(isEn
      ? 'Set a personal monthly loss limit and never break it under any circumstances'
      : 'Установи личный лимит потерь в месяц и не нарушай его ни при каких обстоятельствах');
  }

  return rules.slice(0, 4);
}

// ── Recommended approaches (Strategy tags) ─────────────────────────────────

function buildRecommendedApproaches(a: StrategyAnswers): Strategy[] {
  const result: Strategy[] = [];

  // Value betting — non-beginner + income/professional goal
  if (a.experience !== 'beginner' && (a.goal === 'income' || a.goal === 'professional')) {
    result.push('value');
  }

  // Stats — enough time for analysis
  if (a.timePerDay === 'substantial' || a.timePerDay === 'intensive') {
    result.push('stats');
  }

  // Form — team sports
  if (a.sport === 'football' || a.sport === 'hockey' || a.sport === 'esports') {
    result.push('form');
  }

  // Intuition — beginners or hobby players
  if (a.experience === 'beginner' || a.goal === 'hobby') {
    result.push('intuition');
  }

  // System — quantity priority + not beginner
  if (a.priority === 'quantity' && a.experience !== 'beginner') {
    result.push('system');
  }

  // Ensure at least 2 approaches
  if (result.length === 0) return ['stats', 'form'];
  if (result.length === 1) return [result[0]!, result[0] === 'stats' ? 'form' : 'stats'];

  return result.slice(0, 3);
}

// ── Recommended bet types ───────────────────────────────────────────────────

function buildRecommendedBetTypes(a: StrategyAnswers): BetType[] {
  if (a.sport === 'football') {
    if (a.risk === 'conservative') return ['1X2', 'both_score'];
    return ['total_over', 'total_under', 'handicap'];
  }
  if (a.sport === 'hockey') return ['total_over', 'total_under', 'handicap'];
  if (a.sport === 'tennis') return ['handicap', '1X2'];
  if (a.sport === 'esports') return ['handicap', '1X2'];
  // mixed
  return ['1X2', 'total_over', 'handicap'];
}

// ── Odds rationale ──────────────────────────────────────────────────────────

function buildOddsRationale(a: StrategyAnswers, lang: string): string {
  const isEn = lang !== 'ru';
  if (a.oddsRange === 'low') {
    return isEn
      ? 'Favourites at 1.30–1.70 win 65–80% of the time. The key is stake sizing and discipline, not chasing high odds.'
      : 'Фавориты с кэфом 1.30–1.70 дают 65–80% вероятность прохода. Ключ — размер ставки и дисциплина, а не погоня за высоким кэфом.';
  }
  if (a.oddsRange === 'high') {
    return isEn
      ? 'High odds (2.50+) imply a win probability of 40% or less. Profit requires a large sample (200+ bets) and strict selection.'
      : 'Высокий кэф (2.50+) означает вероятность прохода 40% и ниже. Для прибыли нужна большая выборка (200+ ставок) и строгий отбор.';
  }
  return isEn
    ? 'The 1.70–2.50 range is optimal: sufficient win probability (40–60%) with acceptable returns. Most value sits here.'
    : 'Диапазон 1.70–2.50 — оптимальный: достаточная вероятность прохода (40–60%) при приемлемом доходе. Большинство value находится именно здесь.';
}

// ── Bet type rationale ──────────────────────────────────────────────────────

function buildBetTypeRationale(a: StrategyAnswers, lang: string): string {
  const isEn = lang !== 'ru';
  const rationalesRu: Record<string, string> = {
    football: 'Тоталы (ТБ/ТМ) и форы в футболе содержат больше value, чем 1X2 — букмекеры точнее ценят победителей, но ошибаются в счёте.',
    hockey:   'В хоккее тоталы ±0.5 шайбы и форы -1.5/+1.5 часто переоценены — хорошая почва для value.',
    tennis:   'Форы по геймам дают лучшую маржу в теннисе. Исходы сетов — для тех, кто отслеживает физическое состояние.',
    esports:  'Форы по картам и раундам — основной рынок для value в киберспорте. Исходы слишком популярны у казуальной аудитории.',
    mixed:    'При работе с несколькими видами спорта сосредоточься на исходах и тоталах — они проще всего поддаются анализу.',
  };
  const rationalesEn: Record<string, string> = {
    football: 'Totals (over/under) and handicaps in football carry more value than 1X2 — bookmakers price winners well but misjudge scores.',
    hockey:   'Hockey totals ±0.5 and handicaps -1.5/+1.5 are often mispriced — fertile ground for value.',
    tennis:   'Game handicaps offer the best edge in tennis. Set totals suit those tracking physical condition.',
    esports:  'Map and round handicaps are the main value market in esports. Outright results are too popular with casual bettors.',
    mixed:    'When covering multiple sports, focus on outrights and totals — they are easiest to analyse consistently.',
  };
  const rationales = isEn ? rationalesEn : rationalesRu;
  return rationales[a.sport] ?? (isEn
    ? 'Choose markets where you have a competitive edge over the bookmaker.'
    : 'Выбирай рынки, где у тебя есть конкурентное преимущество над букмекером.');
}

// ── Main builder ────────────────────────────────────────────────────────────

export function buildStrategy(answers: StrategyAnswers, lang = 'ru'): GeneratedStrategy {
  const { goal, risk, experience, oddsRange, timePerDay, betTypes, sport, tiltReaction, priority, bankroll } = answers;
  const isEn = lang !== 'ru';

  // ── Stake % per bet ──────────────────────────────────────────────
  let stakeBase = risk === 'conservative' ? 1 : risk === 'moderate' ? 2 : 3.5;
  if (experience === 'beginner')     stakeBase *= 0.5;
  if (experience === 'professional') stakeBase *= 1.2;
  if (goal === 'hobby')              stakeBase *= 0.8;
  if (goal === 'professional')       stakeBase *= 1.2;
  const bankrollMod: Record<string, number> = { small: 0.8, medium: 1.0, large: 1.1, xlarge: 1.15 };
  stakeBase *= (bankrollMod[bankroll] ?? 1.0);
  const stakePercent = Math.min(5, Math.max(0.5, Math.round(stakeBase * 10) / 10));

  // ── Bets per day ─────────────────────────────────────────────────
  const timeMap: Record<string, number> = { minimal: 1, moderate: 3, substantial: 5, intensive: 7 };
  let betsBase = timeMap[timePerDay] ?? 3;
  if (priority === 'quality') betsBase = Math.max(1, Math.floor(betsBase * 0.7));
  if (experience === 'beginner') betsBase = Math.min(betsBase, 3);
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
  if (experience === 'professional' && goal === 'professional') kelly = Math.min(0.9, kelly * 1.2);
  const kellyMultiplier = Math.round(kelly * 100) / 100;

  // ── Tilt threshold ───────────────────────────────────────────────
  const tiltMap: Record<string, number> = { stop: 2, reduce: 3, continue: 4 };
  const tiltThreshold = tiltMap[tiltReaction] ?? 3;

  // ── Bet type advice ──────────────────────────────────────────────
  const betTypeAdvice = isEn
    ? (betTypes === 'singles' ? 'Singles only' : betTypes === 'express' ? 'Accumulators 2–3 events' : 'Singles (80%) + occasional 2-event accas')
    : (betTypes === 'singles' ? 'Только ординары' : betTypes === 'express' ? 'Экспрессы 2–3 события' : 'Ординары (80%) + редкие экспрессы на 2 события');

  // ── Sport advice ─────────────────────────────────────────────────
  const sportLabels: Record<string, string> = isEn
    ? { football: 'Football', hockey: 'Hockey', tennis: 'Tennis', esports: 'Esports', mixed: 'Multiple sports' }
    : { football: 'Футбол', hockey: 'Хоккей', tennis: 'Теннис', esports: 'Киберспорт', mixed: 'Несколько видов' };
  const sportAdvice = sportLabels[sport] ?? sport;

  const name = strategyName(goal, risk, experience, lang);

  return {
    name,
    description: strategyDescription(name, lang),
    betsPerDay,
    stakePercent,
    oddsMin: oddsMin!,
    oddsMax: oddsMax!,
    kellyMultiplier,
    tiltThreshold,
    betTypeAdvice,
    sportAdvice,
    rationale: buildRationale(answers, lang),
    keyPrinciples: buildKeyPrinciples(answers, lang),
    recommendedApproaches: buildRecommendedApproaches(answers),
    recommendedBetTypes: buildRecommendedBetTypes(answers),
    betTypeRationale: buildBetTypeRationale(answers, lang),
    oddsRationale: buildOddsRationale(answers, lang),
    createdAt: new Date().toISOString(),
    answers,
  };
}
