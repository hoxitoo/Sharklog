# SharkLog — AI Session Context

This file exists so Claude Code can resume development without losing context between sessions.
Read this at the start of every new session.

---

## Project Summary

Professional bet-tracking app for the CIS market. Freemium model (199 ₽/mo or 990 ₽/yr).
Target: serious bettors who track 50+ bets/month and care about discipline and bankroll management.

---

## Repository

- GitHub: `hoxitoo/Sharklog`
- Active branch: `claude/busy-shannon-jQgRK`
- Always push to this branch. Never push to `main` directly.

---

## Monorepo Layout

```
apps/mobile/src/
  screens/
    BetsScreen/         — FlatList + status filter + search
    AddBetScreen/       — react-hook-form, team autocomplete, esports discipline
    DashboardScreen/    — stats grid, W/L strip, heatmap, P&L chart (gifted-charts)
    AnalyticsScreen/    — 6 slice sections with bar visualization (ProGate)
    BankrollScreen/     — bank summary + Kelly calculator (ProGate)
    DisciplineScreen/   — mood tracker, tilt stats, 8 rules, diary
    SettingsScreen/     — bookmakers CRUD, pro toggle, clear data
  components/
    ProGate.tsx         — wraps PRO content, shows paywall when !isPro
    ScreenHeader.tsx    — title + subtitle + optional right CTA button
  navigation/
    RootNavigator.tsx   — Stack(Tabs + AddBet modal + Bankroll)
                          Tabs: Ставки | Дашборд | Дисциплина | Аналитика | Настройки
  store/
    betsStore.ts        — Zustand store, all state + actions
  theme/
    colors.ts           — two-accent palette

packages/core/src/
  types/bet.ts          — Bet, Team, EsportsDiscipline, Bankroll, DiaryEntry, AppSettings, StorageSchema
  constants/index.ts    — SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, FREE_LIMITS
  utils/
    stats.ts            — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek, isInTilt
    kelly.ts            — kellyFraction, halfKelly, expectedValue, impliedProbability
    formatters.ts       — formatMoney(kopecks), parseMoneyInput, formatOdds, formatPercent
    migrations.ts       — migrate(raw) — versioned migration map

apps/desktop/           — Tauri v2 + React + Vite scaffold (NOT YET IMPLEMENTED)
```

---

## Data Model

### Bet
```typescript
interface Bet {
  id: string;                    // UUID v4
  createdAt: string;             // ISO-8601
  updatedAt: string;             // ISO-8601
  date: string;                  // YYYY-MM-DD
  time: string;                  // HH:MM
  sport: Sport;                  // 'football'|'hockey'|'basketball'|'tennis'|'esports'|...
  discipline?: EsportsDiscipline; // 'dota2'|'csgo'|'lol'|'valorant'|'pubg'|'r6'|'apex'|'other_esports'
  bookmaker: string;
  event: string;                 // "Team A vs Team B"
  betType: BetType;
  pick: string;
  odds: number;                  // decimal, e.g. 1.85
  stake: number;                 // KOPECKS (integer) — never float
  status: BetStatus;             // 'pending'|'won'|'lost'|'refund'
  strategy: Strategy;
  notes?: string;
  schemaVersion: number;
}
```

### Team (auto-saved from event field)
```typescript
interface Team {
  id: string;
  name: string;
  sport: Sport;
  discipline?: EsportsDiscipline; // critical for esports — NaVi in Dota 2 ≠ NaVi in CS2
  usageCount: number;
  lastUsed: string;
}
```

### AppSettings
```typescript
interface AppSettings {
  tiltThreshold: number;  // consecutive losses to trigger alert (Free: fixed at 3)
  dailyBetLimit: number;  // 0 = unlimited (PRO only)
  bookmakers: string[];
  isPro: boolean;
  proExpiresAt?: string;
  onboardingComplete: boolean;
  schemaVersion: number;
}
```

### Storage (AsyncStorage key: `@sharklog/data`)
```typescript
interface StorageSchema {
  bets: Bet[];
  bankroll: Bankroll;
  diary: DiaryEntry[];
  settings: AppSettings;
  teams: Team[];
  version: number;
}
```

---

## Key Invariants

1. **Money = kopecks integer**. `1000 ₽ = 100000`. Use `formatMoney()` to display, `parseMoneyInput()` to parse.
2. **Team memory**: teams auto-extracted from `event` field on bet save. Format: "NaVi vs Virtus.pro" splits on " vs ".
3. **Esports discipline**: when `sport === 'esports'`, `discipline` must be set. Same team name + different discipline = different entries.
4. **PRO gate**: any PRO feature uses `<ProGate feature="описание">` wrapper.
5. **FREE_LIMITS**: `MAX_BETS=50`, `TILT_ALERT_THRESHOLD=3`. Defined in `packages/core/src/constants/index.ts`.
6. **Tilt alert**: fires when loss streak ≥ `settings.tiltThreshold`.

---

## Color System

```typescript
// teal  = wins / positive values / metric displays
colors.accent    = '#22D3A0'
colors.accentDim = '#22D3A022'

// purple = interactive CTAs / buttons / active states / tab bar
colors.purple    = '#5B6AF0'
colors.purpleDim = '#5B6AF022'

colors.won     = '#22D3A0'   // teal
colors.lost    = '#F4455A'   // red
colors.pending = '#F59E0B'   // gold
colors.refund  = '#A78BFA'   // violet
```

CTA buttons (submit, add, active filters, tab bar) → `colors.purple`
Value displays (P&L positive, win streak, half kelly) → `colors.accent`

---

## Navigation Structure

```
RootStack
├── Tabs (BottomTabNavigator)
│   ├── Bets        (📋 Ставки)
│   ├── Dashboard   (📊 Дашборд)
│   ├── Discipline  (🧘 Дисциплина)
│   ├── Analytics   (🔬 Аналитика)  [ProGate]
│   └── Settings    (⚙️ Настройки)
├── AddBet (modal, headerShown)
└── Bankroll (stack, headerShown, accessible from Dashboard card)
```

---

## Zustand Store (betsStore.ts)

```typescript
interface BetsStore {
  bets: Bet[];
  settings: AppSettings;
  bankroll: Bankroll;
  diary: DiaryEntry[];
  teams: Team[];         // auto-populated on addBet/updateBet
  isLoaded: boolean;

  load(): Promise<void>;
  persist(): Promise<void>;
  addBet(bet: Bet): void;           // also extracts + upserts teams
  updateBet(id, updates): void;     // also updates teams
  deleteBet(id): void;
  updateSettings(updates): void;
  updateBankroll(updates): void;
  addDiaryEntry(entry): void;
  deleteTeam(id): void;
  canAddBet(): boolean;
}
```

---

## Completed Work (as of 2026-05-24)

### packages/core
- [x] Types: Bet, Team, EsportsDiscipline, Bankroll, DiaryEntry, AppSettings, StorageSchema
- [x] Constants: SPORTS, BET_TYPES, STRATEGIES, ESPORTS_DISCIPLINES, FREE_LIMITS, ODDS_RANGES
- [x] Stats: calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek, isInTilt
- [x] Kelly: kellyFraction, halfKelly, expectedValue, impliedProbability
- [x] Formatters: formatMoney, parseMoneyInput, formatOdds, formatPercent
- [x] Migrations: versioned migrate() function

### apps/mobile
- [x] Zustand store with AsyncStorage persistence
- [x] All 7 screens implemented
- [x] Team autocomplete in AddBetScreen (auto-saved, filtered by sport/discipline)
- [x] Esports discipline selector in AddBetScreen
- [x] P&L area chart (react-native-gifted-charts LineChart)
- [x] W/L result squares strip on Dashboard
- [x] 12-week P&L heatmap on Dashboard
- [x] DisciplineScreen: mood tracker, tilt stats, 8 rules, diary
- [x] Bankroll: Kelly calculator, deposit history (accessible via Dashboard → Bankroll card)
- [x] ProGate paywall component
- [x] Two-accent color palette (teal = values, purple = CTAs)

---

## Pending / Next Steps

### High Priority
- [ ] **Desktop app** — scaffold Tauri v2 + React app (`apps/desktop/src/`)
  - Start with: `src/App.tsx`, `src/store/betsStore.ts` (Zustand + SQLite), basic layout
  - Reuse `packages/core` for all business logic
  - Use Recharts for charts (already in package.json)
- [ ] **Pre-bet checklist modal** — blocking 5-question checklist before AddBetScreen opens (PRO feature)
  - Questions: not tilting, following strategy, within daily limit, analyzed the bet, accept the loss
  - Cannot proceed until all checked OR user explicitly skips (with warning)

### Medium Priority
- [ ] **Analytics bar charts** — connect gifted-charts BarChart in AnalyticsScreen slices
- [ ] **Export to CSV/Excel** — `expo-sharing` + `expo-file-system` already installed
- [ ] **Push notifications** — daily reminder, tilt alert (`expo-notifications` installed)
- [ ] **DM Sans + DM Mono fonts** — `expo-google-fonts`
- [ ] **Onboarding flow** — first-run setup (bankroll, bookmakers, tilt threshold)

### Low Priority
- [ ] RevenueCat integration for real paywall
- [ ] Desktop: LemonSqueezy for payments

---

## Commands

```bash
# Install all deps
npm install

# Mobile
cd apps/mobile && npx expo start

# Desktop (when implemented)
cd apps/desktop && npx tauri dev

# Core tests
cd packages/core && npx vitest run

# Type check mobile
cd apps/mobile && npx tsc --noEmit

# Git push
git push -u origin claude/busy-shannon-jQgRK
```

---

## Important Context for Next Session

- The desktop app (`apps/desktop/`) has `package.json` and `tauri.conf.json` scaffolded but NO source files yet. `apps/desktop/src/` does not exist.
- gifted-charts is installed and working — see DashboardScreen for LineChart usage pattern.
- The `ESPORTS_DISCIPLINES` constant and `EsportsDiscipline` type are exported from `@sharklog/core`.
- Team upsert logic is in `betsStore.ts` — `upsertTeams()` function does case-insensitive name matching.
- All monetary calculations use kopecks. Display with `formatMoney(kopecks)` from `@sharklog/core`.
