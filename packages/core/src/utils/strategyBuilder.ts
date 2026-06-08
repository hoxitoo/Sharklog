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
    'Агрессивная':      'Высокие коэффициенты и возможность быстрого роста банкролла. Требует стальных нервов и чёткой дисциплины.',
    'Ценностная':       'Поиск ставок, где реальная вероятность выше оценки букмекера. Умеренный риск, долгосрочная прибыль.',
    'Сбалансированная': 'Оптимальный баланс между риском и доходностью. Разнообразие ставок с контролем банкролла.',
  };
  return map[name] ?? '';
}

// ── Rationale paragraph ─────────────────────────────────────────────────────

function buildRationale(a: StrategyAnswers): string {
  const expLabel = {
    beginner:     'начинающего беттора',
    experienced:  'опытного беттора',
    professional: 'профессионального беттора',
  }[a.experience] ?? a.experience;

  const goalLabel = {
    hobby:        'как хобби',
    income:       'для дополнительного дохода',
    professional: 'как основной заработок',
  }[a.goal] ?? a.goal;

  const parts: string[] = [];
  parts.push(`Ты подходишь к ставкам ${goalLabel}. Профиль ${expLabel}.`);

  if (a.risk === 'conservative') {
    parts.push('Консервативный подход защищает банкролл от крупных просадок — в приоритете сохранение капитала.');
  } else if (a.risk === 'aggressive') {
    parts.push('Высокая толерантность к риску открывает возможности с более высокими кэфами и ускоренным ростом банкролла — но требует железной дисциплины.');
  } else {
    parts.push('Умеренный риск — оптимальный баланс: капитал растёт без угрозы критических просадок.');
  }

  if (a.experience === 'beginner') {
    parts.push('На старте важнее всего собрать 100+ ставок для достоверной статистики — прибыль придёт с опытом.');
  } else if (a.experience === 'professional') {
    parts.push('Профессиональный уровень позволяет работать с движением линий, live-ставками и поиском value.');
  } else {
    parts.push('Накопленный опыт позволяет отделять ценные ставки от шума и строить стратегию на данных, а не на интуиции.');
  }

  if (a.timePerDay === 'minimal') {
    parts.push('С ограниченным временем ставь только на матчи с обилием информации — не угадывай по малоизученным событиям.');
  } else if (a.timePerDay === 'intensive') {
    parts.push('Высокая вовлечённость даёт конкурентное преимущество: отслеживание движения линий и live-ставки.');
  }

  return parts.join(' ');
}

// ── Key principles ──────────────────────────────────────────────────────────

function buildKeyPrinciples(a: StrategyAnswers): string[] {
  const rules: string[] = [];

  // Risk-based
  if (a.risk === 'conservative') {
    rules.push('Ставь только если уверен на 75%+ — пропустить событие не потеря, это дисциплина');
  } else if (a.risk === 'moderate') {
    rules.push('Не меняй размер ставки в зависимости от «уверенности» — дисциплина важнее интуиции');
  } else {
    rules.push('Жёсткий стоп-лосс: просадка 25% банкролла за неделю = пауза минимум 3 дня');
  }

  // Experience-based
  if (a.experience === 'beginner') {
    rules.push('Первые 3 месяца — только сбор статистики. Не жди прибыли, цель — данные для анализа');
  } else if (a.experience === 'professional') {
    rules.push('Отслеживай движение линий: резкий сдвиг кэфа за 1–2 часа до матча сигнализирует о закрытой информации');
  } else {
    rules.push('Веди детальную статистику по каждому типу ставок — отсеивай неработающие рынки раз в месяц');
  }

  // Sport-based
  if (a.sport === 'football') {
    rules.push('Изучай форму команд за последние 5 матчей и H2H — особенно важно на своём/чужом поле');
  } else if (a.sport === 'esports') {
    rules.push('Следи за актуальными составами: замены игроков за 24 часа до матча резко меняют шансы');
  } else if (a.sport === 'tennis') {
    rules.push('Учитывай покрытие корта и физическую нагрузку предыдущих турниров — теннис физически затратен');
  } else if (a.sport === 'hockey') {
    rules.push('До 40% успеха в хоккее определяет вратарь — всегда проверяй кто защищает перед ставкой');
  } else {
    rules.push('Специализируйся максимум на 2–3 видах спорта — распыление по 5+ снижает ROI вдвое');
  }

  // Time/goal-based
  if (a.timePerDay === 'minimal') {
    rules.push('С ограниченным временем ставь только топ-матчи: больше медиаосвещения = меньше ошибок в оценке');
  } else if (a.timePerDay === 'intensive' && a.experience !== 'beginner') {
    rules.push('Используй live-мониторинг линий — резкий сдвиг кэфа за 1–2 часа до матча часто содержит value');
  } else if (a.goal === 'income' || a.goal === 'professional') {
    rules.push('Целевой ROI: стабильные 5–8% в месяц дают 60–100% роста банкролла за год');
  } else {
    rules.push('Установи личный лимит потерь в месяц и не нарушай его ни при каких обстоятельствах');
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

function buildOddsRationale(a: StrategyAnswers): string {
  if (a.oddsRange === 'low') {
    return 'Фавориты с кэфом 1.30–1.70 дают 65–80% вероятность прохода. Ключ — размер ставки и дисциплина, а не погоня за высоким кэфом.';
  }
  if (a.oddsRange === 'high') {
    return 'Высокий кэф (2.50+) означает вероятность прохода 40% и ниже. Для прибыли нужна большая выборка (200+ ставок) и строгий отбор.';
  }
  return 'Диапазон 1.70–2.50 — оптимальный: достаточная вероятность прохода (40–60%) при приемлемом доходе. Большинство value находится именно здесь.';
}

// ── Bet type rationale ──────────────────────────────────────────────────────

function buildBetTypeRationale(a: StrategyAnswers): string {
  const rationales: Record<string, string> = {
    football: 'Тоталы (ТБ/ТМ) и форы в футболе содержат больше value, чем 1X2 — букмекеры точнее ценят победителей, но ошибаются в счёте.',
    hockey:   'В хоккее тоталы ±0.5 шайбы и форы -1.5/+1.5 часто переоценены — хорошая почва для value.',
    tennis:   'Форы по геймам дают лучшую маржу в теннисе. Исходы сетов — для тех, кто отслеживает физическое состояние.',
    esports:  'Форы по картам и раундам — основной рынок для value в киберспорте. Исходы слишком популярны у казуальной аудитории.',
    mixed:    'При работе с несколькими видами спорта сосредоточься на исходах и тоталах — они проще всего поддаются анализу.',
  };
  return rationales[a.sport] ?? 'Выбирай рынки, где у тебя есть конкурентное преимущество над букмекером.';
}

// ── Main builder ────────────────────────────────────────────────────────────

export function buildStrategy(answers: StrategyAnswers): GeneratedStrategy {
  const { goal, risk, experience, oddsRange, timePerDay, betTypes, sport, tiltReaction, priority, bankroll } = answers;

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
  const betTypeAdvice =
    betTypes === 'singles' ? 'Только ординары' :
    betTypes === 'express' ? 'Экспрессы 2–3 события' :
    'Ординары (80%) + редкие экспрессы на 2 события';

  // ── Sport advice ─────────────────────────────────────────────────
  const sportLabels: Record<string, string> = {
    football: 'Футбол', hockey: 'Хоккей', tennis: 'Теннис',
    esports: 'Киберспорт', mixed: 'Несколько видов',
  };
  const sportAdvice = sportLabels[sport] ?? sport;

  const name = strategyName(goal, risk, experience);

  return {
    name,
    description: strategyDescription(name),
    betsPerDay,
    stakePercent,
    oddsMin: oddsMin!,
    oddsMax: oddsMax!,
    kellyMultiplier,
    tiltThreshold,
    betTypeAdvice,
    sportAdvice,
    rationale: buildRationale(answers),
    keyPrinciples: buildKeyPrinciples(answers),
    recommendedApproaches: buildRecommendedApproaches(answers),
    recommendedBetTypes: buildRecommendedBetTypes(answers),
    betTypeRationale: buildBetTypeRationale(answers),
    oddsRationale: buildOddsRationale(answers),
    createdAt: new Date().toISOString(),
    answers,
  };
}
