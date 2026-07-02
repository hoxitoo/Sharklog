# SharkLog — AI Session Context

Read this at the start of every session. Always develop on `claude/busy-shannon-jQgRK`, never push to `main` directly.

---

## Monorepo

```
apps/mobile/src/
  screens/
    BetsScreen/              — SectionList с датами + daily P&L, search, status filter (scroll), sort row,
                               swipe-to-delete, haptics; quick-result chips W/L/R/C
    AddBetScreen/            — react-hook-form, TeamAutocomplete, Kelly calculator (collapsible),
                               tournament/league TextInput field, status includes cashout
                               KeyboardAvoidingView: 'padding' iOS / 'height' Android
                               TournamentInput получает scrollRef → scrollToEnd при фокусе (клавиатура не перекрывает)
    DashboardScreen/         — period filter (7д/30д/Всё), stats grid, W/L strip, heatmap, P&L chart,
                               best/worst bet, strategy badge (кликабельная плашка → StrategyBuilder)
    AnalyticsScreen/         — period filter (7д/30д/Всё), SummaryCard + 8 срезов с барами (PRO via ProGate)
    InsightsScreen/          — period filter; Tournaments table (Free); Favorite Teams cards (PRO via ProGate)
    BankrollScreen/          — equity curve LineChart с Y-axis подписями, текущий банк в заголовке,
                               маркеры депозита (зелёная точка) / вывода (красная точка) через customDataPoint;
                               сводка банкролла, inline deposit/withdrawal, Kelly (PRO)
    DisciplineScreen/        — mood picker (1-5), тилт-стата (X/N лимит для PRO), 8 правил, diary
    SettingsScreen/          — Stepper для PRO настроек, paywall modal, clearAll, export, notifications,
                               "Билдер стратегий" кнопка для PRO → navigate('StrategyBuilder')
    OnboardingScreen/        — 3 шага: welcome (logo image) → стартовый банкролл → букмекеры
    StrategyBuilderScreen/   — PRO: прогресс-бар + 10 вопросов + результат + "Применить стратегию"
  components/
    ErrorBoundary.tsx        — React class component; friendly RN error screen + reload button
    ProGate.tsx              — пейвол с реальными RC offerings (monthly/annual), restore
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
    RootNavigator.tsx        — Stack: Drawer + AddBet (modal) + Bankroll + StrategyBuilder
    DrawerNavigator.tsx      — кастомный анимированный drawer (заменяет таббар)
                               Animated.spring (открытие) / Animated.timing (закрытие)
                               DrawerContext — openDrawer() доступен из любого экрана
                               FAB «+» — виден ТОЛЬКО на экране Ставок ({screen === 'Bets'})
                               Разделы: Ставки | Дашборд | Инсайты | Аналитика | Дисциплина | Настройки
                               Вторичные: Банкролл | Стратегии (PRO) | Партнёры
  services/
    revenueCat.ts            — initRevenueCat, getOfferings, purchasePackage, restorePurchases, syncEntitlement
    sentry.ts                — initSentry, captureException, setUserContext, clearUserContext
  store/
    betsStore.ts             — Zustand + AsyncStorage; addBet, updateBet, deleteBet,
                               updateSettings, updateBankroll, addDiaryEntry, deleteTeam, clearAll, canAddBet
                               Exports: defaultSettings, defaultBankroll (used in tests)
  theme/
    colors.ts                — two-accent palette (accent=teal, purple=CTA)
  utils/
    haptics.ts               — haptic.selection/light/medium/heavy/success/warning/error
    notifications.ts         — scheduleDailyReminder (20:00), sendTiltNotification, requestNotificationPermission
    exportCSV.ts             — CSV с UTF-8 BOM, expo-file-system + expo-sharing
    useFormatMoney.ts        — хук: useFormatMoney() → (kopecks) => string; учитывает settings.roundAmounts
    chartScale.ts            — chartScale(vals) → nice-шкала для gifted-charts (maxValue/stepValue/noOfSections,
                               negative-квадрант ТОЛЬКО при отрицательных данных), chartHeightForBudget, formatChartYLabel
                               ВАЖНО: не передавать mostNegativeValue вручную — библиотека рисует полную секцию
                               ниже нуля и добавляет её высоту к контейнеру (переполнение карточки)
  __tests__/
    betsStore.test.ts        — 19 smoke tests (canAddBet, addBet, deleteBet, updateBet, clearAll, express team extraction, clearAll preserves prefs)
    __mocks__/
      async-storage.ts       — in-memory AsyncStorage mock
      notifications.ts       — jest.fn() stubs for scheduleDailyReminder/sendTiltNotification

apps/desktop/src/            — React+Vite frontend (TypeScript strict), Tauri v2 backend (src-tauri/)
  App.tsx                    — routing (8 pages), modal state, Cmd+N hotkey, Esc to close;
                               isLoaded guard (logo spinner), onboarding gate, ErrorBoundary wrapper
  layouts/
    AppLayout.tsx            — sidebar: logo image, nav (8 items, PRO badge на strategy), "+ Новая ставка",
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
    AddBetModal.tsx          — full form with TeamAutocomplete + tournament datalist autocomplete,
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
    betsStore.test.ts        — 25 smoke tests
  utils/
    importBets.test.ts       — 15 tests for CSV/XLSX parsing

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
  types/bet.ts               — Bet (+ tournament? field), Team, EsportsDiscipline, Bankroll, DiaryEntry,
                               AppSettings (+ generatedStrategy?), StorageSchema
                               BetStatus: 'pending'|'won'|'lost'|'refund'|'cashout'
                               Strategy types: StrategyAnswers, GeneratedStrategy + 10 answer union types
  constants/index.ts         — SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, FREE_LIMITS, ODDS_RANGES
  utils/
    stats.ts                 — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek, calcByHour,
                               isInTilt, calcByTournament, calcByTeam, parseEventTeams
                        getPickedTeams(event, pick) — внутренний хелпер для calcByTeam;
                        атрибутирует ставку только команде, на которую ставил игрок (П1/П2/Ф1/Ф2 + прямые имена)
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

interface AppSettings {
  tiltThreshold: number;          // Free: фикс 3 / PRO: stepper 2–10
  dailyBetLimit: number;          // 0 = нет лимита (только PRO); enforced в canAddBet()
  bookmakers: string[];
  isPro: boolean;
  onboardingComplete: boolean;
  reminderHour: number;           // час ежедневного напоминания (PRO: stepper 6–23)
  roundAmounts: boolean;          // округлять суммы до целых рублей (0 знаков после запятой)
  generatedStrategy?: GeneratedStrategy;  // PRO: сохранённая стратегия
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
3. **Team memory**: `upsertTeams()` в store вызывается при каждом addBet/updateBet.
4. **Esports discipline**: `sport === 'esports'` → discipline обязателен. Compound key: `name+sport+discipline`.
5. **exactOptionalPropertyTypes: true**: `prop={undefined}` → ошибка. Используй `{...(x ? { prop: x } : {})}`.
6. **PRO gate (mobile)**: любой PRO-контент через `<ProGate feature="...">`.
7. **clearAll()**: сбрасывает bets/diary/teams/bankroll, сохраняет `onboardingComplete: true`.
8. **canAddBet()**: false если Free && bets >= FREE_LIMITS.MAX_BETS; false если Pro && dailyBetLimit > 0 && todayBets >= limit.
9. **Period filter**: `b.date > cutoffStr` (НЕ `>=`) — иначе off-by-one (8 дней вместо 7).
10. **formatPercent()**: уже добавляет `+` для положительных значений — не добавляй префикс вручную.
11. **Onboarding**: новые пользователи видят OnboardingPage; существующие пользователи — `onboardingComplete ?? true` при load().
12. **refund vs cashout**: refund = возврат букмекером (отмена матча); cashout = досрочный выкуп игроком. Это два разных статуса.
13. **parseEventTeams(event)**: разбивает event по ` — `, ` – `, ` vs `, ` против `, ` - ` → массив имён команд.
14. **calcByTeam(bets, minBets=10)**: возвращает только команды с ≥10 ставок (PRO "Любимые команды"). Использует внутренний `getPickedTeams(event, pick)` — атрибутирует ставку только той команде, на которую поставил игрок.

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
// oddsMin/Max: low(1.30–1.65) / mid(1.65–2.40) / high(2.40–4.00)
// kellyMultiplier: conservative=0.25 / moderate=0.5 / aggressive=0.75
// tiltThreshold: stop=2 / reduce=3 / continue=4
// 6 вариантов названий: Стартовая, Консервативная, Ценностная, Агрессивная, Сбалансированная, Профессиональная
```

Сохранённая стратегия:
- Хранится в `settings.generatedStrategy`
- Отображается кликабельной плашкой на DashboardScreen/DashboardPage
- Плашка ведёт на StrategyBuilderScreen / 'strategy' page
- Если стратегии нет — плашки нет

---

## Auto-updater (Desktop)

- **Signing**: `npx tauri signer generate` → private key в GitHub Secret `TAURI_SIGNING_PRIVATE_KEY`
- **Public key**: заменить `UPDATER_PUBLIC_KEY_PLACEHOLDER` в `tauri.conf.json`
- **Endpoint**: `https://github.com/hoxitoo/sharklog/releases/latest/download/latest.json`
- **UI**: кнопка "Проверить обновления" в SettingsPage → "О приложении" карточка
- **CI**: `release-desktop.yml` собирает подписанные артефакты при теге `v*`
- **404 handling**: 404 от endpoint трактуется как "последняя версия", не как ошибка

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

- **CI**: `.github/workflows/ci.yml` — `npm ci` → vitest (core 66 + desktop 40) → mobile tests (25) → tsc mobile+desktop
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
- [x] 66 vitest unit tests (stats x36, formatters x21, kelly x6, migrations x3 — все зелёные)

### i18n / Локализация (обе платформы)
- [x] 4 языка: ru / en / kz (казахский) / by (беларуский)
- [x] Файлы переводов: `apps/desktop/src/i18n/locales/` + `apps/mobile/src/i18n/locales/`
- [x] i18next + react-i18next; `compatibilityJSON: 'v4'`
- [x] Desktop: `i18next-browser-languagedetector`; язык сохраняется в localStorage (`sharklog-lang`) и `AppSettings.language`
- [x] Mobile: `applyLanguage()` читает device locale как fallback; смена через SettingsScreen
- [x] Переведены все страницы десктопа: Dashboard, Bets, Analytics, Insights, Bankroll, Diary, Settings, Onboarding, StrategyBuilder, AppLayout
- [x] Переведены все экраны мобилки (locale файлы синхронизированы с десктопом)
- [x] Визуально проверено на всех 4 языках: нет fallback-ключей, нет обрезанного текста

### Mobile (React Native + Expo 51)
- [x] Все экраны + OnboardingScreen (logo image вместо emoji)
- [x] InsightsScreen: period filter + Tournaments table (Free) + Teams cards (PRO)
- [x] StrategyBuilderScreen: PRO wizard (10 вопросов) + ResultScreen + "Применить"
- [x] DashboardScreen: стратегия-плашка → navigate('StrategyBuilder')
- [x] SettingsScreen: "Билдер стратегий" кнопка для PRO; roundAmounts toggle; "Проверить обновления";
                      7-tap dev bypass (активирует PRO без RevenueCat)
- [x] StatusBadge: поддержка cashout (label "Выкуп", refund остался "Возврат")
- [x] BetsScreen: filter chips refund + cashout; quick-result chip C (cashout);
                  sort by кэф/сумма — flat-section режим (нет groupby дат)
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
- [x] RevenueCat paywall (real offerings, purchase, restore)
- [x] Push notifications (daily reminder, tilt alert)
- [x] CSV export (expo-sharing, UTF-8 BOM)
- [x] Team autocomplete с esports discipline
- [x] Pre-bet checklist modal (PRO)
- [x] useFormatMoney() хук — учитывает roundAmounts
- [x] AnalyticsScreen: исправлен double-plus перед ROI (formatPercent уже добавляет +)
- [x] i18n: BetsScreen и SettingsScreen — убраны все захардкоженные русские строки, добавлены t() вызовы
- [x] i18n: DrawerNavigator — partnersSub и другие строки переведены
- [x] ScreenHeader убран из BankrollScreen и StrategyBuilderScreen (stack-экраны вне DrawerContext)
- [x] CI: tests + type-check (все зелёные)
- [x] EAS: development/preview/production profiles
- [x] 25 smoke tests
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
- [x] AppLayout: sidebar logo = img logo.png, nav 8 пунктов (Insights + Strategy с PRO badge)
- [x] App.tsx: 8 pages + loading screen с logo.png; Ctrl+1..8, Ctrl+N, Esc
- [x] OnboardingPage: logo image вместо emoji
- [x] public/logo.png + public/logo-512.png — официальный логотип
- [x] src-tauri/icons/: полный набор иконок (32/128/256/512, ICO, Windows tiles, AppImage)
- [x] PAGE_ORDER: 8 страниц, Ctrl+1..8 shortcuts (все страницы), Ctrl+N — новая ставка, Esc — закрыть
- [x] Auto-updater: 404 трактуется как "уже последняя версия"
- [x] DashboardPage, BetsPage, AddBetModal, AnalyticsPage, BankrollPage — полные
- [x] DiaryPage, SettingsPage, AppLayout, OnboardingPage — полные
- [x] CSV + XLSX import (column aliases, RU/EN, cashout в status map)
- [x] clipboardParser.ts — paste pre-fill для AddBetModal
- [x] Owner PRO mode (VITE_OWNER_PRO=true)
- [x] Auto-updater UI в SettingsPage
- [x] roundAmounts: false в defaultSettings (type-safe)
- [x] E2E tests (Playwright, continue-on-error): 40+ тестов
- [x] 40 smoke tests (Vitest)
- [x] Полный i18n: все страницы переведены на ru/en/kz/by через react-i18next

---

## Тесты

```
packages/core          66 vitest unit tests (stats, formatters, kelly, migrations)
apps/desktop           40 vitest smoke tests (betsStore x25, importBets x15)
apps/mobile            25 jest smoke tests (betsStore x19, chartScale x6)
ИТОГО                  131 тест
```

---

## Команды

```bash
cd packages/core && npx vitest run          # 66 тестов
cd apps/desktop && npx vitest run           # 40 тестов
cd apps/mobile && npm test                  # 25 тестов

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

### Обязательно (blocker)
- [ ] Сгенерировать ключи подписи: `npx tauri signer generate` → добавить в GitHub Secrets
- [ ] Заменить `UPDATER_PUBLIC_KEY_PLACEHOLDER` в `tauri.conf.json` реальным публичным ключом
- [ ] Заменить `projectId: "PLACEHOLDER"` в `app.json` реальным EAS projectId

### Желательно
- [ ] Скриншоты для App Store / Google Play
- [ ] LemonSqueezy для платежей (desktop)
- [ ] Sentry DSN в production env
- [ ] Задеплоить Privacy Policy URL

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
- Daily-лимит и `bet.date` используют UTC-дату (не локальную) — мелкое смещение границы дня; смена рискованна для существующих данных.
- `kz`/`by` локали: часть значений — непереведённый русский (нужен проход носителя языка).
