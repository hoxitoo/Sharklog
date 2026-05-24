# SharkLog — Контекст проекта

Bet tracker app — мобильное (React Native + Expo) и десктопное (Tauri v2 + React) приложение для учёта ставок. Freemium: 199 ₽/мес или 990 ₽/год.

## Структура монорепо

```
apps/mobile/     — React Native + Expo 51 (iOS + Android)  ← АКТИВНАЯ РАЗРАБОТКА
apps/desktop/    — Tauri v2 + React + Vite (Phase 3, frontend scaffolded)
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
- Весь стейт мобилки — Zustand store (`apps/mobile/src/store/betsStore.ts`).
- PRO-функции — `<ProGate feature="...">` компонент.
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
```

## Бизнес-правила

- Free лимит: **50 ставок** (`FREE_LIMITS.MAX_BETS`)
- Тилт-алерт: **3 поражения подряд** (Free, фикс) / **N** (PRO, настраивается через stepper в Settings)
- Дневной лимит: только PRO, 0 = без лимита
- 7 дней бесплатного Pro для новых пользователей
- Freemium: 199 ₽/мес, 990 ₽/год

## Команды

```bash
cd packages/core && npx vitest run          # тесты (12 штук)
cd apps/mobile && npx tsc --noEmit          # type-check мобилки
cd apps/desktop && npx tsc --noEmit         # type-check десктопа
cd apps/mobile && npx expo start            # запуск мобилки
git push -u origin claude/busy-shannon-jQgRK
```

## Важные паттерны

```typescript
// Деньги
const kopecks = parseMoneyInput('1000');  // → 100000
formatMoney(100000);                       // → '1 000 ₽'

// Optional props с exactOptionalPropertyTypes
<Component {...(value ? { prop: value } : {})} />

// clearAll — сброс всех данных пользователя
useBetsStore(s => s.clearAll)()

// PRO-gate
<ProGate feature="Описание фичи">
  <ActualContent />
</ProGate>
```
