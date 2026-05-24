# SharkLog — Roadmap

_Обновлено: 2026-05-24 (batch 4)_

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

## 🔄 Phase 2 — Шлифовка и App Store (в работе)

### Приоритет 1: Store prep
- [ ] Финальные иконки (заменить placeholder — нужен дизайнер/Figma)
- [ ] Скриншоты для App Store / Google Play (нужен физический запуск)
- [ ] `app.json`: заполнить реальный EAS projectId
- [ ] `eas.json`: заполнить Apple ID для submit
- [ ] Задеплоить Privacy Policy URL

### Приоритет 2: UX шлифовка
- [ ] DM Sans + DM Mono fonts (`expo-google-fonts`)
- [ ] Empty state иллюстрации (вместо emoji)
- [x] Swipe-to-delete (SwipeableRow — PanResponder, без external deps)
- [x] Pull-to-refresh для списка ставок (сбрасывает фильтры)
- [x] W/L/R chips на pending ставках (прямое закрытие без long-press)
- [x] Фильтр периода 7д/30д/Всё на Dashboard + Analytics
- [x] BetsScreen: SectionList с заголовками дат + daily P&L на секцию
- [x] Dashboard: лучшая/худшая ставка за период
- [x] BankrollScreen: кривая банкролла (LineChart equity curve)
- [x] DisciplineScreen: счётчик X/N для дневного лимита PRO

### Приоритет 3: Crash reporting
- [ ] Sentry DSN настроить в `eas.json` production env
- [ ] Sentry `setUserContext` при логине (currently implemented but needs real userId)

---

## ⬜ Phase 3 — Desktop (отложено)

Фронтенд (`apps/desktop/src/`) scaffolded, TypeScript clean.
Нужна локальная среда:
- Tauri v2 CLI + Rust toolchain (`src-tauri/` ещё не создан)
- LemonSqueezy для платежей (вместо RevenueCat)
- SQLite через `@tauri-apps/plugin-sql` (вместо localStorage)

---

## Технические долги

| Долг | Важность | Когда |
|------|----------|-------|
| DM Sans fonts | low | Phase 2 |
| Real icon design | medium | До App Store |
| ~~Swipe-to-delete~~ | ~~low~~ | ~~Phase 2~~ |
| Desktop Tauri backend | high | Phase 3 |
| E2E тесты (Detox) | low | Phase 3 |
