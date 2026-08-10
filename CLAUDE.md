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
- **Пути в обход `addBet` не ставят напоминания** (импорт CSV/JSON, восстановление бэкапа) — после них дёргай `syncBetResultReminders`. Выключение тумблера должно снимать уже поставленные (`cancelAllBetResultReminders`), а не только прекращать новые.
- **`clearAll`** чистит только данные (ставки/дневник/банк), но СОХРАНЯЕТ настройки и подписку (PRO/язык/букмекеры) — не сбрасывай `settings` к дефолтам.
- **Даты-строки `YYYY-MM-DD`** парсь как локальные (`new Date(\`${d}T00:00:00\`)`), bare-строка парсится как UTC и смещает день. На десктопе локаль для `toLocaleDateString` — через `dateLocale(lang)` из `i18n`.
- **Очистка опциональных полей на edit**: `updateBet` делает merge `{...bet, ...updates}`, поэтому пустое поле, просто *опущенное* из `updates`, НЕ стирает старое значение. Чтобы очистить (напр. `closingOdds`/`cashoutAmount`), передавай ключ явно как `undefined` (через `... as Partial<Bet>`), а не опускай его.
- **gifted-charts: `hideDataPoints` убивает `customDataPoint`** — маркеры на линии не отрисуются. Для линий с метками (депозиты/выводы) рисуй свой SVG (`components/BalanceChart.tsx`), а не борись с библиотекой.
- **Палитра графиков — одна на всё приложение**: `theme/chartColors.ts` (`SERIES`: win/loss/pnl/balance/deposit/withdrawal). Не заводи цвета серий по месту.
- **Ландшафтный режим через rotate-трансформ** (`ExpandedDashboard`): экран поворачивается на 90° по часовой, поэтому отступы безопасной зоны надо ПЕРЕСТАВЛЯТЬ — `paddingRight ← insets.bottom` (там наэкранные кнопки), `paddingLeft ← insets.top`. Иначе контент лезет под системную навигацию.
- **Действия из уведомления применяй ТОЛЬКО после `isLoaded`** — на холодном старте стор ещё пуст, и `updateBet` по пустому массиву затем запишет пустой снапшот поверх реальных данных. В `App.tsx` действие буферизуется в ref и применяется в эффекте по `isLoaded`.
- **Уведомления: детерминированный id `bet-result-<betId>`** — планирование идемпотентно (повторное перезаписывает, а не дублирует), отмена O(1). Все записи сериализованы через `notifChain`, иначе отмена может обогнать планирование и напоминание запишется ПОСЛЕ закрытия ставки.
- **Даты только через `toYmd()`** — `toISOString().split('T')[0]` даёт UTC-день. Из-за этого ставка могла записаться завтрашним числом (и выпасть из статистики), а транзакции банкролла — попасть в другой день, чем текущий банк в шапке.
- **Напоминание о результате не должно приходить по закрытой ставке** — защита в три слоя: (1) `updateBet` снимает запланированное и убирает уже доставленное из шторки, (2) `syncBetResultReminders(bets, enabled)` сверяет расписание с реальностью при запуске и каждом возврате в приложение (отмена — fire-and-forget, её может «потерять» при убийстве процесса; импорт CSV тоже создаёт дрейф), (3) `setNotificationHandler` глушит показ в foreground через `setBetPendingResolver`.
- **Новую функцию в `utils/notifications.ts` добавляй и в мок** `src/__tests__/__mocks__/notifications.ts`, иначе падают тесты стора.
- **Inline-инпуты в списках**: у `SectionList`/`FlatList` с полем ввода внутри строки ставь `keyboardShouldPersistTaps="handled"`, иначе первый тап по кнопке при открытой клавиатуре съедается (двойной тап). Пример — inline-выкуп в `BetCard`.

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
cd packages/core && npx vitest run        # 98 unit-тестов core
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
  DashboardScreen/         — ПЕРЕРАБОТАН (не дублирует аналитику): сверху оборот по периоду + банкролл;
                             главный блок — интерактивный график по дням (10 дней, тап → детали дня),
                             «Развернуть» → ландшафтная таблица с фильтрами (rotate-трансформ, без нативных зависимостей)
                             стратегия-плашка → navigate('StrategyBuilder')
                             тепловая карта за collapsible toggle
                             тилт-баннер с dismiss × (AsyncStorage @sharklog/tilt_dismiss_date)
                             haptic.warning() при первом определении тилта
  InsightsScreen/          — TournamentRow (Free) + TeamCard (PRO via ProGate)
  AnalyticsScreen/         — РЕДИЗАЙН: hero-состояние сверху + collapsible «Расширенная статистика».
                             Hero: P&L+спарклайн, серии (лучшая/худшая/текущая), рекорды (макс выигрыш/проигрыш),
                             прошлый месяц с трендом, время ставок (донат 6 промежутков + топ-4 часа с P&L,
                             12h/24h через uses12HourClock()), CLV-карточка. Всё PRO via ProGate.
                             Расширенная (collapsible): sport/betType/bookmaker/strategy/odds/day срезы
  BankrollScreen/          — кривая банкролла = BalanceChart (свой SVG, подневная агрегация, читаемый тренд,
                             рабочие метки депозитов/выводов на линии);
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
                        Bet: + tournament?: string, + closingOdds?: number (для CLV)
                        AppSettings: + generatedStrategy?: GeneratedStrategy, + roundAmounts: boolean, + disableChecklist?: boolean
                        GeneratedStrategy: + rationale?, keyPrinciples?, recommendedApproaches?,
                        recommendedBetTypes?, betTypeRationale?, oddsRationale? (6 rich output fields)
                        StrategyAnswers, + 10 union types
constants/index.ts    — SPORTS, BET_TYPES, STRATEGIES, FREE_LIMITS, ODDS_RANGES
utils/
  stats.ts            — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek,
                        calcByHour, isInTilt, calcByTournament, calcByTeam, parseEventTeams, betPnl
                        betPnl(bet) — реализованный P&L одной ставки в копейках (общий хелпер)
                        getPickedTeams(event, pick) — внутренний хелпер: возвращает только команды,
                        на которые поставил игрок (П1/П2/Ф1/Ф2 и прямые имена); используется в calcByTeam
  daily.ts            — calcDailyBreakdown/summarizeDays/toYmd — подневная статистика для дашборда
                        (cumPnl/balance всегда по всей истории; toYmd — локальная дата, не toISOString)
  analytics.ts        — calcStreaks (лучшая W / худшая L / текущая), calcExtremes (макс выигрыш/проигрыш),
                        calcLastFullMonth(bets, now) (прошлый полный месяц + тренд), calcCLV (closingOdds),
                        calcTimeStats(bets, use12h) (6 4-часовых промежутков для доната + топ-4 часа с P&L),
                        calcMaxDrawdown (пик→дно кумулятивного P&L), calcEdge (WR vs безубыток),
                        calcMonthlyPnl(bets, now, months), calcMonthResult(bets, y, m) — итог любого месяца, RELIABLE_SAMPLE_MIN=100
  kelly.ts            — kellyFraction, halfKelly, expectedValue, impliedProbability
  formatters.ts       — formatMoney(kopecks, currency='₽', maxDecimals=2), parseMoneyInput, formatOdds, formatPercent (adds + prefix)
  strategyBuilder.ts  — STRATEGY_QUESTIONS (10 вопросов), buildStrategy(answers)
  migrations.ts       — migrate(raw)
```
