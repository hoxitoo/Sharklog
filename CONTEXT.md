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
    DashboardScreen/         — period filter (7д/30д/Всё), stats grid, W/L strip, heatmap, P&L chart,
                               best/worst bet, strategy badge (кликабельная плашка → StrategyBuilder)
    AnalyticsScreen/         — period filter (7д/30д/Всё), SummaryCard + 8 срезов с барами (PRO via ProGate)
    InsightsScreen/          — period filter; Tournaments table (Free); Favorite Teams cards (PRO via ProGate)
    BankrollScreen/          — equity curve LineChart, сводка банкролла, inline deposit/withdrawal, Kelly (PRO)
    DisciplineScreen/        — mood picker (1-5), тилт-стата (X/N лимит для PRO), 8 правил, diary
    SettingsScreen/          — Stepper для PRO настроек, paywall modal, clearAll, export, notifications,
                               "Билдер стратегий" кнопка для PRO → navigate('StrategyBuilder')
    OnboardingScreen/        — 3 шага: welcome (logo image) → стартовый банкролл → букмекеры
    StrategyBuilderScreen/   — PRO: прогресс-бар + 10 вопросов + результат + "Применить стратегию"
  components/
    ErrorBoundary.tsx        — React class component; friendly RN error screen + reload button
    ProGate.tsx              — пейвол с реальными RC offerings (monthly/annual), restore
    ScreenHeader.tsx         — title + subtitle + optional right CTA
    ChecklistModal.tsx       — 5 вопросов перед ставкой, только PRO
    StatusBadge.tsx          — цветной бейдж статуса ставки (pending/won/lost/refund/cashout)
  navigation/
    RootNavigator.tsx        — Stack: Tabs + AddBet (modal) + Bankroll + StrategyBuilder
                               Tabs (6): Ставки | Дашборд | Инсайты | Дисциплина | Аналитика | Настройки
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
  __tests__/
    betsStore.test.ts        — 17 smoke tests (canAddBet, addBet, deleteBet, updateBet, clearAll)
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
14. **calcByTeam(bets, minBets=10)**: возвращает только команды с ≥10 ставок (PRO "Любимые команды").

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

- **CI**: `.github/workflows/ci.yml` — `npm ci` → vitest (core 12 + desktop 40) → mobile tests (17) → tsc mobile+desktop
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
- [x] parseEventTeams(event) → string[] — парсинг команд из event string
- [x] strategyBuilder.ts: STRATEGY_QUESTIONS (10 вопросов) + buildStrategy(answers)
- [x] calcByHour() — статистика по часам дня
- [x] SliceStats.cashout: number — подсчёт кешаутов
- [x] Bugfix: totalStaked включает refund-ставки (ROI был завышен)
- [x] Bugfix: period filter off-by-one (>= → >)
- [x] formatPercent() — добавляет + для положительных значений
- [x] 12 vitest unit tests (все зелёные)

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
- [x] RootNavigator: Tabs (6): Bets/Dashboard/Insights/Discipline/Analytics/Settings
                      Stack: Tabs + AddBet + Bankroll + StrategyBuilder
- [x] Splash: использует icon.png (backgroundColor #080C12)
- [x] OnboardingScreen: Image компонент (logo) вместо emoji
- [x] Zustand store с полным CRUD + AsyncStorage persistence
- [x] RevenueCat paywall (real offerings, purchase, restore)
- [x] Push notifications (daily reminder, tilt alert)
- [x] CSV export (expo-sharing, UTF-8 BOM)
- [x] Team autocomplete с esports discipline
- [x] Pre-bet checklist modal (PRO)
- [x] useFormatMoney() хук — учитывает roundAmounts
- [x] AnalyticsScreen: исправлен double-plus перед ROI (formatPercent уже добавляет +)
- [x] CI: tests + type-check (все зелёные)
- [x] EAS: development/preview/production profiles
- [x] 17 smoke tests
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
packages/core          12 vitest unit tests
apps/desktop           40 vitest smoke tests (betsStore x25, importBets x15)
apps/mobile            17 jest smoke tests (betsStore x17)
ИТОГО                  69 тестов
```

---

## Команды

```bash
cd packages/core && npx vitest run          # 12 тестов
cd apps/desktop && npx vitest run           # 40 тестов
cd apps/mobile && npm test                  # 17 тестов

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
