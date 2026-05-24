# SharkLog — AI Session Context

Read this at the start of every session. Always develop on `claude/busy-shannon-jQgRK`, never push to `main` directly.

---

## Monorepo

```
apps/mobile/src/
  screens/
    BetsScreen/         — FlatList, search, status filter, ChecklistModal (PRO)
    AddBetScreen/       — react-hook-form, TeamAutocomplete, esports discipline selector
    DashboardScreen/    — stats grid, W/L strip, 12-week heatmap, P&L LineChart (gifted-charts)
    AnalyticsScreen/    — 6 slices с горизонтальными барами (PRO via ProGate)
    BankrollScreen/     — сводка банкролла, inline deposit form, Kelly calculator (PRO)
    DisciplineScreen/   — mood picker (1-5), тилт-стата, 8 правил, diary
    SettingsScreen/     — Stepper для PRO настроек, paywall modal, clearAll, export, notifications
    OnboardingScreen/   — 3 шага: welcome → стартовый банкролл → букмекеры
  components/
    ProGate.tsx         — пейвол с реальными RC offerings (monthly/annual), restore
    ScreenHeader.tsx    — title + subtitle + optional right CTA
    ChecklistModal.tsx  — 5 вопросов перед ставкой, только PRO
    StatusBadge.tsx     — цветной бейдж статуса ставки
  navigation/
    RootNavigator.tsx   — Stack: Tabs + AddBet (modal) + Bankroll
                          Tabs: Ставки | Дашборд | Дисциплина | Аналитика | Настройки
  services/
    revenueCat.ts       — initRevenueCat, getOfferings, purchasePackage, restorePurchases, syncEntitlement
  store/
    betsStore.ts        — Zustand + AsyncStorage; addBet, updateBet, deleteBet,
                          updateSettings, updateBankroll, addDiaryEntry, deleteTeam, clearAll
  theme/
    colors.ts           — two-accent palette
  utils/
    notifications.ts    — scheduleDailyReminder (20:00), sendTiltNotification, requestNotificationPermission
    exportCSV.ts        — CSV с UTF-8 BOM, expo-file-system + expo-sharing

packages/core/src/
  types/bet.ts          — Bet, Team, EsportsDiscipline, Bankroll, DiaryEntry, AppSettings, StorageSchema
  constants/index.ts    — SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, FREE_LIMITS, ODDS_RANGES
  utils/
    stats.ts            — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek, isInTilt
    kelly.ts            — kellyFraction, halfKelly, expectedValue, impliedProbability
    formatters.ts       — formatMoney, parseMoneyInput, formatOdds, formatPercent
    migrations.ts       — migrate(raw)

apps/desktop/src/       — React+Vite frontend (TypeScript чистый), Tauri backend НЕ создан
  App.tsx, store/betsStore.ts (localStorage)
  pages/: Dashboard, Bets+AddBetModal, Analytics, Bankroll, Settings
```

---

## Data Model

```typescript
interface Bet {
  id: string;                     // UUID v4
  createdAt/updatedAt: string;    // ISO-8601
  date: string;                   // YYYY-MM-DD
  time: string;                   // HH:MM
  sport: Sport;
  discipline?: EsportsDiscipline; // только когда sport === 'esports'
  bookmaker: string;
  event: string;                  // "Team A vs Team B" — парсится для team memory
  betType: BetType;
  pick: string;
  odds: number;                   // decimal (1.85)
  stake: number;                  // КОПЕЙКИ — никогда не float
  status: BetStatus;              // 'pending'|'won'|'lost'|'refund'
  strategy: Strategy;
  notes?: string;
  schemaVersion: number;
}

interface Team {
  id: string; name: string; sport: Sport;
  discipline?: EsportsDiscipline; // NaVi CS2 ≠ NaVi Dota 2 — разные записи
  usageCount: number; lastUsed: string;
}

interface AppSettings {
  tiltThreshold: number;   // Free: фикс 3 / PRO: stepper 2–10
  dailyBetLimit: number;   // 0 = нет лимита (только PRO)
  bookmakers: string[];
  isPro: boolean;
  onboardingComplete: boolean;
  schemaVersion: number;
}

interface Bankroll {
  id: string; name: string; currency: string;
  unitPercent: number;     // % банкролла = 1 юнит (default 2%)
  transactions: BankrollTransaction[];
  createdAt: string;
}
```

---

## Key Invariants

1. **Money = kopecks integer**: `1000 ₽ → 100_000`. `formatMoney()` / `parseMoneyInput()`.
2. **Team memory**: `upsertTeams()` в store вызывается при каждом addBet/updateBet.
3. **Esports discipline**: `sport === 'esports'` → discipline обязателен. Compound key: `name+sport+discipline`.
4. **exactOptionalPropertyTypes: true**: `prop={undefined}` → ошибка. Используй `{...(x ? { prop: x } : {})}`.
5. **PRO gate**: любой PRO-контент через `<ProGate feature="...">`.
6. **clearAll()**: сбрасывает bets/diary/teams/bankroll, сохраняет `onboardingComplete: true`.

---

## Store Interface

```typescript
interface BetsStore {
  bets: Bet[]; settings: AppSettings; bankroll: Bankroll;
  diary: DiaryEntry[]; teams: Team[]; isLoaded: boolean;

  load(): Promise<void>;
  persist(): Promise<void>;
  addBet(bet: Bet): void;                    // + upsertTeams, + tilt check
  updateBet(id: string, updates: Partial<Bet>): void;
  deleteBet(id: string): void;
  updateSettings(updates: Partial<AppSettings>): void;
  updateBankroll(updates: Partial<Bankroll>): void;
  addDiaryEntry(entry: DiaryEntry): void;
  deleteTeam(id: string): void;
  clearAll(): void;                          // полный сброс пользовательских данных
  canAddBet(): boolean;                      // false если Free && bets >= 50
}
```

---

## CI / Build

- **CI**: `.github/workflows/ci.yml` — `npm ci` → vitest → tsc mobile+desktop
- **EAS Build**: `.github/workflows/eas-build.yml` — ручной `workflow_dispatch`
  - Требует: `EXPO_TOKEN` secret + реальный `projectId` в `app.json`
- **EAS профили**: development / preview (APK) / production (autoIncrement)

---

## Что сделано (Phase 1 complete)

- [x] Все 7 мобильных экранов + OnboardingScreen
- [x] Zustand store с полным CRUD + persistence
- [x] RevenueCat paywall (real offerings, purchase, restore)
- [x] Push notifications (daily reminder, tilt alert)
- [x] CSV export (expo-sharing, UTF-8 BOM)
- [x] Team autocomplete с esports discipline
- [x] Pre-bet checklist modal (PRO)
- [x] CI: tests + type-check (все зелёные)
- [x] EAS: development/preview/production profiles
- [x] Placeholder assets (icon/splash/adaptive-icon)
- [x] `clearAll()`, редактируемые PRO-настройки (stepper), inline deposit form
- [x] Desktop frontend scaffold (TypeScript чистый, без Tauri backend)

---

## Следующие шаги (Phase 2)

### Текущий спринт
- [ ] **Bankroll: withdrawal + unit% config** — функциональный пробел
- [ ] **Sentry** — crash reporting перед первым реальным тестом

### После
- [ ] Финальные иконки (заменить placeholder)
- [ ] Скриншоты для App Store / Google Play
- [ ] Заполнить EAS projectId и Apple ID
- [ ] Задеплоить Privacy Policy

---

## Команды

```bash
cd packages/core && npx vitest run
cd apps/mobile && npx tsc --noEmit
cd apps/desktop && npx tsc --noEmit
cd apps/mobile && npx expo start
git push -u origin claude/busy-shannon-jQgRK
```
