# SharkLog — Roadmap

_Обновлено: 2026-05-25 (batch 5)_

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

## 🔄 Phase 3 — Пред-релизная подготовка (в работе)

### Blocker: подписи и ключи
- [ ] `npx tauri signer generate` → добавить `TAURI_SIGNING_PRIVATE_KEY` в GitHub Secrets
- [ ] Заменить `UPDATER_PUBLIC_KEY_PLACEHOLDER` в `tauri.conf.json` реальным публичным ключом
- [ ] Заменить `projectId: "PLACEHOLDER"` в `app.json` реальным EAS projectId

### Store prep (mobile)
- [ ] Финальные иконки (заменить placeholder — нужен дизайнер/Figma)
- [ ] Скриншоты для App Store / Google Play (нужен физический запуск)
- [ ] `eas.json`: заполнить Apple ID для submit
- [ ] Задеплоить Privacy Policy URL

### Монетизация
- [ ] LemonSqueezy для desktop (платежи, webhook → isPro)
- [ ] RevenueCat: заполнить реальный projectId для iOS/Android

### Observability
- [ ] Sentry DSN настроить в `eas.json` production env (mobile)
- [ ] Sentry для desktop (опционально)

---

## ⬜ Phase 4 — Рост (будущее)

| Фича | Платформа | Приоритет |
|------|-----------|-----------|
| E2E тесты (Detox) | Mobile | low |
| E2E тесты (Playwright) | Desktop | low |
| Multi-bankroll | Both | medium |
| Cloud sync / backup | Both | high |
| Odds API интеграция | Both | medium |
| Виджеты (iOS/Android) | Mobile | low |
| Telegram bot export | Both | low |

---

## Технические долги

| Долг | Важность | Когда |
|------|----------|-------|
| Финальные иконки | medium | До App Store |
| LemonSqueezy (desktop) | high | Phase 3 |
| Sentry DSN | medium | Phase 3 |
| EAS projectId | high | Phase 3 (blocker) |
| Tauri signing key | high | Phase 3 (blocker) |
| E2E тесты | low | Phase 4 |
| Cloud sync | high | Phase 4 |
