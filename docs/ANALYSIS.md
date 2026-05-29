# SharkLog — Технический анализ и план реализации

## Сильные стороны спецификации

**Продуктовые:**
- Чёткая freemium-воронка с правильным порогом (50 ставок ≈ 1.5–2 мес — пользователь уже «подсажен»)
- Тилт-контроль — уникальный дифференциатор, аналогов нет у конкурентов
- 7 срезов аналитики покрывают все реальные вопросы беттора
- Оффлайн-first v1 — правильное решение, убирает DevOps-сложность на старте

**Технические:**
- Tauri v2 vs Electron — верный выбор (размер ~5 МБ vs ~150 МБ)
- RevenueCat — отраслевой стандарт для мобильных подписок
- Монорепо с `packages/core` для переиспользования бизнес-логики
- TypeScript обязателен с v1.0

---

## Слабые зоны и исправления

### 1. Модель данных

**Проблема:** `id: number` (timestamp) — не уникален при быстром вводе, конфликты при импорте данных.

**Исправление:** UUID v4 строкой. Добавлены `createdAt`, `updatedAt` для сортировки и синхронизации в v2. Деньги хранятся в копейках (integer) — нет float-ошибок при P&L расчётах.

### 2. Хранилище

**Проблема:** `AsyncStorage` — flat key-value, при 500+ ставках `getItem('@bets')` десериализует весь массив на каждый рендер.

**Исправление:** Zustand store с единственным `persist()` вызовом — один JSON-ключ, минимальные I/O. При росте до 5K+ ставок — миграция на `expo-sqlite` (заготовка в `migrations.ts`).

### 3. "TypeScript с v1.1+"

**Проблема:** Добавление TypeScript постфактум в уже написанный JS-код — дорого и болезненно.

**Исправление:** TypeScript с первого коммита. Strict mode + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`.

### 4. Графики

**Проблема:** Victory Native имеет известные баги производительности на старых Android-устройствах (API 28–).

**Исправление:** `react-native-gifted-charts` — активная поддержка, лучшая производительность на RN 0.74+, нативный SVG.

### 5. Неопределённость стека ("Zustand или Context API")

**Проблема:** Для приложения с 5+ экранами и real-time обновлениями (тилт-алерт, лимиты) Context API с частыми мутациями — пересчёт всего дерева.

**Исправление:** Zustand с селекторами — компоненты подписываются только на нужный срез стора.

### 6. Отсутствие стратегии миграций

**Проблема:** Схема данных изменится между v1.0 и v1.1. Без версионирования — крэш у существующих пользователей.

**Исправление:** `schemaVersion` в каждом объекте + `migrate()` функция в `packages/core`.

### 7. Калькулятор Келли в v4

**Проблема:** Kelly + EV — это core-функции для PRO, помещать их в v2 = терять конверсионный аргумент.

**Исправление:** Перенесены в `packages/core/utils/kelly.ts` уже сейчас. UI-экран — в Phase 1 PRO.

### 8. Десктоп не переиспользует мобильную логику

**Проблема:** `packages/core` упоминается, но без конкретной структуры.

**Исправление:** Весь `calcStats`, `kelly`, `formatters` — в `packages/core`, импортируется и в mobile, и в desktop.

---

## Скорректированный план реализации

### Phase 0 — Foundation ✅ DONE

- [x] Монорепо: Turborepo + workspace конфиги
- [x] `packages/core`: типы, константы, статистика, Kelly, форматтеры, миграции
- [x] Unit-тесты core (vitest)
- [x] Design tokens (цвета, типографика)
- [x] Zustand store с persist
- [x] ProGate компонент
- [x] CI: GitHub Actions — type-check + test на PR

### Phase 1 — Mobile MVP ✅ DONE

- [x] React Navigation: Stack + BottomTabs (6 вкладок)
- [x] AddBetScreen: react-hook-form, BetMode (ординар/экспресс), Команда 1/2 split, запятая-фикс
- [x] BetsScreen: фильтры статуса, сортировка ↑↓, быстрые кнопки W/L/R/C, тилт-баннер
- [x] DashboardScreen: stat grid, heatmap, P&L chart (bounded), тилт-баннер
- [x] AnalyticsScreen: 8 срезов (PRO)
- [x] BankrollScreen: equity curve, Kelly calculator
- [x] DisciplineScreen: mood tracker, тилт-статистика, дневник
- [x] StrategyBuilderScreen: 10-вопросный визард → ResultScreen (PRO)
- [x] RevenueCat paywall, EAS Build (APK), Owner PRO mode

### Phase 2 — Desktop MVP ✅ DONE

- [x] Все 8 страниц: Dashboard, Bets, Analytics, Bankroll, Diary, Insights, StrategyBuilder, Settings
- [x] AddBetModal: TeamAutocomplete, Kelly calc, Турнир/Лига datalist, clipboard paste, cashout
- [x] StrategyBuilderPage: 10 вопросов → ResultCard → применяется на дашборде
- [x] Tauri v2 SQLite / localStorage абстракция
- [x] CSV + XLSX import/export, JSON backup/restore
- [x] Onboarding 3-step wizard
- [x] Owner PRO mode: `VITE_OWNER_PRO=true`

### Phase 3 — Пред-релизная подготовка 🔄 В РАБОТЕ

**Blockers (без них релиз невозможен):**
- [x] Tauri signing key — `TAURI_SIGNING_PRIVATE_KEY` в GitHub Secrets, pubkey в `tauri.conf.json`, desktop-релиз выпущен
- [x] EAS projectId — реальный UUID в `app.json` (`5d3248d5-6413-4bfc-afd6-83d5bfe75c35`)
- [ ] RevenueCat реальный projectId (iOS + Android)

**Монетизация:**
- [ ] LemonSqueezy для desktop (платёж → webhook → `isPro`)
- [ ] Убрать `VITE_OWNER_PRO` из production окружения

**Store prep:**
- [ ] Финальные иконки (заменить placeholder)
- [ ] Скриншоты для App Store / Google Play
- [ ] Privacy Policy задеплоен по URL
- [ ] Apple ID + ASC App ID в `eas.json`

**Релиз:**
- [ ] Сабмит в App Store (TestFlight → Review → Release)
- [ ] Сабмит в Google Play (Internal → Closed → Production)
- [ ] Desktop GitHub Release v0.1.0 (тег `v0.1.0` → CI соберёт инсталляторы)

### Phase 4 — v2 (2–3 мес после релиза)

- Supabase облачный бэкап + синхронизация
- CLV-трекер (сравнение с closing line)
- Telegram-бот (быстрое добавление через /bet)
- Мультибанкролл
- Виджет (iOS WidgetKit, Android AppWidget)
- Локализация на EN — выход на international market

---

## Ключевые технические решения

| Решение | Обоснование |
|---|---|
| Деньги в копейках (integer) | Исключает float-ошибки: 1.1 + 2.2 ≠ 3.3 в IEEE 754 |
| UUID вместо timestamp | Уникальность гарантирована, безопасен при импорте |
| Один JSON в AsyncStorage | Минимальные I/O операции, атомарность записи |
| `exactOptionalPropertyTypes` | Ловит `undefined` vs отсутствие поля на этапе компиляции |
| Gifted Charts вместо Victory | Поддерживается активно, нет багов с Android Hermes |
| Half-Kelly по умолчанию | Full Kelly — агрессивно, half-Kelly — стандарт для ставок |

---

## Риски (дополнительно к спеке)

| Риск | Митигация |
|---|---|
| AsyncStorage corruption при крэше | Всегда записывать полный JSON атомарно, валидировать при чтении |
| RevenueCat недоступен в РФ | Проверить статус, иметь fallback на прямые IAP через нативный код |
| Tauri WebView отличается на Win/Mac | Тестировать на реальных машинах, использовать CSS reset |
| Apple Review — тема ставок | Описание: «personal sports journal», без упоминания БК |
