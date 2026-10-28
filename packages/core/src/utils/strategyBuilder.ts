import type {
  StrategyAnswers, GeneratedStrategy,
  StrategyGoal, StrategyRisk, StrategyExperience,
  Strategy, BetType,
} from '../types/bet';

// ── Odds bands ──────────────────────────────────────────────────────────────
//
// ONE table for what the question offers and what the plan then sets. The
// question said "1.70 – 2.50" while the plan it produced said 1.65–2.40: the
// screen promised one range and the strategy kept another. The long-shot band
// has a top too, and the question names it: "2.50 and up" was quietly a plan
// of 2.50–4.00, and a bet at 4.50 read as outside a range nobody was shown.
export const STRATEGY_ODDS_BANDS = {
  low:  [1.30, 1.70],
  mid:  [1.70, 2.50],
  high: [2.50, 4.00],
} as const satisfies Record<'low' | 'mid' | 'high', readonly [number, number]>;

/** The numbers a saved strategy plans by — everything that checks bets against it reads these. */
export interface StrategyPlan {
  oddsMin: number;
  oddsMax: number;
  stakePercent: number;
  betsPerDay: number;
  kellyMultiplier: number;
  tiltThreshold: number;
}

/**
 * The plan of a saved strategy. The odds come from its ANSWERS, not from the
 * stored numbers: a strategy saved before the bands were fixed holds 1.65–2.40
 * for the "1.70 – 2.50" it was asked for, while its texts — rebuilt from the
 * answers — say 1.70–2.50, and the bet form would warn about a range the
 * screen never showed. A strategy without answers keeps what it stored.
 */
export function strategyPlan(s: GeneratedStrategy): StrategyPlan {
  const band = s.answers ? STRATEGY_ODDS_BANDS[s.answers.oddsRange as keyof typeof STRATEGY_ODDS_BANDS] : undefined;
  return {
    oddsMin: band ? band[0] : s.oddsMin,
    oddsMax: band ? band[1] : s.oddsMax,
    stakePercent: s.stakePercent,
    betsPerDay: s.betsPerDay,
    kellyMultiplier: s.kellyMultiplier,
    tiltThreshold: s.tiltThreshold,
  };
}

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
      { value: 'income',       label: 'Дополнительный доход',    desc: 'Хочу выйти в плюс на длинной дистанции' },
      // Not "betting as the main source of income": an app that keeps people
      // disciplined does not offer that as a goal to aim for.
      { value: 'professional', label: 'Профессиональный подход', desc: 'Отношусь к ставкам как к работе: учёт, анализ, дисциплина' },
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
      { value: 'high', label: '2.50 – 4.00', desc: 'Аутсайдеры — низкая вероятность, высокий потенциал' },
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

// ── Text ids ────────────────────────────────────────────────────────────────
//
// WHICH sentence a profile gets is decided once, here; WHAT the sentence says
// is a table per language. The mobile app translates these ids into four
// languages from its locale files, and re-derives them from the stored
// `answers` on every render — so a strategy built in Russian reads in English
// after a language switch, instead of staying frozen in the language it was
// built in. The ru/en tables below are what `buildStrategy` bakes in for the
// desktop, unchanged.

export type StrategyNameId = 'starter' | 'professional' | 'conservative' | 'aggressive' | 'value' | 'balanced' | 'underdog';

/** Sentences of the "why this fits you" paragraph, in order. `intro` takes the goal and experience. */
export type StrategyRationaleId =
  | 'intro'
  | 'risk.conservative' | 'risk.moderate' | 'risk.aggressive'
  | 'exp.beginner' | 'exp.experienced' | 'exp.professional'
  | 'time.minimal' | 'time.intensive';

export type StrategyPrincipleId =
  | 'risk.conservative' | 'risk.moderate' | 'risk.aggressive'
  | 'exp.beginner' | 'exp.experienced' | 'exp.professional'
  | 'sport.football' | 'sport.hockey' | 'sport.tennis' | 'sport.esports' | 'sport.mixed'
  | 'focus.topMatches' | 'focus.liveLines' | 'focus.roiTarget' | 'focus.lossLimit';

export interface StrategyTextIds {
  name: StrategyNameId;
  rationale: StrategyRationaleId[];
  principles: StrategyPrincipleId[];
  odds: 'low' | 'mid' | 'high';
  /** A sport id, or 'default' for one the table does not know. */
  betTypeRationale: string;
  betTypeAdvice: 'singles' | 'express' | 'both';
}

/**
 * The name follows the STAKE (the share of the bank a bet risks), and its
 * description says nothing the plan's numbers contradict. A careful bettor
 * who works the 2.50+ range was named "Консервативная" with a text about
 * favourites — 7 200 profiles: small stakes on long shots get their own name.
 */
function nameId(a: StrategyAnswers): StrategyNameId {
  if (a.experience === 'beginner') return 'starter';
  if (a.goal === 'professional' && a.experience === 'professional') return 'professional';
  if (a.risk === 'conservative') return a.oddsRange === 'high' ? 'underdog' : 'conservative';
  if (a.risk === 'aggressive') return 'aggressive';
  if (a.goal === 'income' && a.risk === 'moderate') return 'value';
  return 'balanced';
}

function rationaleIds(a: StrategyAnswers): StrategyRationaleId[] {
  const ids: StrategyRationaleId[] = ['intro'];
  ids.push(a.risk === 'conservative' ? 'risk.conservative' : a.risk === 'aggressive' ? 'risk.aggressive' : 'risk.moderate');
  ids.push(a.experience === 'beginner' ? 'exp.beginner' : a.experience === 'professional' ? 'exp.professional' : 'exp.experienced');
  if (a.timePerDay === 'minimal') ids.push('time.minimal');
  else if (a.timePerDay === 'intensive') ids.push('time.intensive');
  return ids;
}

const PRINCIPLE_SPORTS = new Set(['football', 'hockey', 'tennis', 'esports']);

function principleIds(a: StrategyAnswers): StrategyPrincipleId[] {
  const ids: StrategyPrincipleId[] = [];
  ids.push(a.risk === 'conservative' ? 'risk.conservative' : a.risk === 'moderate' ? 'risk.moderate' : 'risk.aggressive');
  ids.push(a.experience === 'beginner' ? 'exp.beginner' : a.experience === 'professional' ? 'exp.professional' : 'exp.experienced');
  ids.push(PRINCIPLE_SPORTS.has(a.sport) ? (`sport.${a.sport}` as StrategyPrincipleId) : 'sport.mixed');
  if (a.timePerDay === 'minimal') ids.push('focus.topMatches');
  else if (a.timePerDay === 'intensive' && a.experience !== 'beginner') ids.push('focus.liveLines');
  else if (a.goal === 'income' || a.goal === 'professional') ids.push('focus.roiTarget');
  else ids.push('focus.lossLimit');
  return ids.slice(0, 4);
}

const BET_TYPE_RATIONALE_SPORTS = new Set(['football', 'hockey', 'tennis', 'esports', 'mixed']);

export function strategyTextIds(a: StrategyAnswers): StrategyTextIds {
  return {
    name: nameId(a),
    rationale: rationaleIds(a),
    principles: principleIds(a),
    odds: a.oddsRange === 'low' ? 'low' : a.oddsRange === 'high' ? 'high' : 'mid',
    betTypeRationale: BET_TYPE_RATIONALE_SPORTS.has(a.sport) ? a.sport : 'default',
    betTypeAdvice: a.betTypes === 'singles' ? 'singles' : a.betTypes === 'express' ? 'express' : 'both',
  };
}

// ── ru / en text (desktop bakes these in) ───────────────────────────────────

interface TextTable {
  name: Record<StrategyNameId, string>;
  description: Record<StrategyNameId, string>;
  goal: Record<string, string>;
  profile: Record<string, string>;
  intro: (goal: string, profile: string) => string;
  rationale: Record<Exclude<StrategyRationaleId, 'intro'>, string>;
  principles: Record<StrategyPrincipleId, string>;
  odds: Record<StrategyTextIds['odds'], string>;
  betTypeRationale: Record<string, string>;
  betTypeAdvice: Record<StrategyTextIds['betTypeAdvice'], string>;
  sport: Record<string, string>;
}

const RU: TextTable = {
  name: {
    starter: 'Стартовая', professional: 'Профессиональная', conservative: 'Консервативная',
    aggressive: 'Агрессивная', value: 'Ценностная', balanced: 'Сбалансированная', underdog: 'Аутсайдерская',
  },
  description: {
    starter:      'Небольшие ставки, пока копится опыт. Главное — дисциплина и честная статистика по каждой ставке.',
    professional: 'Высокая вовлечённость, детальный анализ и строгий контроль банкролла. Ставки только на хорошо изученные события.',
    conservative: 'Защита банка в приоритете: маленькая доля банка на ставку и строгий отбор событий.',
    aggressive:   'Крупная доля банка на ставку: банк может быстро расти — и так же быстро падать. Нужны жёсткий стоп-лосс и дисциплина.',
    value:        'Поиск ставок, где твоя оценка шанса выше той, что заложена в коэффициент. Умеренный риск, результат — только на длинной дистанции.',
    balanced:     'Умеренная доля банка на ставку и разные рынки под контролем банкролла.',
    underdog:     'Высокие коэффициенты при маленькой ставке. Каждая ставка рискует малым, но серии поражений будут длинными — судить о результате стоит после 200+ ставок.',
  },
  goal: { hobby: 'как хобби', income: 'для дополнительного дохода', professional: 'как к работе' },
  profile: { beginner: 'начинающего беттора', experienced: 'опытного беттора', professional: 'профессионального беттора' },
  intro: (goal, profile) => `Ты подходишь к ставкам ${goal}. Профиль ${profile}.`,
  rationale: {
    'risk.conservative': 'Консервативный подход защищает банкролл от крупных просадок — в приоритете сохранение капитала.',
    'risk.aggressive':   'Высокая терпимость к риску допускает крупную долю банка на ставку — но и просадки будут глубже, поэтому нужен жёсткий стоп-лосс.',
    'risk.moderate':     'Умеренный риск: ставка достаточно заметная, чтобы видеть результат, и достаточно малая, чтобы пережить серию поражений.',
    'exp.beginner':      'На старте важнее всего собрать 100+ ставок для достоверной статистики: до этого результат — в основном случайность.',
    'exp.professional':  'Профессиональный уровень позволяет работать с движением линий, live-ставками и поиском value.',
    'exp.experienced':   'Накопленный опыт позволяет отделять ценные ставки от шума и строить стратегию на данных, а не на интуиции.',
    'time.minimal':      'С ограниченным временем ставь только на матчи с обилием информации — не угадывай по малоизученным событиям.',
    'time.intensive':    'Больше времени — больше возможностей: сравнивать линии разных букмекеров и следить за новостями до матча.',
  },
  principles: {
    'risk.conservative': 'Пропустить событие — не потеря: ставь только когда твоя оценка шанса выше той, что заложена в коэффициент',
    'risk.moderate':     'Не меняй размер ставки в зависимости от «уверенности» — дисциплина важнее интуиции',
    'risk.aggressive':   'Жёсткий стоп-лосс: просадка 25% банкролла за неделю = пауза минимум 3 дня',
    'exp.beginner':      'Первые 3 месяца — только сбор статистики. Не жди прибыли, цель — данные для анализа',
    'exp.professional':  'Следи за движением линий: резкий сдвиг коэффициента перед матчем обычно отражает новости — составы, травмы, крупные ставки',
    'exp.experienced':   'Веди детальную статистику по каждому типу ставок — отсеивай неработающие рынки раз в месяц',
    'sport.football':    'Изучай форму команд за последние 5 матчей и H2H — особенно важно на своём/чужом поле',
    'sport.esports':     'Следи за актуальными составами: замены игроков за 24 часа до матча резко меняют шансы',
    'sport.tennis':      'Учитывай покрытие корта и физическую нагрузку предыдущих турниров — теннис физически затратен',
    'sport.hockey':      'Перед ставкой проверяй, кто стоит в воротах: смена вратаря заметно меняет и шансы, и тоталы',
    'sport.mixed':       'Специализируйся на 2–3 видах спорта: глубокое знание нескольких лиг полезнее поверхностного знания многих',
    'focus.topMatches':  'С ограниченным временем ставь только топ-матчи: больше медиаосвещения = меньше ошибок в оценке',
    'focus.liveLines':   'Сравнивай свой коэффициент с коэффициентом закрытия: если ты регулярно берёшь цену лучше закрытия, ты находишь value (CLV в Аналитике)',
    'focus.roiTarget':   'Оценивай ROI на дистанции от 100 ставок, а не по месяцу: на коротком отрезке результат — это в основном дисперсия',
    'focus.lossLimit':   'Установи личный лимит потерь в месяц и не нарушай его ни при каких обстоятельствах',
  },
  odds: {
    low:  'Коэффициенты 1.30–1.70 — это примерно 59–77% шанса по оценке букмекера. Выигрыш с одной ставки мал, поэтому ключ — размер ставки и дисциплина, а не погоня за высоким коэффициентом.',
    high: 'Коэффициенты 2.50–4.00 — это примерно 25–40% шанса по оценке букмекера. Серии поражений будут длинными: для выводов нужна большая выборка (200+ ставок) и строгий отбор.',
    mid:  'Коэффициенты 1.70–2.50 — это примерно 40–59% шанса по оценке букмекера: заметный выигрыш при умеренных сериях поражений.',
  },
  betTypeRationale: {
    football: 'Кроме исхода смотри тоталы и форы: их проще связать с собственной оценкой голов и формы, чем чистую победу.',
    hockey:   'Тоталы и форы −1.5/+1.5 удобно разбирать по статистике бросков и по вратарям.',
    tennis:   'Форы по геймам позволяют играть на разнице в классе, не ставя на чистую победу; учитывай покрытие и усталость.',
    esports:  'Форы по картам и раундам — ставка на разницу в силе, а не только на победителя; следи за пулом карт и составами.',
    mixed:    'При работе с несколькими видами спорта сосредоточься на исходах и тоталах — они проще всего поддаются анализу.',
    default:  'Выбирай рынки, где у тебя есть конкурентное преимущество над букмекером.',
  },
  betTypeAdvice: { singles: 'Только ординары', express: 'Экспрессы 2–3 события', both: 'Ординары (80%) + редкие экспрессы на 2 события' },
  sport: { football: 'Футбол', hockey: 'Хоккей', tennis: 'Теннис', esports: 'Киберспорт', mixed: 'Несколько видов' },
};

const EN: TextTable = {
  name: {
    starter: 'Starter', professional: 'Professional', conservative: 'Conservative',
    aggressive: 'Aggressive', value: 'Value Betting', balanced: 'Balanced', underdog: 'Underdog',
  },
  description: {
    starter:      'Small stakes while you build experience. The point is discipline and honest stats on every bet.',
    professional: 'Deep involvement, detailed analysis and strict bankroll management. Bet only on well-researched events.',
    conservative: 'Protecting the bankroll comes first: a small share of the bank per bet and strict selection.',
    aggressive:   'A large share of the bank per bet: the bankroll can grow fast — and fall just as fast. Needs a hard stop-loss and discipline.',
    value:        'Look for bets where your estimate of the chance is higher than the one built into the odds. Moderate risk; results show only over a long run.',
    balanced:     'A moderate share of the bank per bet and a mix of markets, with the bankroll under control.',
    underdog:     'High odds at small stakes. Each bet risks little, but losing runs will be long — judge the result after 200+ bets.',
  },
  goal: { hobby: 'as a hobby', income: 'for extra income', professional: 'like a job' },
  profile: { beginner: 'beginner', experienced: 'experienced bettor', professional: 'professional bettor' },
  intro: (goal, profile) => `You approach betting ${goal}. Profile: ${profile}.`,
  rationale: {
    'risk.conservative': 'A conservative approach protects the bankroll from large drawdowns — preserving capital is the priority.',
    'risk.aggressive':   'High risk tolerance allows a large share of the bank per bet — but drawdowns will be deeper, so a hard stop-loss is a must.',
    'risk.moderate':     'Moderate risk: a stake big enough to see results and small enough to survive a losing run.',
    'exp.beginner':      'At the start, the most important thing is to collect 100+ bets for reliable stats: before that, results are mostly chance.',
    'exp.professional':  'Professional-level experience lets you work with line movement, live betting and value hunting.',
    'exp.experienced':   'Accumulated experience lets you separate value bets from noise and build strategy on data, not intuition.',
    'time.minimal':      'With limited time, bet only on well-covered matches — don\'t guess on poorly-researched events.',
    'time.intensive':    'More time means more options: comparing lines across bookmakers and following news before the match.',
  },
  principles: {
    'risk.conservative': 'Skipping an event is not a loss: bet only when your estimate of the chance beats the one built into the odds',
    'risk.moderate':     'Don\'t adjust stake size based on "confidence" — discipline beats intuition',
    'risk.aggressive':   'Hard stop-loss: a 25% drawdown in one week means a minimum 3-day break',
    'exp.beginner':      'First 3 months: data collection only. Don\'t expect profit — the goal is stats for analysis',
    'exp.professional':  'Watch line movement: a sharp shift before the match usually reflects news — lineups, injuries, big money',
    'exp.experienced':   'Keep detailed stats per bet type — cut non-performing markets once a month',
    'sport.football':    'Study last 5 matches and H2H — home/away form is especially important in football',
    'sport.esports':     'Watch active rosters: player substitutions 24h before a match sharply change the odds',
    'sport.tennis':      'Factor in court surface and physical load from recent tournaments — tennis is physically demanding',
    'sport.hockey':      'Before betting, check who is in goal: a goaltender change noticeably shifts both the odds and the totals',
    'sport.mixed':       'Specialise in 2–3 sports: knowing a few leagues deeply beats knowing many superficially',
    'focus.topMatches':  'With limited time, bet only on top matches: more media coverage = fewer mispriced events',
    'focus.liveLines':   'Compare your odds with the closing odds: regularly beating the close is the clearest sign you find value (CLV in Analytics)',
    'focus.roiTarget':   'Judge ROI over 100+ bets, not by the month: over a short stretch the result is mostly variance',
    'focus.lossLimit':   'Set a personal monthly loss limit and never break it under any circumstances',
  },
  odds: {
    low:  'Odds of 1.30–1.70 mean roughly a 59–77% chance by the bookmaker\'s estimate. Each win pays little, so the key is stake size and discipline, not chasing high odds.',
    high: 'Odds of 2.50–4.00 mean roughly a 25–40% chance by the bookmaker\'s estimate. Losing runs will be long: conclusions need a large sample (200+ bets) and strict selection.',
    mid:  'Odds of 1.70–2.50 mean roughly a 40–59% chance by the bookmaker\'s estimate: a meaningful payout with moderate losing runs.',
  },
  betTypeRationale: {
    football: 'Beyond the result, look at totals and handicaps: they are easier to tie to your own read of goals and form than an outright win.',
    hockey:   'Totals and −1.5/+1.5 handicaps are easiest to work out from shot stats and the goaltenders.',
    tennis:   'Game handicaps let you play the gap in class without betting on an outright win; factor in the surface and fatigue.',
    esports:  'Map and round handicaps bet on the gap in strength, not just the winner; follow the map pool and rosters.',
    mixed:    'When covering multiple sports, focus on outrights and totals — they are easiest to analyse consistently.',
    default:  'Choose markets where you have a competitive edge over the bookmaker.',
  },
  betTypeAdvice: { singles: 'Singles only', express: 'Accumulators 2–3 events', both: 'Singles (80%) + occasional 2-event accas' },
  sport: { football: 'Football', hockey: 'Hockey', tennis: 'Tennis', esports: 'Esports', mixed: 'Multiple sports' },
};

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

// ── Main builder ────────────────────────────────────────────────────────────

export function buildStrategy(answers: StrategyAnswers, lang = 'ru'): GeneratedStrategy {
  const { goal, risk, experience, oddsRange, timePerDay, sport, tiltReaction, priority, bankroll } = answers;
  const T = lang === 'ru' ? RU : EN;
  const ids = strategyTextIds(answers);

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
  const [oddsMin, oddsMax] = STRATEGY_ODDS_BANDS[oddsRange as keyof typeof STRATEGY_ODDS_BANDS] ?? STRATEGY_ODDS_BANDS.mid;

  // ── Kelly multiplier ─────────────────────────────────────────────
  const kellyMap: Record<string, number> = { conservative: 0.25, moderate: 0.5, aggressive: 0.75 };
  let kelly = kellyMap[risk] ?? 0.5;
  if (experience === 'beginner') kelly = Math.min(kelly, 0.25);
  if (experience === 'professional' && goal === 'professional') kelly = Math.min(0.9, kelly * 1.2);
  const kellyMultiplier = Math.round(kelly * 100) / 100;

  // ── Tilt threshold ───────────────────────────────────────────────
  const tiltMap: Record<string, number> = { stop: 2, reduce: 3, continue: 4 };
  const tiltThreshold = tiltMap[tiltReaction] ?? 3;

  return {
    name: T.name[ids.name],
    description: T.description[ids.name],
    betsPerDay,
    stakePercent,
    oddsMin,
    oddsMax,
    kellyMultiplier,
    tiltThreshold,
    betTypeAdvice: T.betTypeAdvice[ids.betTypeAdvice],
    sportAdvice: T.sport[sport] ?? sport,
    rationale: ids.rationale.map((id) => id === 'intro'
      ? T.intro(T.goal[goal] ?? goal, T.profile[experience] ?? experience)
      : T.rationale[id]).join(' '),
    keyPrinciples: ids.principles.map((id) => T.principles[id]),
    recommendedApproaches: buildRecommendedApproaches(answers),
    recommendedBetTypes: buildRecommendedBetTypes(answers),
    betTypeRationale: T.betTypeRationale[ids.betTypeRationale]!,
    oddsRationale: T.odds[ids.odds],
    createdAt: new Date().toISOString(),
    answers,
  };
}
