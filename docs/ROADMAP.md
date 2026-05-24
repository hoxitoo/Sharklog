# SharkLog — Roadmap

_Обновлено: 2026-05-24_

---

## ✅ Phase 0 — Фундамент (done)

- Monorepo (Turborepo): `apps/mobile`, `apps/desktop`, `packages/core`
- `packages/core`: типы, статистика (`calcDashboard`, `calcByField`, `isInTilt`), Kelly, форматтеры, миграции
- 12 unit-тестов, CI (vitest + tsc), `package-lock.json`

---

## ✅ Phase 1 — Mobile MVP (done)

### Week 1–2: Навигация и экраны
- RootNavigator: Stack(Tabs + AddBet modal + Bankroll)
- Все 7 экранов реализованы: Bets, Dashboard, Analytics, Discipline, Bankroll, Settings, Onboarding
- Zustand store + AsyncStorage persistence
- BetCard с inline статус-апдейтом (Alert)

### Week 3: Контент
- Dashboard: stats grid, W/L strip, 12-недельный heatmap, P&L chart (gifted-charts LineChart)
- Analytics: 6 срезов с горизонтальными барами (по спорту, типу, букмекеру, стратегии, коэффициенту, дню)
- DisciplineScreen: mood tracker (1–5), тилт-статистика, 8 правил, дневник
- BankrollScreen: сводка, история транзакций, калькулятор Келли (Kelly + Half Kelly + EV)
- Team autocomplete: авто-запоминание команд по спорту/дисциплине, dropdown в AddBetScreen
- Esports discipline: отдельные записи NaVi CS2 vs NaVi Dota 2
- Pre-bet checklist modal (PRO): 5 вопросов перед добавлением ставки

### Week 4: Инфраструктура
- RevenueCat: `initRevenueCat`, `getOfferings`, `purchasePackage`, `restorePurchases`, `syncEntitlement`
- ProGate: реальный пейвол с ценами из RC (monthly/annual), restore
- Onboarding: 3 шага (welcome, стартовый банкролл, букмекеры)
- Push-уведомления: ежедневный ремайндер 20:00, тилт-алерт (expo-notifications)
- CSV export (expo-file-system + expo-sharing, UTF-8 BOM)
- EAS build profiles (development/preview/production)
- CI: vitest + tsc type-check на каждый пуш; EAS build — manual workflow_dispatch
- Placeholder assets: icon.png (1024×1024), splash.png, adaptive-icon.png
- iOS `NSUserNotificationUsageDescription`, Android permissions

### Bugfixes
- `clearAll()` — полный сброс данных (bets, diary, teams, bankroll)
- Settings: редактируемые PRO-настройки через stepper (tiltThreshold 2–10, dailyBetLimit 0–20)
- Settings: "Попробовать Pro" открывает пейвол-модал вместо обхода RevenueCat
- BankrollScreen: replace `Alert.prompt` (iOS-only) → inline deposit form
- TypeScript: все `exactOptionalPropertyTypes` ошибки устранены
- `@types/react-native` удалён (deprecated с RN 0.71)

---

## 🔄 Phase 2 — Стабилизация и релиз (в работе)

### Приоритет 1: Bankroll (текущий спринт)
- [ ] Вывод средств (withdrawal) — функциональный пробел
- [ ] Настройка unit% прямо в BankrollScreen
- [ ] История транзакций: удаление отдельных записей

### Приоритет 2: Crash reporting
- [ ] Sentry (`@sentry/react-native`) — мониторинг крашей продакшена
- [ ] Sentry DSN через `EXPO_PUBLIC_SENTRY_DSN` env var

### Приоритет 3: Store prep
- [ ] Финальные иконки (заменить placeholder — нужен дизайнер или Figma)
- [ ] Скриншоты для App Store / Google Play (нужен физический запуск)
- [ ] `app.json`: заполнить реальный EAS projectId
- [ ] `eas.json`: заполнить Apple ID для submit
- [ ] Политика конфиденциальности URL (задеплоить `docs/PRIVACY_POLICY.md`)

### Приоритет 4: Шлифовка UX
- [ ] DM Sans + DM Mono fonts (`expo-google-fonts` — требует локального `npm install`)
- [ ] Haptic feedback на ключевых действиях
- [ ] Empty state иллюстрации (вместо emoji)

---

## ⬜ Phase 3 — Desktop (отложено)

Фронтенд (`apps/desktop/src/`) scaffolded, все страницы + store написаны.
Нужна локальная среда:
- Tauri v2 CLI + Rust toolchain (`src-tauri/` ещё не создан)
- LemonSqueezy для платежей (вместо RevenueCat)
- SQLite через `@tauri-apps/plugin-sql` (вместо localStorage)

### Что уже готово в десктопе
- `src/App.tsx`, `src/store/betsStore.ts` (localStorage)
- Все страницы: Dashboard (Recharts AreaChart), Bets + AddBetModal, Analytics, Bankroll, Settings
- TypeScript type-check проходит чисто

---

## Технические долги

| Долг | Важность | Когда |
|------|----------|-------|
| DM Sans fonts | low | Phase 2 |
| Haptic feedback | low | Phase 2 |
| Desktop Tauri backend | high | Phase 3 |
| Real icon design | medium | До App Store |
| E2E тесты (Detox) | low | Phase 3 |
| Android `Alert.prompt` → все места проверить | medium | Phase 2 |
