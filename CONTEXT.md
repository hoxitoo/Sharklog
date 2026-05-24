# SharkLog — AI Session Context

Read this at the start of every session. Always develop on `claude/busy-shannon-jQgRK`, never push to `main` directly.

---

## Monorepo

```
apps/mobile/src/
  screens/
    BetsScreen/         — SectionList с датами + daily P&L, search, status filter (scroll), sort row, swipe-to-delete, haptics
    AddBetScreen/       — react-hook-form, TeamAutocomplete, Kelly calculator (collapsible, запускается при odds > 1)
    DashboardScreen/    — period filter (7д/30д/Всё), stats grid, W/L strip, heatmap, P&L chart, best/worst bet
    AnalyticsScreen/    — period filter (7д/30д/Всё), SummaryCard + 8 срезов с барами (PRO via ProGate)
    BankrollScreen/     — equity curve LineChart, сводка банкролла, inline deposit/withdrawal, Kelly (PRO)
    DisciplineScreen/   — mood picker (1-5), тилт-стата (X/N лимит для PRO), 8 правил, diary
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
    sentry.ts           — initSentry, captureException, setUserContext, clearUserContext
  store/
    betsStore.ts        — Zustand + AsyncStorage; addBet, updateBet, deleteBet,
                          updateSettings, updateBankroll, addDiaryEntry, deleteTeam, clearAll, canAddBet
  theme/
    colors.ts           — two-accent palette (accent=teal, purple=CTA)
  utils/
    haptics.ts          — haptic.selection/light/medium/heavy/success/warning/error
    notifications.ts    — scheduleDailyReminder (20:00), sendTiltNotification, requestNotificationPermission
    exportCSV.ts        — CSV с UTF-8 BOM, expo-file-system + expo-sharing

apps/desktop/src/       — React+Vite frontend (TypeScript strict), Tauri v2 backend (src-tauri/)
  App.tsx               — routing, modal state, Cmd+N hotkey, Esc to close
  layouts/
    AppLayout.tsx       — sidebar (logo, nav, "+ Новая ставка" btn, free progress bar)
  store/
    betsStore.ts        — Zustand + localStorage; same interface as mobile store
  pages/
    DashboardPage.tsx   — period filter, 6-stat grid, W/L strip, 12-week heatmap, P&L chart, best/worst, empty state
    BetsPage.tsx        — date-grouped sections (tbody), daily P&L per section, search, status filter, sort (4 modes)
    AddBetModal.tsx     — full form with TeamAutocomplete, canAddBet() guard, limit banner, potential win preview
    AnalyticsPage.tsx   — 7 срезов: sport/betType/bookmaker/strategy/oddsRange/dayOfWeek/hour (PRO)
    BankrollPage.tsx    — equity curve, unit stepper, deposit/withdrawal, Kelly calc (PRO)
    DiaryPage.tsx       — mood picker, tilt stats, 8 правил, diary history
    SettingsPage.tsx    — subscription, tilt stepper, daily limit stepper, bookmakers, CSV+JSON export, JSON import
  theme/
    colors.ts           — same palette as mobile
  apps/desktop/src-tauri/  — Tauri v2 Rust backend
    tauri.conf.json     — productName, identifier, window config, bundle targets
    Cargo.toml          — tauri 2.x, tauri-plugin-opener, tauri-plugin-shell
    src/main.rs + lib.rs — entry point

packages/core/src/
  types/bet.ts          — Bet, Team, EsportsDiscipline, Bankroll, DiaryEntry, AppSettings, StorageSchema
  constants/index.ts    — SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, FREE_LIMITS, ODDS_RANGES
  utils/
    stats.ts            — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek, calcByHour, isInTilt
    kelly.ts            — kellyFraction, halfKelly, expectedValue, impliedProbability, recommendedStake
    formatters.ts       — formatMoney, parseMoneyInput, formatOdds, formatPercent
    migrations.ts       — migrate(raw)
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

interface AppSettings {
  tiltThreshold: number;   // Free: фикс 3 / PRO: stepper 2–10
  dailyBetLimit: number;   // 0 = нет лимита (только PRO); enforced в canAddBet()
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

interface BankrollTransaction {
  id: string;              // UUID v4 — никогда не Date.now()
  type: 'deposit' | 'withdrawal';
  amount: number;          // kopecks
  date: string;            // ISO-8601
  note?: string;
}
```

---

## Key Invariants

1. **Money = kopecks integer**: `1000 ₽ → 100_000`. `formatMoney()` / `parseMoneyInput()`.
2. **IDs = UUID v4**: все сущности (Bet, Team, BankrollTransaction, DiaryEntry) — UUID v4, не Date.now().
3. **Team memory**: `upsertTeams()` в store вызывается при каждом addBet/updateBet.
4. **Esports discipline**: `sport === 'esports'` → discipline обязателен. Compound key: `name+sport+discipline`.
5. **exactOptionalPropertyTypes: true**: `prop={undefined}` → ошибка. Используй `{...(x ? { prop: x } : {})}`.
6. **PRO gate (mobile)**: любой PRO-контент через `<ProGate feature="...">`.
7. **clearAll()**: сбрасывает bets/diary/teams/bankroll, сохраняет `onboardingComplete: true`.
8. **canAddBet()**: false если Free && bets >= FREE_LIMITS.MAX_BETS; false если Pro && dailyBetLimit > 0 && todayBets >= limit.
9. **Period filter**: `b.date > cutoffStr` (НЕ `>=`) — иначе off-by-one (8 дней вместо 7).

---

## Desktop Store Interface (localStorage)

```typescript
interface BetsStore {
  bets: Bet[]; settings: AppSettings; bankroll: Bankroll;
  diary: DiaryEntry[]; teams: Team[]; isLoaded: boolean;

  load(): void;
  persist(): void;
  addBet(bet: Bet): void;
  updateBet(id: string, updates: Partial<Bet>): void;
  deleteBet(id: string): void;
  updateSettings(updates: Partial<AppSettings>): void;
  updateBankroll(updates: Partial<Bankroll>): void;
  addDiaryEntry(entry: DiaryEntry): void;
  deleteTeam(id: string): void;
  clearAll(): void;
  canAddBet(): boolean;
}
```

---

## CI / Build

- **CI**: `.github/workflows/ci.yml` — `npm ci` → vitest → tsc mobile+desktop
- **EAS Build**: `.github/workflows/eas-build.yml` — ручной `workflow_dispatch`
  - Требует: `EXPO_TOKEN` secret + реальный `projectId` в `app.json`
- **EAS профили**: development / preview (APK) / production (autoIncrement)
- **Tauri Build** (desktop): `cd apps/desktop && npx tauri build` → платформенные инсталляторы
  - Windows: `.msi` + `.exe` (NSIS)
  - macOS: `.dmg` + `.app`
  - Linux: `.deb` + `.AppImage`
  - Требует: Rust + платформенные зависимости (см. README)

---

## Что сделано

### Mobile (Phase 2 — complete)
- [x] Все 7 мобильных экранов + OnboardingScreen
- [x] Zustand store с полным CRUD + AsyncStorage persistence
- [x] RevenueCat paywall (real offerings, purchase, restore)
- [x] Push notifications (daily reminder, tilt alert с правильным streak count)
- [x] CSV export (expo-sharing, UTF-8 BOM)
- [x] Team autocomplete с esports discipline
- [x] Pre-bet checklist modal (PRO)
- [x] CI: tests + type-check (все зелёные)
- [x] EAS: development/preview/production profiles
- [x] DM Sans + DM Mono fonts (useFonts hook, 6 variants)
- [x] Haptic feedback: haptics.ts, wired в AddBet + BetCard + DisciplineScreen
- [x] BetsScreen: sort (date/odds/stake) + status filter scroll + date sections с daily P&L
- [x] AnalyticsScreen: SummaryCard + 8 срезов, period filter
- [x] AddBetScreen: Kelly calculator (collapsible, implied prob, EV, half-kelly)
- [x] canAddBet() enforces dailyBetLimit для PRO + free limit
- [x] BankrollScreen: equity curve LineChart
- [x] Dashboard: best/worst bet, W/L strip (oldest-first), heatmap

### Desktop (Phase 3 — frontend complete, Tauri backend added)
- [x] DashboardPage: period filter, 6 stat cards, W/L strip, 12-week heatmap, P&L chart, best/worst, empty state
- [x] BetsPage: date-grouped sections, daily P&L headers, search+filter, 4 sort modes, DM Mono for numbers
- [x] AddBetModal: TeamAutocomplete, canAddBet() guard + limit banner, potential win preview, date+time fields
- [x] AnalyticsPage: 7 срезов + bar charts + table, period filter, PRO gate с рабочей кнопкой
- [x] BankrollPage: equity curve AreaChart, unit stepper, Kelly calc, deposit/withdrawal, PRO gate
- [x] DiaryPage: mood picker, tilt stats, 8 правил, diary history
- [x] SettingsPage: tilt+daily-limit steppers (PRO), bookmakers, CSV+JSON export, JSON import/restore
- [x] AppLayout: sidebar nav + "+ Новая ставка" button + free progress bar
- [x] Keyboard shortcuts: Cmd/Ctrl+N (new bet), Esc (close modal)
- [x] DM Sans + DM Mono (Google Fonts CDN в index.html)
- [x] Tauri v2 backend scaffold: tauri.conf.json, Cargo.toml, main.rs, capabilities

### Core (packages/core)
- [x] calcByHour() — статистика по часам дня
- [x] Bugfix: totalStaked включает refund-ставки (ROI был завышен)
- [x] Bugfix: period filter off-by-one (>= → >)

---

## Команды

```bash
cd packages/core && npx vitest run          # тесты (12 штук)
cd apps/mobile && npx tsc --noEmit          # type-check мобилки
cd apps/desktop && npx tsc --noEmit         # type-check десктопа
cd apps/mobile && npx expo start            # запуск мобилки

# Desktop dev (браузер):
cd apps/desktop && npx vite dev

# Desktop dev (Tauri window):
cd apps/desktop && npx tauri dev

# Desktop production build (инсталлятор):
cd apps/desktop && npx tauri build

git push -u origin claude/busy-shannon-jQgRK
```
