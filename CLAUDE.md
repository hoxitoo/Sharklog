# SharkLog — Контекст проекта

Bet tracker app — мобильное (React Native + Expo) и десктопное (Tauri v2 + React) приложение для учёта ставок.

## Структура монорепо

```
apps/mobile/     — React Native + Expo (iOS + Android)
apps/desktop/    — Tauri v2 + React + Vite (Win/Mac/Linux)
packages/core/   — Общая бизнес-логика (типы, статистика, Kelly, форматтеры)
docs/            — Спецификация и анализ
```

## Ключевые соглашения

- Деньги хранятся в **копейках** (integer). Никаких float для денег.
- Ставки идентифицируются **UUID v4** (не timestamp).
- Весь стейт мобилки — Zustand store (`apps/mobile/src/store/betsStore.ts`).
- Pro-функции оборачиваются в `<ProGate feature="...">` компонент.
- `packages/core` — чистый TS без зависимостей на React/RN/Browser.

## Команды

```bash
# Запуск тестов core
cd packages/core && npx vitest run

# Мобилка
cd apps/mobile && npx expo start

# Десктоп
cd apps/desktop && npx tauri dev
```

## Бизнес-правила

- Free лимит: 50 ставок (`FREE_LIMITS.MAX_BETS` в `packages/core/src/constants`)
- Тилт-алерт: 3 поражения подряд (Free, не настраивается) / N (PRO, настраивается)
- 7 дней бесплатного Pro для новых пользователей
- Freemium: 199 ₽/мес или 990 ₽/год
