# SharkLog — AI Session Context

Read this at the start of every session. Always develop on `claude/busy-shannon-jQgRK`, never push to `main` directly.

> Старый обзор. Основной и актуальный источник правил — `CLAUDE.md`; при расхождении прав он.

---

## Monorepo

```
apps/mobile/src/
  screens/
    BetsScreen/              — полоса контекста сверху: Сегодня (P&L/ставок/оборот) · В игре (сумма незакрытых
                               ставок = экспозиция) · Банк (тап → Bankroll)
                               SectionList с датами + daily P&L, search, status filter (scroll), sort row,
                               swipe-to-delete, haptics; quick-result chips W/L/R/C
                               BetCard: тап «C» раскрывает inline-поле суммы выкупа (не открывает полный редактор)
    PendingScreen/           — «Ждут результата»: незакрытые ставки по времени матча (старые сверху),
                               шапка: экспозиция / потенциальный возврат / «пора закрыть» (матч давно прошёл),
                               строки = BetCard (W/L/R/C + inline-выкуп). Вход: тап «В игре» на Ставках
    AddBetScreen/            — react-hook-form, SingleTeamInput (поле команды с подсказками — из самих ставок, teamsFromBets;
                               выбор команды ставит её спорт и дисциплину, но не поверх выбранного — utils/teamPick),
                               дата и «Начало матча» (ЧЧ:ММ, parseClock) на самой форме + строка «Напомню о результате около …»
                               (только когда напоминание может прийти — remindersCanCome), Kelly calculator (collapsible),
                               tournament/league TextInput field, «Кэф закрытия (CLV)» optional field, status includes cashout
                               KeyboardAvoidingView: 'padding' iOS / 'height' Android
                               TournamentInput получает scrollRef → scrollToEnd при фокусе (клавиатура не перекрывает)
    DashboardScreen/         — ПЕРЕРАБОТАН: убраны дублирующие аналитику блоки (P&L/ROI/винрейт/банк-плитки,
                               P&L-кривая, текущая серия). Сверху TurnoverCard: оборот по фильтру периода
                               + банкролл (тап → Bankroll). Главный блок — DailyDashboardCard: интерактивный
                               график за 10 календарных дней (бары выигрыш/проигрыш + линия P&L + маркеры
                               деп/выводов), тап по дню → оборот/выигрыш/проигрыш/профит, сводка окна.
                               Кнопка «Развернуть» → ExpandedDashboard (ландшафт через rotate-трансформ,
                               БЕЗ нативной зависимости): фильтры дней (без ставок / без результата),
                               тумблеры графика (P&L / Баланс / Деп-выводы), полная таблица по дням.
                               Ниже: W/L strip, тепловая карта (collapsible), последние ставки
    DashboardScreen/DailyChart.tsx      — бары (View) + линии P&L/баланса и маркеры кэша (react-native-svg);
                               SERIES — палитра серий; ChartLegend
    DashboardScreen/ExpandedDashboard.tsx — ландшафтная модалка (rotate 90°), фильтры + таблица дней
    AnalyticsScreen/         — РЕДИЗАЙН: hero-состояние (P&L+спарклайн, серии, рекорды,
                               «Перевес и риск» = WR vs безубыток + макс.просадка + бейдж малой выборки,
                               прошлый месяц с трендом + 6-мес бары, время-донат 6 промежутков + топ-4 часа
                               с P&L 12/24h, CLV) + collapsible «Расширенная статистика»
                               (sport/betType/bookmaker/strategy/odds/day). PRO via ProGate.
                               MiniTile: фикс. полосы label(2 строки)/value/sub — числа не «скачут» по высоте
    InsightsScreen/          — period filter; Tournaments table (Free); Favorite Teams cards (PRO via ProGate)
    BankrollScreen/          — кривая банкролла через components/BalanceChart (свой SVG): подневная агрегация
                               (читаемый тренд вместо пиков по каждой ставке), nice-шкала по Y,
                               РАБОЧИЕ метки депозитов/выводов — gifted-charts глотал customDataPoint под hideDataPoints;
                               сводка банкролла, inline deposit/withdrawal, Kelly (PRO)
    DisciplineScreen/        — mood picker (1-5), тилт-стата (X/N лимит для PRO), 8 правил, diary
    SettingsScreen/          — Stepper для PRO настроек, paywall modal, clearAll, export, notifications,
                               "Билдер стратегий" кнопка для PRO → navigate('StrategyBuilder')
    OnboardingScreen/        — 3 шага: welcome (logo image) → стартовый банкролл → букмекеры
    StrategyBuilderScreen/   — PRO: прогресс-бар + 10 вопросов + результат + "Применить стратегию" (только план / + тилт и лимит в Настройки),
                               «Отключить / Включить стратегию»
    GoalsScreen/             — «Цели»: карточки активных целей (прогресс, срок, «нужно в месяц»; в Pro — темп,
                               прогноз, проверка реальностью), блок «Как считается» на каждой карточке, график у
                               главной, архив. Кнопка главной цели — GoalPill в шапке «Ставок»
    GoalEditScreen/          — форма цели: вид (имя + фраза «что считается»), название, сумма (подпись по
                               виду), начало и срок — календарь DateField (у срока чипы 3 мес./6 мес./1 г./3 г.)
  components/
    ErrorBoundary.tsx        — React class component; friendly RN error screen + reload button
    ProGate.tsx              — пейвол: в сборке RuStore — «Pro навсегда» через Робокассу, в сборке Google Play — подписки RevenueCat
    DateField.tsx            — дата как поле + шит с календарём (свой, в теме и на языке приложения); сетка — utils/calendar
    FilterPicker.tsx         — кнопка + шит выбора; у варианта `hint` (цифры, моноширинный) или `description` (слова)
    ScreenHeader.tsx         — title + subtitle + optional right CTA (не используется в stack-экранах)
    ChecklistModal.tsx       — 5 вопросов перед ставкой, только PRO
    StatusBadge.tsx          — цветной бейдж статуса ставки (pending/won/lost/refund/cashout)
    DrawerContext.tsx        — React Context: openDrawer() для всех экранов
    AnimatedSplash.tsx       — анимация "Сигнал": 3 staggered scaleX-линии + типографика
                               + 12 строк × 4 коэффициента на всю высоту экрана (top 3%…93%, rowOps в одном useRef,
                               строка ярко 0.22 → тускло 0 стаггером 170ms, свет бежит сверху вниз);
                               2400ms фиксировано, все useNativeDriver:true, onFinish() callback
    ResponsibleGamblingBanner.tsx — коллапсируемый 18+ баннер (AsyncStorage @sharklog/responsible_expanded)
  navigation/
    RootNavigator.tsx        — Stack: Drawer + AddBet (modal) + Bankroll + Goals + GoalEdit + StrategyBuilder + Partners + BetsFilter
                               + Pending + Support
    DrawerNavigator.tsx      — кастомный анимированный drawer (заменяет таббар)
                               Animated.timing 240 мс с Easing.out (открытие; пружину запрещает drawerMotion.test.ts) / Animated.timing (закрытие)
                               DrawerContext — openDrawer() доступен из любого экрана
                               FAB «+» — виден ТОЛЬКО на экране Ставок ({screen === 'Bets'})
                               Разделы: Ставки | Дашборд | Инсайты | Аналитика | Дисциплина | Настройки
                               Вторичные: Банкролл | Стратегии (PRO) | Партнёры
  services/
    revenueCat.ts            — initRevenueCat, getOfferings, purchasePackage, restorePurchases, syncEntitlement
    crashReport.ts           — свой отчёт об ошибке (вместо Sentry): reportFor, installCrashCapture, takeLastCrashReport
  store/
    betsStore.ts             — Zustand + AsyncStorage; addBet, updateBet, deleteBet,
                               updateSettings, updateBankroll, addDiaryEntry, deleteTeam, clearAll, canAddBet
                               Exports: defaultSettings, defaultBankroll (used in tests)
  theme/
    colors.ts                — лестница поверхностей (bg/bgCard/bgElevated/bgSunken/border/borderStrong)
                               + alpha(), toneSurface(), TONE_ACCENT, тип CardTone
    chartColors.ts           — SERIES: единая палитра серий для всех графиков
  components/Card.tsx        — общая оболочка карточки: тон (neutral/profit/loss/warn/info/violet/pink),
                               тонированный фон + цветная граница + рейл у заголовка + тень; tileStyle для вложенных плиток
  utils/
    haptics.ts               — haptic.selection/light/medium/heavy/success/warning/error
    notifications.ts         — scheduleDailyReminder (20:00), sendTiltNotification, requestNotificationPermission
                               + напоминание о результате: registerBetResultCategory (кнопки Выиграла/Проиграла/Позже),
                               scheduleBetResultReminder(bet) на время конца матча (старт + END_OFFSET_MIN по спорту),
                               cancel(All)BetResultReminder — стор сам ставит/снимает их в addBet/updateBet/deleteBet
                               dismissBetResultNotification — убрать уже доставленное из шторки
                               reminderFireAt(bet) — момент напоминания (дата + время матча + длительность спорта)
                               snoozeBetResultReminder — «Позже»: снять с шторки и вернуть через час (SNOOZE_MIN)
                               readBetResultAction — разбор ответа на кнопку; notificationPermission — без запроса
                               syncBetResultReminders(bets, enabled) — сверка расписания с реальностью
                               (запуск + каждый возврат в foreground); setBetPendingResolver — глушилка показа
                               в foreground, чтобы напоминание НЕ пришло по уже закрытой ставке
    exportCSV.ts             — CSV с UTF-8 BOM, expo-file-system + expo-sharing
    useFormatMoney.ts        — хук: useFormatMoney() → (kopecks) => string; учитывает settings.roundAmounts
    chartScale.ts            — chartScale(vals) → nice-шкала для gifted-charts (maxValue/stepValue/noOfSections,
                               negative-квадрант ТОЛЬКО при отрицательных данных), chartHeightForBudget, formatChartYLabel
                               ВАЖНО: не передавать mostNegativeValue вручную — библиотека рисует полную секцию
                               ниже нуля и добавляет её высоту к контейнеру (переполнение карточки)
    ../components/BalanceChart.tsx — SVG-график баланса по дням: area+линия, Y-подписи (chartScale),
                               маркеры депозит/вывод точками прямо на линии
    ../theme/chartColors.ts  — SERIES: единая палитра серий для всех графиков
    clockFormat.ts           — uses12HourClock() → true если система в 12h (Intl.formatToParts dayPeriod)
  __tests__/
    betsStore.test.ts        — стор: canAddBet, addBet, deleteBet, updateBet, clearAll, команды экспресса, clearAll сохраняет настройки, эффективные лимиты
    __mocks__/
      async-storage.ts       — in-memory AsyncStorage mock
      notifications.ts       — jest.fn() stubs for scheduleDailyReminder/sendTiltNotification

apps/desktop/src/            — React+Vite frontend (TypeScript strict), Tauri v2 backend (src-tauri/)
  App.tsx                    — routing (9 pages, включая Партнёры), modal state, Cmd+N hotkey, Esc to close;
                               isLoaded guard (logo spinner), onboarding gate, ErrorBoundary wrapper
  layouts/
    AppLayout.tsx            — sidebar: logo image, nav (9 items, PRO badge на strategy), "+ Новая ставка",
                               free progress bar
  components/
    ErrorBoundary.tsx        — React class component; friendly web error screen + retry/reload
    ChecklistModal.tsx       — 5 вопросов перед ставкой (PRO)
    ConfirmModal.tsx         — подтверждение деструктивных действий
    Toaster.tsx              — toast уведомления
  storage/
    storageService.ts        — IS_TAURI detection → SQLite (kv table) or localStorage fallback
                               loadData(): Promise<object|null>, saveData(data): Promise<void>
  store/
    betsStore.ts             — Zustand; load(): Promise<void>, persist() fire-and-forget
                               VITE_OWNER_PRO=true → isPro=true on init
                               Exports: defaultSettings, defaultBankroll (used in tests)
  pages/
    DashboardPage.tsx        — period filter, 6-stat grid, W/L strip, 12-week heatmap, P&L chart,
                               best/worst, empty state, strategy badge (кликабельная, → 'strategy' page)
    BetsPage.tsx             — date-grouped sections (tbody), daily P&L per section, search,
                               status filter (pending/won/lost/refund/cashout), sort (4 modes),
                               quick-result buttons W/L/R/C
    AddBetModal.tsx          — full form with SingleTeamInput + tournament datalist autocomplete,
                               canAddBet() guard, limit banner, potential win preview,
                               status includes cashout; clipboard paste pre-fill
    AnalyticsPage.tsx        — 7 срезов: sport/betType/bookmaker/strategy/oddsRange/dayOfWeek/hour (PRO)
                               + "Топ турниры" mini-cards block (calcByTournament)
    InsightsPage.tsx         — period filter; TournamentsSection table (Free);
                               TeamsSection card grid (PRO, calcByTeam minBets=10)
    BankrollPage.tsx         — equity curve, unit stepper, Kelly calc, deposit/withdrawal, PRO gate
    DiaryPage.tsx            — mood picker, tilt stats, 8 правил, diary history
    SettingsPage.tsx         — subscription, tilt stepper, daily limit stepper, bookmakers, teams,
                               CSV+XLSX import, CSV+JSON export, JSON import/restore,
                               "О приложении" card with version + check-for-updates button
    OnboardingPage.tsx       — 3-step wizard: welcome → bookmakers → ready
    StrategyBuilderPage.tsx  — PRO: progress bar + 10 questions + ResultCard + "Применить стратегию"
  utils/
    importBets.ts            — importFromCSV(content), importFromXLSX(buffer) → ImportResult
                               Column aliases (RU/EN), status map (including cashout), date normalization
    clipboardParser.ts       — parseClipboard(text) → Partial<Bet>; Variant A: paste to pre-fill AddBet
  theme/
    colors.ts                — same palette as mobile
  test/
    setup.ts                 — vi.mock for @tauri-apps/plugin-sql + storageService
  store/
    betsStore.test.ts        — 14 smoke tests
  utils/
    importBets.test.ts       — 26 tests for CSV/XLSX parsing

  apps/desktop/src-tauri/    — Tauri v2 Rust backend
    tauri.conf.json          — productName, identifier, window config, bundle targets,
                               createUpdaterArtifacts: true, updater plugin config
    Cargo.toml               — tauri 2.x, tauri-plugin-opener, tauri-plugin-sql (sqlite),
                               tauri-plugin-updater
    src/main.rs + lib.rs     — entry point; registers sql + updater plugins
    icons/                   — full icon set: 32/128/256/512px PNG, ICO, Windows Square tiles, AppImage.png
    gen/schemas/             — ACL capability schemas (auto-generated by cargo build)
    Cargo.lock               — committed (reproducible builds)

  apps/desktop/public/
    logo.png                 — official app logo (sidebar, loading screen, onboarding)
    logo-512.png             — high-res version

packages/core/src/
  types/bet.ts               — Bet (+ tournament?, + closingOdds? для CLV), Team, EsportsDiscipline, Bankroll, DiaryEntry,
                               AppSettings (+ generatedStrategy?), StorageSchema
                               BetStatus: 'pending'|'won'|'lost'|'refund'|'cashout'
                               Strategy types: StrategyAnswers, GeneratedStrategy + 10 answer union types
  constants/index.ts         — SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, FREE_LIMITS, ODDS_RANGES
  utils/
    stats.ts                 — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek, calcByHour,
                               isInTilt, calcByTournament, calcByTeam, parseEventTeams, betPnl
                        getPickedTeams(event, pick) — внутренний хелпер для calcByTeam;
                        атрибутирует ставку только команде, на которую ставил игрок (П1/П2/Ф1/Ф2 + прямые имена)
    daily.ts                 — calcDailyBreakdown(bets, transactions, {days?, endDate?}) → DayStats[]
                               (непрерывный календарь; cumPnl/balance считаются по ВСЕЙ истории, а не по окну),
                               summarizeDays() → оборот/профит/лучший-худший день/активные дни, toYmd() — ЛОКАЛЬНАЯ дата
    analytics.ts             — calcStreaks, calcExtremes, calcLastFullMonth(bets, now), calcCLV,
                               calcTimeStats(bets, use12h) — 6 промежутков для доната + топ-4 часа с P&L,
                               calcMaxDrawdown (пик→дно кумулятивного P&L), calcEdge (WR vs безубыток 100/avgOdds),
                               calcMonthlyPnl(bets, now, months), calcMonthResult(bets, y, m) — итог любого месяца, RELIABLE_SAMPLE_MIN=100
    kelly.ts                 — kellyFraction, halfKelly, expectedValue, impliedProbability, recommendedStake
    formatters.ts            — formatMoney(kopecks, currency='₽', maxDecimals=2), parseMoneyInput, formatOdds, formatPercent (adds + prefix)
    strategyBuilder.ts       — STRATEGY_QUESTIONS (10 вопросов), buildStrategy(answers) → GeneratedStrategy
    migrations.ts            — migrate(raw)
```

---

## Data Model

```typescript
interface Bet {
  id: string;                     // UUID v4
  createdAt/updatedAt: string;    // ISO-8601
  settledAt?: string;             // ISO-8601: когда записан результат (stampSettlement); банк ставки — bankAtBetTime
  date: string;                   // YYYY-MM-DD
  time: string;                   // HH:MM
  sport: Sport;
  discipline?: EsportsDiscipline; // только когда sport === 'esports'
  bookmaker: string;
  event: string;                  // "Team A vs Team B" — парсится для team memory
  tournament?: string;            // Турнир / Лига (опционально)
  betType: BetType;
  pick: string;
  odds: number;                   // decimal (1.85)
  stake: number;                  // КОПЕЙКИ — никогда не float
  status: BetStatus;              // 'pending'|'won'|'lost'|'refund'|'cashout'
  strategy: Strategy;
  notes?: string;
  schemaVersion: number;
}

// refund = букмекер вернул ставку (например, отмена матча)
// cashout = игрок сам выкупил ставку досрочно

type BankrollTxType = 'deposit' | 'withdrawal' | 'adjustment';

interface BankrollTransaction {
  id: string;
  type: BankrollTxType;
  amount: number;                 // КОПЕЙКИ. Всегда > 0 для deposit/withdrawal — знак несёт тип.
                                  // ЗНАКОВОЕ для 'adjustment': сверка с реальным балансом бука
                                  // может уйти в обе стороны.
  date: string;                   // ISO-8601
  note?: string;
}

interface AppSettings {
  tiltThreshold: number;          // Free: фикс 3 / PRO: stepper 2–10
  dailyBetLimit: number;          // 0 = нет лимита (только PRO); ПРЕДУПРЕЖДЕНИЕ в форме, ставку не блокирует
  bookmakers: string[];
  isPro: boolean;
  onboardingComplete: boolean;
  reminderHour: number;           // час ежедневного напоминания (PRO: stepper 6–23)
  roundAmounts: boolean;          // округлять суммы до целых рублей (0 знаков после запятой)
  generatedStrategy?: GeneratedStrategy;  // PRO: сохранённая стратегия; действующая — только activeStrategy(settings)
  schemaVersion: number;
}

interface GeneratedStrategy {
  name: string;
  description: string;
  betsPerDay: number;
  stakePercent: number;
  oddsMin: number;
  oddsMax: number;
  kellyMultiplier: number;
  tiltThreshold: number;
  betTypeAdvice: string;
  sportAdvice: string;
  createdAt: string;
  answers: StrategyAnswers;
  disabled?: boolean;             // выключена пользователем: сохранена, но ставки с ней не сверяются
  // Rich output (6 optional fields добавлены для детального результата)
  rationale?: string;
  keyPrinciples?: string[];
  recommendedApproaches?: Strategy[];
  recommendedBetTypes?: BetType[];
  betTypeRationale?: string;
  oddsRationale?: string;
}

interface TournamentStats {
  tournament: string;
  sport: Sport;
  count: number;
  won: number;
  lost: number;
  winRate: number;
  totalStaked: number;   // kopecks
  pnl: number;           // kopecks
  roi: number;           // fraction (0.12 = 12%)
}

interface TeamStats {
  team: string;
  sport: Sport;
  discipline?: EsportsDiscipline;
  count: number;
  won: number;
  lost: number;
  pnl: number;
  roi: number;
  lastTournament?: string;
}
```

---

## Key Invariants

1. **Money = kopecks integer**: `1000 ₽ → 100_000`. `formatMoney()` / `parseMoneyInput()`.
2. **IDs = UUID v4**: все сущности (Bet, Team, BankrollTransaction, DiaryEntry) — UUID v4, не Date.now().
3. **Team memory**: `upsertTeams()` в store вызывается при каждом addBet/updateBet (хранимый список — в данных и бэкапе). Подсказки формы ставки мобилки — из самих ставок (`teamsFromBets`): хранимый список только добавляет, и команда ставки, перенесённой с футбола на хоккей, оставалась под обоими.
4. **Esports discipline**: `sport === 'esports'` → discipline обязателен. Compound key: `name+sport+discipline`.
5. **exactOptionalPropertyTypes: true**: `prop={undefined}` → ошибка. Используй `{...(x ? { prop: x } : {})}`.
6. **PRO gate (mobile)**: любой PRO-контент через `<ProGate feature="...">`.
7. **clearAll()**: сбрасывает bets/diary/teams/bankroll, сохраняет `onboardingComplete: true`.
8. **canAddBet()**: false ТОЛЬКО если Free && bets >= FREE_LIMITS.MAX_BETS. Дневной лимит Pro — предупреждение в форме (`effectiveDailyLimit`), ставка сохраняется.
9. **Period filter**: `b.date > cutoffStr` (НЕ `>=`) — иначе off-by-one (8 дней вместо 7).
10. **formatPercent()**: уже добавляет `+` для положительных значений — не добавляй префикс вручную.
11. **Onboarding**: новые пользователи видят OnboardingPage; существующие пользователи — `onboardingComplete ?? true` при load().
12. **refund vs cashout**: refund = возврат букмекером (отмена матча); cashout = досрочный выкуп игроком. Это два разных статуса.
13. **parseEventTeams(event)**: разбивает event по ` — `, ` – `, ` vs `, ` против `, ` - ` → массив имён команд.
14b. **Инсайты: экстремумы → топ-3 → раскрываемый остаток**, внизу разбивка по годам. Список лет — `calcBetYears` (данные + текущий год, поэтому новый год появляется сам). Разбивка считается по ВСЕЙ истории, а не по срезу периода сверху.
14a. **TournamentStats/TeamStats несут `discipline`** — доминирующую в группе и только когда `sport === 'esports'`. Инсайты показывают её вместо слова «Киберспорт».
14. **calcByTeam(bets, minBets)**: экран «Любимые команды» (PRO) передаёт `TEAM_MIN_BETS` = 5 — показываются команды с ≥5 ставками. Использует внутренний `getPickedTeams(event, pick)` — атрибутирует ставку только той команде, на которую поставил игрок. Наружу тот же предикат выведен как `betBacksTeam(bet, team)` — фильтр списка ставок обязан использовать его, иначе счётчик в списке разойдётся с числом на плитке инсайтов.
15. **Банк — только через core**: `currentBank(txs, bets) = bankCash(txs) + P&L`. Ручной `deposit ? + : -` теряет третий тип транзакции (`adjustment`), у которого знак лежит в сумме.
16. **Банк ≠ баланс у букмекера**: букмекер списывает ставку при постановке, приложение — при расчёте. `балансУБукмекера = currentBank − pendingExposure(bets)`. Первое, что надо исключить при расхождении.
17. **P&L одной ставки — только `betPnl()`**: ручные ветки по статусу уже давали выкуп нулём и проигранный фрибет полной потерей.
18. **CSV — один модуль на обе платформы**: `packages/core/utils/betsCsv`. Второй парсер по месту = разъехавшиеся алиасы и выгрузка с телефона, которая не открывается на ПК.
19. **Кумулятивные кривые — по `date + time`, не `createdAt`**: ставка задним числом иначе прыгает в конец графика.
20. **Общий кэф экспресса округляется до 2 знаков** (`combineExpressOdds`): букмекер показывает и рассчитывает именно округлённый коэффициент. Сырое произведение легов расходится с реальной выплатой на каждой ставке.
21. **Колесо действий**: тап по карточке ставки открывает `ActionWheel`, а не редактор. Набор действий — только в `useBetActions()`, общий для `BetsScreen` и `PendingScreen`. Открытое поле выкупа принадлежит родителю (`cashoutFor`), не карточке.
22. **Везение считается от нуля, а не от «в плюсе ли я»**: ставка по цене букмекера имеет нулевое матожидание, поэтому `calcLuck` меряет отклонение результата в сигмах. До 1σ — обычный разброс, от 2σ — результат вряд ли объясняется везением.
23. **Доля банка берётся на момент ввода ставки** (`bankAtBetTime`): результаты, выводы и сверки, датированные не позже её дня и записанные ДО ввода ставки, входят в её банк, записанные после — нет (на всю историю, не только в пределах дня) (`Bet.settledAt`, 2026-11-09: банк на начало дня прятал ставку почти на весь остаток после проигрышей и вывода, а порядок по времени матча судил ставки по результатам, которых при них никто не знал). Ставка, внесённая после конца своего дня (задним числом, импорт CSV), — от начала своего дня, ничего не вычитая: иначе такие ставки вычитали результаты друг друга, и итог зависел от порядка ввода.
24. **`Alert.alert` после закрытия `Modal`** откладывается на кадр — иначе алерт может быть снят вместе с размонтируемым контроллером.
25. **JSON-восстановление проходит через `migrate()`**: иначе бэкап, снятый до исправления схемы, возвращает в приложение уже вылеченные баги.
26. **Цели — данные** (`goals` рядом с дневником, в бэкапе, стираются «Очистить все данные»). Прогресс — только `calcGoalProgress` (core): `profit` — результат ставок с даты начала (депозиты не двигают), `bank` — `currentBank`, `withdraw` — выведено сверх внесённого, `lossCap` — минус календарного месяца. Free — одна открытая цель (`goalsFor`, лимит на показ, не на хранение). Тексты вида строятся из ключа (`goals.kind/kindHint/how/startHint/amount.<вид>`) — их полноту держит `goals.test.ts`.
27. **Дата из календаря, не из текстового поля**: `DateField` в форме ставки, фильтре списка и целях. Дату старого формата (импорт CSV) поле показывает как есть и не трогает.
28. **Хранилище мобилки — ставки кусками, запись поколениями** (`utils/storageLayout.ts`): ни одно значение не приближается к 2 МБ (Android не прочитает строку больше), сохранение переживает обрыв на любом шаге, при загрузке ничего не удаляется, при ошибке чтения — экран ошибки и ни одной записи, при ошибке записи — алерт и повтор (`saveFailed`). Подробно — CLAUDE.md, «Хранилище данных».
29. **Отчёт об ошибке — свой, без сервиса** (Sentry удалён): пользователь видит текст отчёта и отправляет его сам (`ErrorReportSheet`). Падение вне отрисовки сохраняет `installCrashCapture`, ошибку отрисовки вне границ — `RootCrashBoundary` вокруг всего приложения; следующий запуск предлагает отчёт. Подробно — CLAUDE.md.
30. **Длина текста — `TEXT_LIMITS`** (поле 2 000, заметка 10 000): мегабайт в заметке делал хранилище нечитаемым на Android. Лимит ставит `AppTextInput`, но не ниже уже лежащего текста; импорт обрезает.
31. **Хронология — `playedOrder(bets)`, подневный ряд и форматтеры кэшируются**: массивы и ставки сторы заменяют, а не правят на месте — на этом держатся кэши по ссылке. Одно поле — `totalPnl` / `calcCurrentStreak`, а не целый `calcDashboard`.
32. **Нечитаемая дата — запасной текст, не исключение** (`formatDate(date, options, запасной)`): `Intl.DateTimeFormat#format` бросает на ней, и дата из старого CSV роняла бы список ставок.
33. **Напоминание о результате — по времени матча** (`reminderFireAt`: дата + «Начало матча» + длительность спорта), поэтому время — на самой форме и проверяется как ЧЧ:ММ (`parseClock`). Строка «Напомню около 21:15» — только когда напоминание может прийти (разрешение есть или будет спрошено после этой ставки), иначе «Уведомления выключены». Кнопки пуша открывают приложение — все, и «Позже» (переносит на час; при выключенных напоминаниях только убирает из шторки).
34. **Выбор команды из подсказки ставит её вид спорта и дисциплину** (`choiceAfterPick`, `utils/teamPick`), но не поверх выбора пользователя (пикер, сохранённая ставка) и не поверх команды из другого поля; повторный выбор в том же поле — исправляет. Команды 2-й и следующих ног экспресса подсказываются без спорта (он не хранится) и спорт не ставят.

---

## Desktop Store Interface (SQLite + localStorage fallback)

```typescript
interface BetsStore {
  bets: Bet[]; settings: AppSettings; bankroll: Bankroll;
  diary: DiaryEntry[]; teams: Team[]; isLoaded: boolean;

  load(): Promise<void>;   // async — awaits storageService.loadData()
  persist(): void;         // fire-and-forget — calls saveData().catch(console.error)
  addBet(bet: Bet): void;
  updateBet(id: string, updates: Partial<Bet>): void;
  deleteBet(id: string): void;
  updateSettings(updates: Partial<AppSettings>): void;
  updateBankroll(updates: Partial<Bankroll>): void;
  addDiaryEntry(entry: DiaryEntry): void;
  deleteTeam(id: string): void;
  clearAll(): void;
  canAddBet(): boolean;
}
```

Storage layer (`storageService.ts`):
- Tauri env: SQLite table `kv(key TEXT PRIMARY KEY, value TEXT NOT NULL)` via `@tauri-apps/plugin-sql`
- Browser/test env: `localStorage.getItem/setItem('sharklog-data')`
- Detection: `window.__TAURI_INTERNALS__` present → Tauri

---

## Strategy Builder (PRO)

Билдер стратегий — 10-вопросный мастер (PRO), создаёт персональную стратегию ставок.

```typescript
// packages/core/src/utils/strategyBuilder.ts
STRATEGY_QUESTIONS   // 10 вопросов: goal, bankroll, risk, sport, betType, odds, time, experience, tilt, priority
buildStrategy(answers: StrategyAnswers): GeneratedStrategy

// Логика (rule-based, без ML):
// stakePercent: base из risk (1/2/3.5%), корректируется по experience/goal, cap 5%
// betsPerDay: из timePerDay (1/2/3/5), корректируется по priority/experience
// oddsMin/Max: STRATEGY_ODDS_BANDS — low(1.30–1.70) / mid(1.70–2.50) / high(2.50–4.00); план читает их из ответов (strategyPlan)
// kellyMultiplier: conservative=0.25 / moderate=0.5 / aggressive=0.75
// tiltThreshold: stop=2 / reduce=3 / continue=4
// 7 вариантов названий: Стартовая, Консервативная, Аутсайдерская (консервативный риск на кэфах 2.50+), Ценностная, Агрессивная, Сбалансированная, Профессиональная
```

Сохранённая стратегия:
- Хранится в `settings.generatedStrategy`
- Отображается кликабельной плашкой на DashboardScreen/DashboardPage
- Плашка ведёт на StrategyBuilderScreen / 'strategy' page
- Если стратегии нет — плашки нет

---

## Auto-updater (Desktop)

**Сейчас НЕ работает** (проверено 2026-11-07, задача — ROADMAP, «До релиза десктопа»): в
`capabilities/` нет разрешения `updater:default`, а `release-desktop.yml` выкладывает только
установщики — ни `.sig`, ни `latest.json`, который читает клиент. Что уже на месте:
- **Signing**: `npx tauri signer generate` → закрытый ключ в GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`
- **Public key**: уже в `tauri.conf.json` (`plugins.updater.pubkey`)
- **Endpoint**: `https://github.com/hoxitoo/sharklog/releases/latest/download/latest.json`
- **UI**: кнопка "Проверить обновления" в SettingsPage → "О приложении"; 404 от endpoint трактуется как "последняя версия"
- **CI**: `release-desktop.yml` собирает Windows / macOS / Linux (последний прогон 2026-11-07 — все три зелёные); релиз публикуется только по тегу `v*`

---

## Owner Mode

```bash
# Desktop browser dev с полным PRO
VITE_OWNER_PRO=true npx vite dev

# Или в .env.local (не коммитить):
VITE_OWNER_PRO=true
```

---

## CI / Build

- **CI**: `.github/workflows/ci.yml` — на push любой ветки, кроме gh-pages (PR — только из форка): одно задание — `node_modules` из кэша по package-lock (иначе `npm ci`) → тесты и `tsc` ядра, десктопа и мобилки → `expo export` мобилки; отдельно E2E десктопа (Playwright, браузер из кэша, не блокирует). Около минуты
- **EAS Build**: `.github/workflows/eas-build.yml` — ручной `workflow_dispatch`
  - Требует: `EXPO_TOKEN` secret + реальный `projectId` в `app.json`
- **EAS профили**: development / preview (APK) / production (autoIncrement)
- **Tauri Release**: `.github/workflows/release-desktop.yml` — тег `v*` → build all platforms → GitHub Release
  - Требует: `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` в GitHub Secrets

---

## Что сделано

### Core (packages/core)
- [x] BetStatus расширен: добавлен `'cashout'` (выкуп игроком, отдельно от `'refund'`)
- [x] Bet.tournament?: string — поле для турнира/лиги
- [x] AppSettings.generatedStrategy?: GeneratedStrategy
- [x] calcByTournament(bets) → TournamentStats[] — статистика по турнирам
- [x] calcByTeam(bets, minBets=10) → TeamStats[] — статистика по командам (≥10 ставок)
- [x] getPickedTeams(event, pick) — атрибутирует ставку ТОЛЬКО команде игрока (П1/П2/Ф1/Ф2 + прямые имена)
- [x] parseEventTeams(event) → string[] — парсинг команд из event string
- [x] strategyBuilder.ts: STRATEGY_QUESTIONS (10 вопросов) + buildStrategy(answers)
      buildStrategy возвращает 6 rich-полей: rationale, keyPrinciples, recommendedApproaches,
      recommendedBetTypes, betTypeRationale, oddsRationale
- [x] calcByHour() — статистика по часам дня
- [x] SliceStats.cashout: number — подсчёт кешаутов
- [x] Bugfix: totalStaked включает refund-ставки (ROI был завышен)
- [x] Bugfix: period filter off-by-one (>= → >)
- [x] formatPercent() — добавляет + для положительных значений
- [x] 98 vitest unit tests (stats x36, analytics x21, daily x11, formatters x21, kelly x6, migrations x3 — все зелёные)

### i18n / Локализация (обе платформы)
- [x] 4 языка: ru / en / kz (казахский) / by (беларуский)
- [x] Файлы переводов: `apps/desktop/src/i18n/locales/` + `apps/mobile/src/i18n/locales/`
- [x] i18next + react-i18next; `compatibilityJSON: 'v4'`
- [~] Desktop: `i18next-browser-languagedetector` подключён, но `lng: 'ru'` в `i18n/index.ts` его перекрывает — язык системы не подхватывается (ROADMAP); выбранный язык сохраняется в localStorage (`sharklog-lang`) и `AppSettings.language`
- [x] Mobile: `applyLanguage()` читает device locale как fallback; смена через SettingsScreen
- [~] Страницы десктопа на ключах перевода (Dashboard, Bets, Analytics, Insights, Bankroll, Diary, Settings, Onboarding, StrategyBuilder, AppLayout), но ~280 строк русского ещё в коде (ROADMAP, десктопный бэклог)
- [x] Переведены все экраны мобилки (locale файлы синхронизированы с десктопом)
- [x] Визуально проверено на всех 4 языках: нет fallback-ключей, нет обрезанного текста

### Mobile (React Native 0.85 + Expo 56)
- [x] Все экраны + OnboardingScreen (logo image вместо emoji)
- [x] InsightsScreen: period filter + Tournaments table (Free) + Teams cards (PRO)
- [x] StrategyBuilderScreen: PRO wizard (10 вопросов) + ResultScreen + "Применить"
- [x] DashboardScreen: стратегия-плашка → navigate('StrategyBuilder')
- [x] SettingsScreen: "Билдер стратегий" кнопка для PRO; roundAmounts toggle; "Проверить обновления"
                      (только сборка `direct`); 7 тапов по строке версии — ТОЛЬКО в `__DEV__` и дают
                      7 дней пробного, а не Pro (в релизе 7 тапов когда-то раздавали Pro бесплатно)
- [x] StatusBadge: поддержка cashout (label "Выкуп", refund остался "Возврат")
- [x] BetsScreen: filter chips refund + cashout; quick-result chip C (cashout);
                  sort by кэф/сумма — flat-section режим (нет groupby дат)
- [x] ActionWheel + useBetActions: тап по карточке = радиальное меню вместо редактора.
      pending → 7 секторов (Победа/Поражение/Возврат/Выкуп/Копия/Изменить/Удалить),
      settled → 4 (Результат ▸ / Копия / Изменить / Удалить); «Результат» открывает
      второе кольцо со статусами. Общий хук для BetsScreen и PendingScreen.
- [x] Дублирование ставки: AddBet c `duplicateOf` — форма из существующей ставки,
      но сохраняется НОВАЯ (статус pending, дата/время текущие)
- [x] AddBetScreen: поле "Турнир / Лига" + статус cashout; uuid() с Math.random fallback
- [x] RootNavigator: DrawerNavigator + Stack (AddBet + Bankroll + StrategyBuilder)
- [x] DrawerNavigator: анимированный drawer, FAB «+» только на экране Ставок, DrawerContext
- [x] Splash: expo-splash-screen (preventAutoHideAsync/hideAsync), Android 12+ dark background #080C12
- [x] AnimatedSplash: анимация "Сигнал" — 3 scaleX-линии + 12 строк × 4 коэффициента на всю высоту с волной, все nativeDriver
- [x] AddBetScreen: клавиатура не перекрывает поле турнира (KeyboardAvoidingView 'height' Android + scrollToEnd)
- [x] BankrollScreen: equity curve с Y-axis подписями, заголовок с текущим банком, маркеры депозит/вывод
- [x] DashboardScreen: P&L кривая — исправлена шкала (padding = max(|max|,|min|) × 8%)
- [x] StrategyBuilderScreen + StrategyBuilderPage: показывают все 6 rich-полей стратегии
- [x] ResponsibleGamblingBanner: коллапсируемый 18+ баннер на DashboardScreen
- [x] OnboardingScreen: Image компонент (logo) вместо emoji
- [x] Zustand store с полным CRUD + AsyncStorage persistence
- [x] Оплата: RuStore-сборка — «Pro навсегда» через Робокассу (лицензия Ed25519, код восстановления, отзыв после возврата); RevenueCat — только сборка под Google Play (`EXPO_PUBLIC_BILLING`)
- [x] Push notifications (daily reminder, tilt alert)
- [x] CSV export (expo-sharing, UTF-8 BOM)
- [x] Team autocomplete с esports discipline; подсказки — из самих ставок, выбор ставит спорт/дисциплину (2026-11-11)
- [x] Напоминание о результате по времени матча, «Начало матча» на форме, рабочая «Позже» (2026-11-10…11)
- [x] Pre-bet checklist modal (PRO)
- [x] useFormatMoney() хук — учитывает roundAmounts
- [x] AnalyticsScreen: исправлен double-plus перед ROI (formatPercent уже добавляет +)
- [x] i18n: BetsScreen и SettingsScreen — убраны все захардкоженные русские строки, добавлены t() вызовы
- [x] i18n: DrawerNavigator — partnersSub и другие строки переведены
- [x] ScreenHeader убран из BankrollScreen и StrategyBuilderScreen (stack-экраны вне DrawerContext)
- [x] CI: tests + type-check (все зелёные)
- [x] EAS: development/preview/production profiles
- [x] Тесты: см. «Tests» ниже (Jest мобилки, Vitest ядра и десктопа)
- [x] Locale файлы синхронизированы с десктопом (ru/en/kz/by)

### Desktop (Tauri v2 + React + Vite)
- [x] InsightsPage: period filter + TournamentsSection (Free) + TeamsSection (PRO)
- [x] StrategyBuilderPage: PRO wizard + ResultCard + disclaimer + "Применить стратегию"
- [x] DashboardPage: стратегия-плашка (кликабельная → 'strategy') + onNavigate prop
- [x] BetsPage: filter + quick-result buttons для cashout (C); refund/cashout отдельные фильтры
- [x] AddBetModal: поля Команда 1 / Команда 2 (event = "T1 vs T2") + 1X2 outcome picker
                   "Турнир / Лига" с `<datalist>` autocomplete; статус cashout;
                   clipboard paste для pre-fill формы; Kelly calculator
- [x] AnalyticsPage: "Топ турниры" блок (calcByTournament, top-3)
- [x] AppLayout: sidebar logo = img logo.png, nav 9 пунктов (Insights + Strategy с PRO badge, Партнёры)
- [x] App.tsx: 9 pages + loading screen с logo.png; Ctrl+1..9, Ctrl+N, Esc
- [x] OnboardingPage: logo image вместо emoji
- [x] public/logo.png + public/logo-512.png — официальный логотип
- [x] src-tauri/icons/: полный набор иконок (32/128/256/512, ICO, Windows tiles, AppImage)
- [x] PAGE_ORDER: 9 страниц, Ctrl+1..9 shortcuts (все страницы), Ctrl+N — новая ставка, Esc — закрыть
- [~] Auto-updater: 404 трактуется как "уже последняя версия" — но сам updater не работает (см. «Auto-updater»)
- [x] DashboardPage, BetsPage, AddBetModal, AnalyticsPage, BankrollPage — полные
- [x] DiaryPage, SettingsPage, AppLayout, OnboardingPage — полные
- [x] CSV + XLSX import (column aliases, RU/EN, cashout в status map)
- [x] clipboardParser.ts — paste pre-fill для AddBetModal
- [x] Owner PRO mode (VITE_OWNER_PRO=true)
- [~] Auto-updater UI в SettingsPage (кнопка есть, обновление не придёт — см. «Auto-updater»)
- [x] roundAmounts: false в defaultSettings (type-safe)
- [x] E2E tests (Playwright, continue-on-error): 22 теста
- [x] 41 smoke tests (Vitest)
- [~] i18n: страницы на react-i18next, но ~280 строк русского ещё захардкожено (форма ставки, тосты Настроек, стратегия) — ROADMAP, десктопный бэклог
- [x] betsCsv.ts — единый CSV-импорт/экспорт для обеих платформ (BOM, CRLF, `,`/`;`/таб,
      объединённые алиасы колонок); заменил две разъехавшиеся копии
- [x] betPnl() — общий P&L одной ставки; выкуп и проигранный фрибет считались по-разному
      в экспорте и в статистике
- [x] calcPnlBuckets(bets, granularity, count) — чистый P&L по дням/неделям/месяцам
      с сохранением пустых бакетов (замена накопительной линии в аналитике)
- [x] betBacksTeam(bet, team) — публичный предикат для фильтра ставок по команде
- [x] bankCash / currentBank / pendingExposure — единый расчёт банка; раньше он был
      продублирован в 8 местах, две копии считали P&L по-своему
- [x] BankrollTxType += 'adjustment' — сверка банка с реальным балансом бука
      (знаковая сумма, свой бакет `adjustments` в calcDailyBreakdown)
- [x] Bugfix: pnlCurve сортировался по createdAt вместо date+time

---

## Тесты

```
packages/core         378 vitest unit tests (stats, analytics, daily, formatters, kelly, migrations,
                          betsCsv x14 — round-trip / P&L / инъекция / разделители,
                          pnlBuckets x10 — границы бакетов, порядок кривой,
                          bankroll x10 — bankCash / currentBank / pendingExposure / сверки,
                          reconcileFlow x12 — сверка приземляет банк ровно на баланс бука,
                          с учётом незакрытых ставок и без двойного счёта после их расчёта,
                          expressOdds x11 — округление общего кэфа + миграция v3,
                          luckAndPlan x24 — сигма-модель везения и соблюдение плана,
                          insightsGroups x8 — дисциплина в группировках (только по esports-ставкам) и порядок по P&L,
                          betYears x16 — список лет, «без турнира», границы диаграммы, тримминг имён)
apps/desktop           41 vitest smoke tests (betsStore x15, importBets x26)
apps/mobile           495 jest tests (стор, стражи дизайна/тем/переводов, оплата, цели, календарь…)
ИТОГО                  914 тестов (core 378 + desktop 41 + mobile 495, на 2026-11-11)
```

---

## Команды

```bash
cd packages/core && npx vitest run          # 378 тестов
cd apps/desktop && npx vitest run           # 41 тест
cd apps/mobile && npm test                  # 495 тестов

cd apps/mobile && npx tsc --noEmit          # type-check мобилки
cd apps/desktop && npx tsc --noEmit         # type-check десктопа

cd apps/mobile && npx expo start            # запуск мобилки

# Desktop dev (браузер):
cd apps/desktop && npx vite dev
VITE_OWNER_PRO=true npx vite dev            # с полным PRO

# Desktop dev (Tauri window):
cd apps/desktop && npx tauri dev

# Desktop production build (инсталлятор):
cd apps/desktop && npx tauri build

git push -u origin claude/busy-shannon-jQgRK

# Ветки
# main  — продакшен
# dev   — интеграция перед main
# claude/busy-shannon-jQgRK — активная разработка (Claude sandbox)
```

---

## Что осталось до прода

Актуальный список — `docs/ROADMAP.md`, раздел «🎯 Первый релиз — RuStore» (таблица «Осталось»),
«🔐 Безопасность» и «⚖️ Оплата». Коротко (2026-11-05): всё, что делается в коде, сделано; осталось
то, что делает автор, — Робокасса на ИП, ключи и сервер лицензий, переменные EAS, оферта с
реквизитами на своём сайте и адреса этого сайта в приложении, тестовая оплата на `preview`,
нативная сборка `rustore` и прогон на телефоне, карточка в консоли RuStore.

Ключи подписи десктопа, `projectId` EAS и политика конфиденциальности — сделаны (раньше здесь
числились блокерами).

---

## Аудит кода — исправленные баги (раунд 2)

Полный аудит логики, стора и UI/UX. Исправлено:

**core (`packages/core`)**
- `parseMoneyInput` — теперь сохраняет ведущий `-` (отрицательные суммы) и корректно парсит много-групповые разделители (`1 000 000`, `1.000.000`, `1 234 567,89`). Раньше минус терялся, а `parseFloat` обрывался на втором разделителе.
- `formatPercent` — округляет до знака, не показывает обманчивый `-0.0%`.
- `calcByDayOfWeek` — парсит дату как локальную полночь (`...T00:00:00`); раньше bare `YYYY-MM-DD` парсился как UTC → смещение дня недели для часовых поясов западнее UTC.
- `calcByHour` — пустое/битое `time` → корзина 0, а не `NaN`.
- `migrate(raw)` — guard `!Array.isArray`: старый экспорт-массив `Bet[]` больше не превращается в битую схему.

**Сторы (mobile + desktop)**
- Сериализация записей через единую промис-цепочку (`writeChain`) — быстрые подряд мутации больше не затирают снапшоты друг друга.
- `clearAll` — теперь чистит только ДАННЫЕ (ставки/дневник/банк), сохраняя настройки и подписку (PRO/язык/букмекеры). Раньше молча сбрасывал PRO у платящего юзера.
- Mobile: enforcement истечения триала (`proExpiresAt`) при загрузке — раньше был только на десктопе.
- Mobile: `onboardingComplete ?? true` для существующих юзеров (не показывать онбординг повторно после апгрейда).
- Mobile: тилт-уведомление только на переходе в `lost` (не на каждом ре-сейве уже проигранной ставки).
- Desktop: `updateBet` больше не инфлейтит `usageCount` команд на каждом редактировании (guard по смене event/sport — как на мобилке).

**Mobile UI/UX**
- BetsScreen: `paddingBottom` списка увеличен — последняя карточка не перекрывается FAB.
- BetsScreen: pull-to-refresh больше не стирает активные фильтры/поиск/сортировку.
- DashboardScreen: тилт-баннер и «последние результаты» считаются из консистентного датасета; деньги через `useFormatMoney` (учёт `roundAmounts`); удалён мёртвый код (`bestBet`/`worstBet`/`extremeBet`).
- SettingsScreen: тап по фону paywall-модалки закрывает её (+ `onRequestClose`).
- Экспорт CSV: round-trip больше не теряет `tournament`/`discipline`/`freebet`; защита от CSV/formula-injection (`=`/`+`/`-`/`@`).
- Импорт CSV: алиасы для дисциплины/фрибета, полные лейблы дисциплин в `DISCIPLINE_MAP`.

**Desktop UI/UX**
- DashboardPage: добавлен `cashout` в `statusColors` (раньше бейдж получал `undefined`-цвет → невалидный стиль).
- Импорт: неизвестные значения sport/betType/strategy → безопасный дефолт вместо каста сырой строки (пустые ячейки).
- Даты форматируются по реальной локали через `dateLocale(lang)` (`kk-KZ`/`be-BY`), а не всегда `ru-RU`.

### Известный долг (не входило в этот раунд)
- **i18n полных экранов**: `AddBetScreen`/`AddBetModal`, `ChecklistModal`, `ConfirmModal`, тосты `SettingsPage`, тилт-баннеры — большой объём хардкод-RU строк. EN/KZ/BY юзеры видят русский в этих местах. Требует добавления десятков ключей × 4 локали × 2 приложения — отдельная крупная задача.
- ~~Daily-лимит и `bet.date` используют UTC-дату~~ — исправлено: везде `toYmd()` (в коде приложений `toISOString().split` не осталось).
- `kz`/`by` локали: часть значений — непереведённый русский (нужен проход носителя языка).
