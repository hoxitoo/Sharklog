# SharkLog

> **Status:** Feature-complete, pre-release — Phase 3 (signing keys, store submission) in progress.

Professional betting tracker for the CIS market. Mobile (React Native + Expo) and desktop (Tauri v2 + React) apps sharing a common TypeScript core.

## Features

- **Bet tracking** — full history with sport, bookmaker, strategy, odds, stake, tournament/league; grouped by date with daily P&L
- **5 bet statuses** — Pending / Won / Lost / Refund (букмекер вернул) / Cashout (выкуп игроком)
- **Team autocomplete** — remembers teams per sport/esports discipline (NaVi in Dota 2 ≠ NaVi in CS2)
- **Dashboard** — P&L curve chart, W/L strip, 12-week activity heatmap, tilt detection, best/worst bet, active strategy badge
- **Analytics** — 7 slices: sport, bet type, bookmaker, strategy, odds range, day of week, hour of day + top tournaments block
- **Insights** — Tournament/League stats table (Free) + Favorite Teams cards (PRO, ≥10 bets per team)
- **Strategy Builder** (PRO) — 10-question wizard generates a personalised betting strategy; strategy badge on dashboard
- **Bankroll** — deposit/withdrawal tracking, Kelly calculator, unit sizing, equity curve
- **Discipline** — daily mood tracker, 8 professional rules, diary, tilt stats
- **Import** — CSV and Excel (.xlsx) import with Russian/English column headers; export to CSV and JSON
- **Clipboard paste** — paste a bet from clipboard to pre-fill the AddBet form (desktop)
- **Auto-updates** — Tauri updater with signed artifacts published via GitHub Releases
- **Freemium** — 50 free bets; PRO unlocks analytics, insights, strategy builder, bankroll, discipline features, custom limits

## Monorepo Structure

```
apps/
  mobile/     — React Native 0.85 + Expo 56 (iOS + Android)
  desktop/    — Tauri v2 + React + Vite (Win / Mac / Linux)
packages/
  core/       — Shared business logic (types, stats, Kelly, formatters, strategy builder)
docs/         — Roadmap, analysis, privacy policy
```

## Quick Start

```bash
# Install dependencies
npm install

# Run mobile dev server
cd apps/mobile && npx expo start

# Run desktop in browser
cd apps/desktop && npm run dev        # localhost:1420

# Run desktop as native window (requires Rust)
cd apps/desktop && npx tauri dev

# Run all tests
cd packages/core && npx vitest run    # 12 unit tests
cd apps/desktop && npx vitest run     # 40 smoke tests
cd apps/mobile && npm test            # 17 smoke tests
```

## Install Desktop App (build from source)

### Prerequisites

| Platform | Required |
|----------|----------|
| All | Rust 1.70+ (`rustup.rs`) |
| Windows | Microsoft C++ Build Tools or Visual Studio |
| macOS | Xcode Command Line Tools (`xcode-select --install`) |
| Linux | `libwebkit2gtk-4.1`, `libgtk-3`, `libayatana-appindicator3` |

### Build

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build the installer for your platform
cd apps/desktop && npx tauri build

# Output:
# Windows → apps/desktop/src-tauri/target/release/bundle/msi/SharkLog_*.msi
#         → apps/desktop/src-tauri/target/release/bundle/nsis/SharkLog_*-setup.exe
# macOS   → apps/desktop/src-tauri/target/release/bundle/dmg/SharkLog_*.dmg
# Linux   → apps/desktop/src-tauri/target/release/bundle/deb/sharklog_*.deb
#         → apps/desktop/src-tauri/target/release/bundle/appimage/sharklog_*.AppImage
```

First build takes ~5–10 min (compiles Rust). Subsequent builds are faster.

## Tech Stack

| Layer | Mobile | Desktop |
|-------|--------|---------|
| Framework | React Native 0.85 + Expo 56 | Tauri v2 + React 18 |
| State | Zustand + AsyncStorage | Zustand + SQLite (localStorage fallback) |
| Charts | react-native-gifted-charts | Recharts |
| Fonts | DM Sans + DM Mono (expo-google-fonts) | DM Sans + DM Mono (Google CDN) |
| Payments | RevenueCat | — (planned: LemonSqueezy) |
| Updates | EAS OTA | Tauri updater (signed, GitHub Releases) |
| Tests | Jest 29 (17 smoke) | Vitest (40 smoke) |
| Language | TypeScript strict | TypeScript strict |

## Key Conventions

- **Money in kopecks** — all monetary values stored as integers (no float precision issues). `1000 ₽ = 100_000`
- **formatMoney(kopecks, currency?, maxDecimals?)** — `maxDecimals` defaults to 2; pass `0` for whole-ruble display. On mobile use `useFormatMoney()` hook which respects `settings.roundAmounts`
- **UUID v4** — all entity IDs generated client-side, never `Date.now()`
- **refund ≠ cashout** — `refund`: bookmaker returned stake (cancelled match); `cashout`: player cashed out early
- **PRO features** guarded by `canAddBet()` / `<ProGate>` — never bypass
- **Freemium limits** defined in `packages/core/src/constants/index.ts` (`FREE_LIMITS`)
- **exactOptionalPropertyTypes: true** — use `{...(x ? { prop: x } : {})}`, not `prop={undefined}`
- **formatPercent()** already adds `+` prefix for positive values — do not add it manually

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Teal | `#22D3A0` | Win indicators, positive values, accent |
| Purple | `#5B6AF0` | CTAs, interactive elements, active states |
| Red | `#F4455A` | Loss indicators, negative values |
| Gold | `#F59E0B` | Pending bets, PRO badge |
| Violet | `#A78BFA` | Refunds, secondary stats |

## Pricing

- **Free**: 50 bets, basic stats, tilt alerts (fixed threshold), tournament stats
- **Pro**: 199 ₽/month or 990 ₽/year — unlimited bets, full analytics, insights (teams), strategy builder, bankroll tracker, discipline module, custom tilt/daily limits, custom reminder time

## CI / Release

- **CI** (`.github/workflows/ci.yml`): runs on every push — vitest (core + desktop), jest (mobile), tsc (mobile + desktop)
- **EAS Build** (`.github/workflows/eas-build.yml`): manual trigger — builds mobile app via Expo Application Services
- **Desktop Release** (`.github/workflows/release-desktop.yml`): triggered by `v*` tags — builds signed installers for Windows/macOS/Linux and publishes a GitHub Release with auto-updater manifest

## License

MIT
