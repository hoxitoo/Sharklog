# SharkLog — Контекст проекта

Bet tracker app — мобильное (React Native + Expo) и десктопное (Tauri v2 + React) приложение для учёта ставок. Freemium: 199 ₽/мес или 990 ₽/год.

## Структура монорепо

```
apps/mobile/     — React Native + Expo 51 (iOS + Android)
apps/desktop/    — Tauri v2 + React + Vite (Win / Mac / Linux) ← ПОЛНОСТЬЮ ГОТОВ
packages/core/   — Чистая TS бизнес-логика (типы, статистика, Kelly, форматтеры)
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

## Цветовая система

```
colors.accent   = '#22D3A0'  // teal  — победы, положительные значения
colors.purple   = '#5B6AF0'  // purple — CTA-кнопки, активные состояния, таб-бар
colors.won      = '#22D3A0'
colors.lost     = '#F4455A'
colors.pending  = '#F59E0B'
colors.refund   = '#A78BFA'
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
```

## Структура desktop (apps/desktop/src/)

```
App.tsx                    — загрузка, онбординг-роут, main layout
components/
  ErrorBoundary.tsx        — React class boundary, кнопки retry/reload
  ChecklistModal.tsx       — 5 вопросов перед ставкой (PRO)
  ConfirmModal.tsx         — подтверждение деструктивных действий
  Toaster.tsx              — toast уведомления
layouts/
  AppLayout.tsx            — sidebar, nav, FREE_LIMITS прогресс-бар
pages/
  DashboardPage.tsx        — period filter, 6 KPI, W/L strip, heatmap, pending bets
  BetsPage.tsx             — date-grouped sections, daily P&L, search/filter/sort
  AddBetModal.tsx          — форма + TeamAutocomplete + Kelly calculator + ChecklistModal
  AnalyticsPage.tsx        — 7 срезов (PRO), formatPercent без двойного +
  BankrollPage.tsx         — equity curve, Kelly calc, транзакции с удалением
  DiaryPage.tsx            — mood tracker, тилт-стата, дневник
  SettingsPage.tsx         — подписка, тилт-stepper, букмекеры, команды,
                             CSV/Excel/JSON import-export, проверка обновлений
  OnboardingPage.tsx       — 3-шаговый визард (welcome → букмекеры → go)
storage/
  storageService.ts        — SQLite (Tauri) / localStorage (browser) абстракция
store/
  betsStore.ts             — Zustand; load() async, persist() fire-and-forget
  toastStore.ts            — эфемерные toast-уведомления
utils/
  importBets.ts            — импорт CSV/XLSX с алиасами колонок, нормализацией дат
theme/
  colors.ts                — цветовая система
```
