# SharkLog 🦈

Professional betting tracker for the CIS market. Mobile (React Native + Expo) and desktop (Tauri v2 + React) apps sharing a common TypeScript core.

## Features

- **Bet tracking** — full history with sport, bookmaker, strategy, odds, stake
- **Team autocomplete** — remembers teams per sport/esports discipline (NaVi in Dota 2 ≠ NaVi in CS2)
- **Dashboard** — P&L curve chart, W/L strip, 12-week heatmap, tilt detection
- **Analytics** — 7 slices: sport, bet type, bookmaker, strategy, odds range, day of week
- **Bankroll** — deposit tracking, Kelly calculator, unit sizing
- **Discipline** — daily mood tracker, 8 professional rules, diary, tilt stats
- **Freemium** — 50 free bets, PRO unlocks analytics, bankroll, discipline features

## Monorepo Structure

```
apps/
  mobile/     — React Native + Expo 51 (iOS + Android)
  desktop/    — Tauri v2 + React + Vite (Win/Mac/Linux)
packages/
  core/       — Shared business logic (types, stats, Kelly, formatters)
docs/         — Specification and analysis
```

## Quick Start

```bash
# Install dependencies
npm install

# Run mobile dev server
cd apps/mobile && npx expo start

# Run desktop dev server
cd apps/desktop && npx tauri dev

# Run core tests
cd packages/core && npx vitest run
```

## Tech Stack

| Layer | Mobile | Desktop |
|-------|--------|---------|
| Framework | React Native 0.74 + Expo 51 | Tauri v2 + React 18 |
| Navigation | React Navigation v6 | React Router v6 |
| State | Zustand + AsyncStorage | Zustand + tauri-plugin-sql (SQLite) |
| Charts | react-native-gifted-charts | Recharts |
| Forms | react-hook-form | react-hook-form |
| Payments | RevenueCat | LemonSqueezy |
| Language | TypeScript strict | TypeScript strict |

## Key Conventions

- **Money in kopecks** — all monetary values stored as integers (no float precision issues)
- **UUID v4** — all entity IDs generated client-side
- **PRO features** wrapped in `<ProGate feature="...">` component
- **Freemium limits** defined in `packages/core/src/constants/index.ts`
- **Single storage key** `@sharklog/data` in AsyncStorage for atomic writes

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Teal | `#22D3A0` | Win indicators, positive values |
| Purple | `#5B6AF0` | CTAs, interactive elements, active states |
| Red | `#F4455A` | Loss indicators, negative values |
| Gold | `#F59E0B` | Pending bets, PRO badge |
| Violet | `#A78BFA` | Refunds, secondary stats |

## Pricing

- Free: 50 bets, basic stats, tilt alerts
- Pro: 199 ₽/month or 990 ₽/year — unlimited bets, analytics, bankroll, discipline

## License

MIT
