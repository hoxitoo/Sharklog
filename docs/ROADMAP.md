# SharkLog — Roadmap

_Обновлено: 2026-06-06 (UX/UI v2)_

---

## ✅ Phase 0 — Фундамент (done)

- Monorepo: `apps/mobile`, `apps/desktop`, `packages/core`
- `packages/core`: типы, статистика, Kelly, форматтеры, миграции
- 12 unit-тестов, CI (vitest + tsc), `package-lock.json`

---

## ✅ Phase 1 — Mobile MVP (done)

### Навигация и экраны
- RootNavigator: Stack(Tabs + AddBet modal + Bankroll)
- Все 7 экранов + OnboardingScreen
- Zustand store + AsyncStorage persistence

### Контент
- Dashboard: stats grid, W/L strip, 12-недельный heatmap, P&L chart
- Analytics: SummaryCard (total/winrate/P&L/ROI) + 6 срезов с барами
- DisciplineScreen: mood tracker (1–5), тилт-статистика, 8 правил, дневник
- BankrollScreen: сводка, история транзакций, inline deposit/withdrawal, Kelly calculator
- Team autocomplete с esports discipline (NaVi CS2 ≠ NaVi Dota 2)
- Pre-bet checklist modal (PRO)

### UX
- Haptic feedback: selection/light/medium/heavy/success/warning/error (expo-haptics)
- BetsScreen: sort (date↓/date↑/odds↓/stake↓) + status filter (scrollable) + haptics
- AddBetScreen: Kelly calculator — implied prob, my estimate stepper, EV, half-kelly, "Применить"
- canAddBet() enforces PRO daily bet limit с contextual Alert

### Инфраструктура
- RevenueCat: real paywall, purchase, restore, syncEntitlement (safe — no downgrade on network fail)
- Push: ежедневный ремайндер 20:00, тилт-алерт (правильный streak count)
- CSV export (expo-sharing, UTF-8 BOM)
- EAS build profiles (development/preview/production), CI workflow
- Placeholder assets: icon.png, splash.png, adaptive-icon.png
- iOS/Android permissions в app.json

### Bugfixes
- Тилт-нотификация отправляла threshold (3) вместо actual streak count
- syncEntitlement мог downgrade PRO → Free при network failure
- `Date.now()` для ID → UUID v4 (Bankroll, Onboarding)
- "Потенциальный выигрыш" показывал payout (stake×odds), теперь profit (stake×(odds-1))
- Неиспользуемый импорт `BetStatus` удалён из stats.ts
- Side effects (tilt notification) перемещены из `set()` callback наружу

---

## ✅ Phase 2 — Desktop MVP (done)

### Экраны и функционал
- DashboardPage: period filter, 6 stat cards, W/L strip, 12-week heatmap, P&L chart, best/worst, empty state
- BetsPage: date-grouped sections, daily P&L headers, search+filter, 4 sort modes, DM Mono for numbers
- AddBetModal: TeamAutocomplete (sport-aware), canAddBet() guard + limit banner, potential win preview
- AnalyticsPage: 7 срезов + bar charts + table, period filter, PRO gate
- BankrollPage: equity curve AreaChart, unit stepper, Kelly calc, deposit/withdrawal, PRO gate
- DiaryPage: mood picker, tilt stats, 8 правил, diary history
- SettingsPage: tilt+daily-limit steppers (PRO), bookmakers, CSV+XLSX import, CSV+JSON export, JSON restore

### Инфраструктура (production-near)
- Tauri v2 backend: `tauri-plugin-sql` (SQLite), `tauri-plugin-updater`, Cargo.lock committed
- StorageService: IS_TAURI → SQLite `kv` table; иначе localStorage (для браузера/тестов)
- ErrorBoundary: web + mobile (class component, crash screen + retry)
- OnboardingPage: 3-step wizard (новые пользователи); существующие видят main app
- CSV + XLSX import (SheetJS, column aliases, RU/EN headers, date normalization)
- Owner PRO mode: `VITE_OWNER_PRO=true` → isPro = true на старте
- Auto-updater UI: "Проверить обновления" в SettingsPage → "О приложении"
- Release workflow: `.github/workflows/release-desktop.yml` → signed installers → GitHub Release
- 40 desktop smoke tests (vitest + happy-dom): betsStore x25, importBets x15
- 17 mobile smoke tests (jest, plain babel): betsStore x17

### Bugfixes
- `++ROI` двойной плюс в AnalyticsPage (formatPercent уже добавляет +)
- Unit stepper `₽` переносился на новую строку (добавлен whiteSpace: nowrap)

---

## ✅ Phase 2.5 — Полировка и доработки (done)

### Bilдер стратегий (оба приложения)
- `packages/core`: `STRATEGY_QUESTIONS` (10 вопросов), `buildStrategy(answers)` → `GeneratedStrategy`
- Mobile `StrategyBuilderScreen`: прогресс-бар → WizardScreen (вопросы с вариантами, кнопка "Назад") → ResultScreen (7 метрик, "Применить", "Пересоздать")
- Desktop `StrategyBuilderPage`: тот же флоу + PRO-gate; "Применить" сохраняет в store → плашка на DashборdeE
- Стратегия хранится в `settings.generatedStrategy`, отображается на Dashboard обоих приложений

### Форма добавления ставки (mobile)
- Новый BetMode-переключатель: **ординар / экспресс** вверху формы (pill-toggle)
- Поле «Событие» разделено на **Команда 1** + **Команда 2** с автофокусом (Enter → следующее поле)
- Экспресс-режим: динамические карточки матчей (добавить / удалить лег, сводный кэф)
- `pick` вычисляется автоматически: `BET_TYPES[betType]` для ординара, `'Экспресс'` для экспресса
- Поле **Турнир / Лига** с autocomplete `<datalist>`
- **Кешаут**: поле «Сумма выкупа» + превью прибыли/убытка появляется при `status=cashout`
- Фикс запятой: `nd()` — нормализация `','` → `'.'` перед `parseFloat` для русских клавиатур

### UX / дизайн (mobile)
- Фильтры BetsScreen: `alignItems: 'center'` в contentContainerStyle — кнопки больше не растягиваются
- Сортировка: `Кэф ↓ / ↑`, `Сумма ↓ / ↑` — повторный тап переключает направление
- Тилт-баннер 🔥 «Стоп. Ты в тилте.» в BetsScreen и DashboardScreen (использует все ставки, не фильтрованные)
- P&L-график ограничен контейнером `height: 140, overflow: hidden` — больше не занимает весь экран
- Текст: `textSecondary #8888A8`, `textMuted #606078` — улучшена читаемость мелкого текста
- Tab bar: `useSafeAreaInsets()` — больше не перекрывается системной навигацией Android

### Инфраструктура (mobile)
- `babel.config.js`: `process.env.NODE_ENV === 'test'` вместо `env.test`-блока — решает конфликт Jest + babel-preset-expo
- EAS Build: успешная сборка APK (build #14), исправлены все блокеры (`compileSdkVersion 36`, `promise` dep)

### Security audit & fixes (batch 8)
- **C-2** `eas.json`: удалён `EXPO_PUBLIC_OWNER_PRO=true` из preview-профиля (был запечён в APK-бинарь)
- **H-2** `tauri.conf.json`: `csp: null` → строгая CSP-политика (`default-src 'self'` + узкие исключения)
- **H-3** `crypto.randomUUID()` вместо `Math.random()`-UUID во всех 10 местах (mobile + desktop)
- **H-4** `google-service-account.json` добавлен в `.gitignore`
- **M-1** `error.stack` убран из UI ErrorBoundary обоих приложений (остался только в `console.error`)
- **M-2** JSON-импорт теперь стрипает `isPro`/`proExpiresAt` — нельзя поднять подписку через backup-файл
- **M-5** `opener:default` удалён из Tauri capabilities (неиспользуемый вектор XSS→IPC)
- **M-7** Лимит 10 МБ на все три типа импорта (JSON / CSV / XLSX)

### Bug audit & fixes (batch 9)
- `parseMoneyInput("1,000")` — правильный парсинг тысячных разрядов (было: 1₽, стало: 1000₽)
- `potentialWin` = `stake × (odds − 1)` везде (было `stake × odds`)
- Кривая капитала учитывает кешаут (`cashout` → `cashoutAmount − stake`)
- Тилт-детекция использует полный список ставок, а не фильтрованный
- `canAddBet()` теперь вызывается в `AddBetScreen.onSubmit` (ранее Free-лимит не соблюдался)
- `parseEventTeams` экспортирована из `packages/core`
- Замена `xlsx@0.18.5` (CVE) на `@e965/xlsx@0.20.3` (патченный fork)
- `schemaVersion: 1` хардкод заменён на `CURRENT_SCHEMA_VERSION` везде
- 7-дневный trial: `proExpiresAt` → автоотзыв при `load()`, "Отключить" скрыт в production
- `syncEntitlement` возвращает `null` при нет-сети (сохранить состояние) vs `false` (отписался)
- Tauri capability: добавлен `sql:allow-execute` (иначе `saveData()` падал в production)
- Easter egg `handleDevTap()` защищён `if (!__DEV__) return`
- E2E тесты: все 22 Playwright-теста зелёные
- `test-results/`, `playwright-report/` добавлены в `.gitignore`

---

## ✅ Phase 2.5 — Mobile UX/UI v2 (done)

> Точечная переработка интерфейса мобильного приложения без смены бизнес-логики.

### Навигация
- **Drawer-навигация**: таббар заменён на кастомный анимированный slide-out drawer (hamburger ≡ слева)
  - `DrawerNavigator.tsx`: `Animated.spring` (открытие) + `Animated.timing` (закрытие с callback)
  - `DrawerContext.tsx`: React Context — `openDrawer()` доступен из любого экрана
  - `ScreenHeader.tsx`: hamburger кнопка интегрирована во все заголовки
- **Векторные иконки**: emoji → `@expo/vector-icons` (Ionicons) во всём drawer
  - Активное состояние: filled-вариант иконки + `colors.purple`
  - Неактивное: outline-вариант + `colors.textSecondary`
  - Иконки: `receipt`, `bar-chart`, `bulb`, `flask`, `leaf`, `settings`, `wallet`, `options`, `gift`, `menu`
- **FAB «+»**: кнопка добавления ставки всегда видна (правый нижний угол, поверх всего контента)

### Функционал
- **Партнёры в drawer**: выделенная teal-карточка, всегда на виду (раньше — скрыто в Настройках)
- **Отключение чек-листа**: PRO-toggle в Настройках (`disableChecklist` в `AppSettings`)
  - `AppSettings.disableChecklist?: boolean` добавлено в `packages/core`
  - По умолчанию — включён (обратная совместимость)
- **ResponsibleGamblingBanner**: новый компонент (`components/ResponsibleGamblingBanner.tsx`)
  - Коллапсируемый, AsyncStorage-персистентный (`@sharklog/responsible_expanded`)
  - Required для App Store категории «Sports»

### AddBetScreen
- **Collapsible extra fields**: дополнительные поля (стратегия, букмекер, дата/время, турнир, заметки, фрибет) скрыты за toggle-кнопкой
  - Автораскрывается при редактировании ставки с уже заполненными доп. полями
  - Основные поля (событие, кэф, сумма, вид спорта, тип) всегда видны

### DashboardScreen
- **Иерархия блоков**: период → P&L KPI → W/L стрип → стат-грид → P&L кривая → серия/банк → последние ставки
- **Тепловая карта** — вынесена за collapsible toggle (раньше всегда раскрыта)
- **Тилт-баннер** — кнопка × dismiss, скрывается до следующего дня (AsyncStorage `@sharklog/tilt_dismiss_date`)
- **haptic.warning()** — срабатывает в момент первого определения тилт-состояния (через `useRef` prev-value)
- **haptic.success()** — при сохранении ставки в AddBetScreen (уже был, задокументировано)
- Удалены блоки «лучшая / худшая ставка» (перегрузка)

### Инфраструктура
- `@expo/vector-icons` добавлен в зависимости (входит в Expo SDK)
- TypeScript: 0 ошибок, 17/17 тестов зелёные

---

## 🔄 Phase 3 — Пред-релизная подготовка (в работе)

### ✅ Завершено
- [x] `TAURI_SIGNING_PRIVATE_KEY` добавлен в GitHub Secrets; desktop-релиз выпущен
- [x] Публичный ключ обновления в `tauri.conf.json`
- [x] `projectId` в `app.json` (`5d3248d5-6413-4bfc-afd6-83d5bfe75c35`)
- [x] Лендинг + Privacy Policy на GitHub Pages (`gh-pages` ветка)
- [x] README.md на русском
- [x] GitHub Actions: CI + desktop release + EAS build workflows
- [x] iOS Privacy Manifest (`privacyManifests` в `app.json`) — UserDefaults, FileTimestamp, SystemBootTime, DiskSpace
- [x] Коучмарки при первом визите (BetsScreen, DashboardScreen) — `Coachmark` компонент с AsyncStorage
- [x] Тег `v1.0.0` создан локально (запушить вручную: `git push origin v1.0.0`)

### 🔴 Критические блокеры (без них нельзя в сторы)

| Задача | Где | Оценка |
|--------|-----|--------|
| Финальные иконки (1024×1024, без placeholder) | Mobile | 1–2 дня |
| Скриншоты для App Store / Google Play | Mobile | 1 день |
| Privacy Policy URL в App Store Connect | iOS | 30 мин |
| Apple Developer account + App ID | iOS | — |
| Google Play Console аккаунт | Android | — |
| `eas.json`: Apple ID для `eas submit` | iOS | 30 мин |
| RevenueCat: создать продукты iOS / Android | Mobile | 2 ч |
| Sentry DSN в `eas.json` production | Mobile | 30 мин |
| `git push origin v1.0.0` — опубликовать тег для desktop-апдейтера | Desktop | 5 мин |

### 🟡 Важно, но не блокируют первый релиз

| Задача | Где | Оценка |
|--------|-----|--------|
| LemonSqueezy для desktop (вебхук → `isPro`) | Desktop | 2–3 дня |
| Sentry для desktop | Desktop | 2 ч |
| Аналитика событий (Amplitude / PostHog) | Both | 1–2 дня |
| Описания приложений (App Store / GP) | — | 2–4 ч |
| Первый GitHub Release `v1.0.0` для кнопки "Проверить обновления" | Desktop | 15 мин |

---

## ⬜ Phase 4 — Рост (после первого релиза)

| Фича | Платформа | Приоритет | Оценка |
|------|-----------|-----------|--------|
| Cloud sync / backup | Both | 🔴 high | 2–3 нед |
| Раздел с партнёрами (реф-ссылки на БК) | Both | 🟡 medium | 1 день |
| Перевод на EN / KZ / BY | Both | 🟡 medium | 3–5 дней |
| Odds API (автозаполнение кэфов) | Both | 🟡 medium | 3–5 дней |
| Виджеты iOS / Android | Mobile | 🟢 low | 1 нед |
| Telegram bot (уведомления / экспорт) | Both | 🟢 low | 1 нед |
| Multi-bankroll | Both | 🟡 medium | 3–5 дней |
| Авторизация + профиль пользователя | Both | 🔴 high | 2–4 нед |
| Альтернативные методы оплаты (desktop) | Desktop | 🟡 medium | 1 нед |

---

## Технические долги

| Долг | Важность | Статус |
|------|----------|--------|
| Финальные иконки | 🔴 high | В работе |
| LemonSqueezy (desktop) | 🔴 high | Не начато |
| Sentry DSN | 🟡 medium | Не начато |
| Cloud sync (Supabase?) | 🔴 high | Phase 4 |
| i18n-рефакторинг (500+ строк) | 🟡 medium | Phase 4 |
| E2E Detox (mobile) | 🟢 low | Phase 4 |

## Дизайн-долг

Аудит, приоритеты и отложенные референсы (Robinhood, Copilot Money, Linear,
TradingView) — в `docs/DESIGN_NOTES.md`. Пункты 1–2 (шрифты, табличные цифры)
сделаны; 3–7 (шкала типографики, разнести `<Card>`, сетка 4 px, зоны нажатия,
единая шапка) ждут.
