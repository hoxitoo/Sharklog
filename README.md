# SharkLog 🦈

Professional betting tracker for the CIS market. Mobile (React Native + Expo) and desktop (Tauri v2 + React) apps sharing a common TypeScript core.

## Features

- **Bet tracking** — full history with sport, bookmaker, strategy, odds, stake; grouped by date with daily P&L
- **Team autocomplete** — remembers teams per sport/esports discipline (NaVi in Dota 2 ≠ NaVi in CS2)
- **Dashboard** — P&L curve chart, W/L strip, 12-week activity heatmap, tilt detection, best/worst bet
- **Analytics** — 7 slices: sport, bet type, bookmaker, strategy, odds range, day of week, hour of day
- **Bankroll** — deposit/withdrawal tracking, Kelly calculator, unit sizing, equity curve
- **Discipline** — daily mood tracker, 8 professional rules, diary, tilt stats
- **Freemium** — 50 free bets; PRO unlocks analytics, bankroll, discipline features, custom limits
- **Export** — CSV (UTF-8) and full JSON backup/restore

## Monorepo Structure

```
apps/
  mobile/     — React Native + Expo 51 (iOS + Android)
  desktop/    — Tauri v2 + React + Vite (Win / Mac / Linux)
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

# Run desktop in browser
cd apps/desktop && npx vite dev

# Run desktop as native window (requires Rust)
cd apps/desktop && npx tauri dev

# Run core tests
cd packages/core && npx vitest run
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
# macOS   → apps/desktop/src-tauri/target/release/bundle/dmg/SharkLog_*.dmg
# Linux   → apps/desktop/src-tauri/target/release/bundle/deb/sharklog_*.deb
#         → apps/desktop/src-tauri/target/release/bundle/appimage/sharklog_*.AppImage
```

First build takes ~5–10 min (compiles Rust). Subsequent builds are faster.

## Tech Stack

| Layer | Mobile | Desktop |
|-------|--------|---------|
| Framework | React Native 0.74 + Expo 51 | Tauri v2 + React 18 |
| State | Zustand + AsyncStorage | Zustand + localStorage |
| Charts | react-native-gifted-charts | Recharts |
| Fonts | DM Sans + DM Mono (expo-google-fonts) | DM Sans + DM Mono (Google CDN) |
| Payments | RevenueCat | — (planned: LemonSqueezy) |
| Language | TypeScript strict | TypeScript strict |

## Key Conventions

- **Money in kopecks** — all monetary values stored as integers (no float precision issues). `1000 ₽ = 100_000`
- **UUID v4** — all entity IDs generated client-side, never `Date.now()`
- **PRO features** guarded by `canAddBet()` / `<ProGate>` — never bypass
- **Freemium limits** defined in `packages/core/src/constants/index.ts` (`FREE_LIMITS`)
- **exactOptionalPropertyTypes: true** — use `{...(x ? { prop: x } : {})}`, not `prop={undefined}`

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Teal | `#22D3A0` | Win indicators, positive values, accent |
| Purple | `#5B6AF0` | CTAs, interactive elements, active states |
| Red | `#F4455A` | Loss indicators, negative values |
| Gold | `#F59E0B` | Pending bets, PRO badge |
| Violet | `#A78BFA` | Refunds, secondary stats |

## Pricing

- **Free**: 50 bets, basic stats, tilt alerts (fixed threshold)
- **Pro**: 199 ₽/month or 990 ₽/year — unlimited bets, full analytics, bankroll tracker, discipline module, custom tilt/daily limits

## License

MIT
