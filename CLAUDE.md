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
- `dev` — интеграционная, PR из feature-веток перед main
- `main` — продакшен, только когда CI зелёный
- `gh-pages` — лендинг, независимая ветка (только HTML/CSS)

**Никогда не пушить напрямую в `main`.**

## Ключевые соглашения

- Деньги — **копейки (integer)**. `1000 ₽ = 100_000`. `formatMoney()` для вывода, `parseMoneyInput()` для ввода.
- `formatMoney(kopecks, currency='₽', maxDecimals=2)` — третий аргумент управляет знаками после запятой.
- На мобилке использовать `useFormatMoney()` (из `utils/useFormatMoney.ts`) вместо прямого `formatMoney` — он учитывает `settings.roundAmounts`.
- Ставки — **UUID v4** (не timestamp). На мобилке — `uuid()` с fallback на Math.random (crypto может быть unavailable на Hermes/Android).
- PRO-функции мобилки — `<ProGate feature="...">` компонент.
- `packages/core` — без зависимостей на React/RN/Browser.
- `exactOptionalPropertyTypes: true` — нельзя писать `prop={undefined}`, нужен spread `{...(x ? { prop: x } : {})}`.
- **refund ≠ cashout**: `refund` = букмекер вернул ставку (отмена матча); `cashout` = игрок сам выкупил досрочно. Это два разных `BetStatus`.
- **formatPercent()** уже добавляет `+` для положительных значений — не добавляй префикс вручную.
- **`parseMoneyInput`** сохраняет ведущий `-` и парсит много-групповые разделители (`1 000 000`, `1.000.000`). Отрицательные значения отбрасывай на уровне формы (`stake > 0`), а не в парсере.
- **Запись в стор сериализована** через `writeChain` (промис-цепочка) в обоих `betsStore` — не вызывай `saveData`/`setItem` напрямую в обход `persist()`.
- **`clearAll`** чистит только данные (ставки/дневник/банк), но СОХРАНЯЕТ настройки и подписку (PRO/язык/букмекеры) — не сбрасывай `settings` к дефолтам.
- **Даты-строки `YYYY-MM-DD`** парсь как локальные (`new Date(\`${d}T00:00:00\`)`), bare-строка парсится как UTC и смещает день. На десктопе локаль для `toLocaleDateString` — через `dateLocale(lang)` из `i18n`.

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

## Локализация (i18n)

Поддерживаются 4 языка: **ru** (русский), **en** (English), **kz** (қазақша), **by** (беларуская).

Файлы переводов:
- Desktop: `apps/desktop/src/i18n/locales/{ru,en,kz,by}.json`
- Mobile: `apps/mobile/src/i18n/locales/{ru,en,kz,by}.json`

```typescript
// Desktop — в компонентах
import { useTranslation } from 'react-i18next';
const { t, i18n } = useTranslation();
t('status.won')           // → 'Победа' / 'Won' / 'Жеңді' / 'Выйграў'
t('discipline.tiltBannerTitle', { count: 3 })  // интерполяция

// Смена языка (десктоп — через SettingsPage)
i18n.changeLanguage('en');
updateSettings({ language: 'en' });

// Mobile — через applyLanguage() в SettingsScreen
import i18n from '../i18n';
i18n.changeLanguage(lang);

// Локаль для дат
const locale = i18n.language === 'en' ? 'en-US' : 'ru-RU';
new Date(str).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
```

Ключевые пространства имён в JSON-файлах:
`nav`, `status`, `bet`, `dashboard`, `analytics`, `insights`, `bankroll`, `discipline`, `settings`, `common`

Соглашения:
- `formatPercent()` не трогать — уже добавляет `+`; в переводах знак `+` тоже не ставить
- Валюта `₽` захардкожена в `formatMoney()` — не переводить
- Все числовые суммы идут через `formatMoney()`, не вставлять в строки вручную
- При добавлении нового UI-текста — добавлять ключ во все 4 файла сразу

## Команды

```bash
# Тесты
cd packages/core && npx vitest run        # 66 unit-тестов core
cd apps/desktop  && npm test              # 40 smoke-тестов desktop (Vitest)
cd apps/mobile   && npm test              # 25 smoke-тестов mobile (Jest)

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
formatMoney(100000, '₽', 0);              // → '1 000 ₽' (без копеек, округлённо)

// На мобилке — форматирование с учётом roundAmounts (хук)
const fmt = useFormatMoney();
fmt(100000);  // '1 000 ₽' или '1 000,00 ₽' в зависимости от настройки

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
                             Ctrl+1..8 — навигация; Ctrl+N — новая ставка; Esc — закрыть модал
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
  AddBetModal.tsx          — форма с двумя полями команд (Команда 1 / Команда 2) + 1X2 picker
                             + Kelly calculator + ChecklistModal (PRO)
                             поле "Турнир / Лига" с <datalist> autocomplete
                             clipboard paste для pre-fill; статус cashout
                             event строится как `${team1} vs ${team2}`
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
  RootNavigator.tsx        — Stack: Drawer + AddBet (modal) + Bankroll + StrategyBuilder + Partners
  DrawerNavigator.tsx      — кастомный анимированный drawer (заменяет таббар с v2)
                             Animated.spring (открытие) / Animated.timing с callback (закрытие)
                             DrawerContext — openDrawer() доступен из любого экрана
                             FAB «+» — виден ТОЛЬКО на экране Ставок ({screen === 'Bets' && ...})
                             Разделы: Ставки | Дашборд | Инсайты | Аналитика | Дисциплина | Настройки
                             Вторичные: Банкролл | Стратегии (PRO) | Партнёры (teal-карточка)
screens/
  BetsScreen/              — SectionList + quick-result W/L/R/C (cashout)
  AddBetScreen/            — форма с полем Турнир/Лига, статус cashout
                             collapsible доп. поля (стратегия, букмекер, дата, турнир, заметки, фрибет)
                             автораскрытие при edit если доп. поля заполнены
                             KeyboardAvoidingView: behavior='padding' iOS / 'height' Android
                             TournamentInput: onFocus → scrollRef.scrollToEnd (поле не перекрывается клавиатурой)
  DashboardScreen/         — стратегия-плашка → navigate('StrategyBuilder')
                             тепловая карта за collapsible toggle
                             тилт-баннер с dismiss × (AsyncStorage @sharklog/tilt_dismiss_date)
                             haptic.warning() при первом определении тилта
  InsightsScreen/          — TournamentRow (Free) + TeamCard (PRO via ProGate)
  AnalyticsScreen/         — 8 срезов (PRO via ProGate)
  BankrollScreen/          — equity curve с Y-axis подписями и текущим банком в заголовке;
                             маркеры депозита (зелёная точка) / вывода (красная точка) на кривой через customDataPoint;
                             Kelly (PRO)
  DisciplineScreen/        — mood, тилт, дневник
  SettingsScreen/          — PRO settings + "Билдер стратегий" кнопка
                             disableChecklist toggle (PRO) — отключить чек-лист перед ставкой
                             roundAmounts toggle (округление сумм)
                             "Проверить обновления" (GitHub latest release API)
                             7-tap Easter egg на строке "Подписка" → активация PRO (dev bypass)
  OnboardingScreen/        — logo Image + 3 шага
  StrategyBuilderScreen/   — PRO: WizardScreen + ResultScreen
components/
  StatusBadge.tsx          — бейджи: pending/won/lost/refund ("Возврат")/cashout ("Выкуп")
  ProGate.tsx              — RevenueCat paywall
  DrawerContext.tsx        — React Context: openDrawer() для всех экранов
  ScreenHeader.tsx         — заголовок с hamburger + rightAction; НЕ используется в stack-экранах (Bankroll, StrategyBuilder)
  ResponsibleGamblingBanner.tsx — коллапсируемый 18+ баннер (AsyncStorage @sharklog/responsible_expanded)
  AnimatedSplash.tsx       — анимация "Сигнал": 3 staggered scaleX-линии + "SharkLog" + слоган
                             + 12 строк × 4 коэффициента НА ВСЮ ВЫСОТУ экрана (процентные top-позиции 3%…93%,
                             массив rowOps в одном useRef; яркость 0→0.22→0 стаггером 170ms, волна сверху вниз)
                             2400ms фиксировано; onFinish() callback; все Animated — useNativeDriver:true
assets/
  icon.png                 — 1024×1024 на тёмном фоне
  adaptive-icon.png        — 1024×1024 прозрачный фон (Android)
  splash.png               — 1284×2778 по центру
```

## Структура core (packages/core/src/)

```
types/bet.ts          — BetStatus: 'pending'|'won'|'lost'|'refund'|'cashout'
                        Bet: + tournament?: string
                        AppSettings: + generatedStrategy?: GeneratedStrategy, + roundAmounts: boolean, + disableChecklist?: boolean
                        GeneratedStrategy: + rationale?, keyPrinciples?, recommendedApproaches?,
                        recommendedBetTypes?, betTypeRationale?, oddsRationale? (6 rich output fields)
                        StrategyAnswers, + 10 union types
constants/index.ts    — SPORTS, BET_TYPES, STRATEGIES, FREE_LIMITS, ODDS_RANGES
utils/
  stats.ts            — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek,
                        calcByHour, isInTilt, calcByTournament, calcByTeam, parseEventTeams
                        getPickedTeams(event, pick) — внутренний хелпер: возвращает только команды,
                        на которые поставил игрок (П1/П2/Ф1/Ф2 и прямые имена); используется в calcByTeam
  kelly.ts            — kellyFraction, halfKelly, expectedValue, impliedProbability
  formatters.ts       — formatMoney(kopecks, currency='₽', maxDecimals=2), parseMoneyInput, formatOdds, formatPercent (adds + prefix)
  strategyBuilder.ts  — STRATEGY_QUESTIONS (10 вопросов), buildStrategy(answers)
  migrations.ts       — migrate(raw)
```
