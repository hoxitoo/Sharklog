# SharkLog — Контекст проекта

Bet tracker app — мобильное (React Native + Expo) и десктопное (Tauri v2 + React) приложение для учёта ставок. Freemium: 199 ₽/мес или 990 ₽/год.

## Структура монорепо

```
apps/mobile/     — React Native + Expo 51 (iOS + Android)
apps/desktop/    — Tauri v2 + React + Vite (Win / Mac / Linux)
packages/core/   — Чистая TS бизнес-логика (типы, статистика, Kelly, форматтеры, билдер стратегий)
docs/            — ROADMAP.md, ANALYSIS.md, PRIVACY_POLICY.md
```

## Git-ветки

- `claude/busy-shannon-jQgRK` — **песочница, вся разработка здесь**
- `main` — продакшен, только когда CI зелёный

**Никогда не пушить напрямую в `main`.**

## Ключевые соглашения

- Деньги — **копейки (integer)**. `1000 ₽ = 100_000`. `formatMoney()` для вывода, `parseMoneyInput()` для ввода.
- Ставки — **UUID v4** (не timestamp).
- PRO-функции мобилки — `<ProGate feature="...">` компонент.
- `packages/core` — без зависимостей на React/RN/Browser.
- `exactOptionalPropertyTypes: true` — нельзя писать `prop={undefined}`, нужен spread `{...(x ? { prop: x } : {})}`.
- **refund ≠ cashout**: `refund` = букмекер вернул ставку (отмена матча); `cashout` = игрок сам выкупил досрочно. Это два разных `BetStatus`.

## Цветовая система

```
colors.accent   = '#22D3A0'  // teal  — победы, положительные значения
colors.purple   = '#5B6AF0'  // purple — CTA-кнопки, активные состояния, таб-бар
colors.won      = '#22D3A0'
colors.lost     = '#F4455A'
colors.pending  = '#F59E0B'
colors.refund   = '#A78BFA'  // используется и для cashout
colors.gold     = '#F59E0B'  // PRO badge
```

## Хранилище данных

| Платформа | Хранилище | Ключ |
|-----------|-----------|------|
| Mobile    | AsyncStorage | `@sharklog/data` |
| Desktop (в браузере) | localStorage | `sharklog-data` |
| Desktop (в Tauri) | SQLite `sharklog.db` таблица `kv` | `sharklog-data` |

Абстракция: `apps/desktop/src/storage/storageService.ts` — `loadData()` / `saveData()`.
Детекция Tauri: `window.__TAURI_INTERNALS__`.

## Бизнес-правила

- Free лимит: **50 ставок** (`FREE_LIMITS.MAX_BETS`)
- Тилт-алерт: **3 поражения подряд** (Free, фикс) / **N** (PRO, настраивается)
- Дневной лимит: только PRO, 0 = без лимита
- 7 дней бесплатного Pro для новых пользователей
- Freemium: 199 ₽/мес, 990 ₽/год
- Инсайты/команды (PRO): только команды с ≥10 ставок показываются в "Любимые команды"

## Команды

```bash
# Тесты
cd packages/core && npx vitest run        # 12 unit-тестов core
cd apps/desktop  && npm test              # 40 smoke-тестов desktop (Vitest)
cd apps/mobile   && npm test              # 17 smoke-тестов mobile (Jest)

# Type-check
cd apps/mobile  && npx tsc --noEmit
cd apps/desktop && npx tsc --noEmit

# Запуск
cd apps/mobile  && npx expo start
cd apps/desktop && npm run dev            # браузер localhost:1420
cd apps/desktop && npx tauri dev          # нативное окно (требует Rust)

# Git
git push -u origin claude/busy-shannon-jQgRK
```

## Owner mode (десктоп)

Создать `apps/desktop/.env.local` (в .gitignore):
```
VITE_OWNER_PRO=true
```
При этом PRO включается автоматически навсегда, без клика "Попробовать Pro".

## Важные паттерны

```typescript
// Деньги
const kopecks = parseMoneyInput('1000');  // → 100000
formatMoney(100000);                       // → '1 000 ₽'

// Optional props с exactOptionalPropertyTypes
<Component {...(value ? { prop: value } : {})} />

// clearAll — сброс всех данных пользователя
useBetsStore(s => s.clearAll)()

// PRO-gate (mobile)
<ProGate feature="Описание фичи">
  <ActualContent />
</ProGate>

// Детекция Tauri
const IS_TAURI = !!(window as any).__TAURI_INTERNALS__;

// Парсинг команд из event string
import { parseEventTeams } from '@sharklog/core';
parseEventTeams('NaVi vs Astralis');   // → ['NaVi', 'Astralis']

// Статистика по турнирам / командам
import { calcByTournament, calcByTeam } from '@sharklog/core';
const tournamentStats = calcByTournament(bets);     // все турниры
const teamStats = calcByTeam(bets, 10);             // команды с ≥10 ставок

// Билдер стратегий
import { STRATEGY_QUESTIONS, buildStrategy } from '@sharklog/core';
const strategy = buildStrategy(answers);            // → GeneratedStrategy
// Сохранить: updateSettings({ generatedStrategy: strategy })
```

## Структура desktop (apps/desktop/src/)

```
App.tsx                    — загрузка (logo.png), онбординг-роут, main layout
                             PAGE_ORDER: dashboard/bets/analytics/insights/strategy/bankroll/diary/settings
components/
  ErrorBoundary.tsx        — React class boundary, кнопки retry/reload
  ChecklistModal.tsx       — 5 вопросов перед ставкой (PRO)
  ConfirmModal.tsx         — подтверждение деструктивных действий
  Toaster.tsx              — toast уведомления
layouts/
  AppLayout.tsx            — sidebar: logo img, nav 8 пунктов (PRO badge на strategy), FREE_LIMITS прогресс-бар
pages/
  DashboardPage.tsx        — period filter, 6 KPI, W/L strip, heatmap, стратегия-плашка (→ 'strategy')
  BetsPage.tsx             — date-grouped sections, daily P&L, search/filter/sort; статусы refund + cashout
  AddBetModal.tsx          — форма + TeamAutocomplete + Kelly calculator + ChecklistModal
                             поле "Турнир / Лига" с <datalist> autocomplete
                             clipboard paste для pre-fill; статус cashout
  AnalyticsPage.tsx        — 7 срезов (PRO) + "Топ турниры" mini-cards
  BankrollPage.tsx         — equity curve, Kelly calc, транзакции с удалением
  DiaryPage.tsx            — mood tracker, тилт-стата, дневник
  InsightsPage.tsx         — period filter; TournamentsSection (Free); TeamsSection (PRO)
  StrategyBuilderPage.tsx  — PRO: progress bar + 10 вопросов + ResultCard + disclaimer
  SettingsPage.tsx         — подписка, тилт-stepper, букмекеры, команды,
                             CSV/Excel/JSON import-export, проверка обновлений
  OnboardingPage.tsx       — 3-шаговый визард (welcome logo → букмекеры → go)
storage/
  storageService.ts        — SQLite (Tauri) / localStorage (browser) абстракция
store/
  betsStore.ts             — Zustand; load() async, persist() fire-and-forget
  toastStore.ts            — эфемерные toast-уведомления
utils/
  importBets.ts            — импорт CSV/XLSX с алиасами колонок, нормализацией дат, поддержка cashout
  clipboardParser.ts       — parseClipboard(text) → Partial<Bet> (pre-fill AddBetModal)
theme/
  colors.ts                — цветовая система
public/
  logo.png                 — официальный логотип (sidebar, loading screen)
  logo-512.png             — high-res версия
```

## Структура mobile (apps/mobile/src/)

```
navigation/
  RootNavigator.tsx        — Stack: Tabs + AddBet (modal) + Bankroll + StrategyBuilder
                             Tabs (6): Ставки | Дашборд | Инсайты | Дисциплина | Аналитика | Настройки
screens/
  BetsScreen/              — SectionList + quick-result W/L/R/C (cashout)
  AddBetScreen/            — форма с полем Турнир/Лига, статус cashout
  DashboardScreen/         — стратегия-плашка → navigate('StrategyBuilder')
  InsightsScreen/          — TournamentRow (Free) + TeamCard (PRO via ProGate)
  AnalyticsScreen/         — 8 срезов (PRO via ProGate)
  BankrollScreen/          — equity curve, Kelly (PRO)
  DisciplineScreen/        — mood, тилт, дневник
  SettingsScreen/          — PRO settings + "Билдер стратегий" кнопка
  OnboardingScreen/        — logo Image + 3 шага
  StrategyBuilderScreen/   — PRO: WizardScreen + ResultScreen
components/
  StatusBadge.tsx          — бейджи: pending/won/lost/refund ("Возврат")/cashout ("Выкуп")
  ProGate.tsx              — RevenueCat paywall
assets/
  icon.png                 — 1024×1024 на тёмном фоне
  adaptive-icon.png        — 1024×1024 прозрачный фон (Android)
  splash.png               — 1284×2778 по центру
```

## Структура core (packages/core/src/)

```
types/bet.ts          — BetStatus: 'pending'|'won'|'lost'|'refund'|'cashout'
                        Bet: + tournament?: string
                        AppSettings: + generatedStrategy?: GeneratedStrategy
                        GeneratedStrategy, StrategyAnswers, + 10 union types
constants/index.ts    — SPORTS, BET_TYPES, STRATEGIES, FREE_LIMITS, ODDS_RANGES
utils/
  stats.ts            — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek,
                        calcByHour, isInTilt, calcByTournament, calcByTeam, parseEventTeams
  kelly.ts            — kellyFraction, halfKelly, expectedValue, impliedProbability
  formatters.ts       — formatMoney, parseMoneyInput, formatOdds, formatPercent
  strategyBuilder.ts  — STRATEGY_QUESTIONS (10 вопросов), buildStrategy(answers)
  migrations.ts       — migrate(raw)
```
