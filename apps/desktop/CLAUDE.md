# SharkLog — десктоп: карта файлов

Карта файлов `apps/desktop/src`: что где лежит и почему устроено так. Перенесена из корневого CLAUDE.md
2026-11-07, чтобы корневой файл (он грузится в каждую сессию и каждому агенту) не вёз её туда,
где работа идёт не в этой папке. **Правила проекта — в корневом `CLAUDE.md`, они действуют и здесь**;
этот файл их не заменяет и не дублирует.

## Структура desktop (apps/desktop/src/)

```
App.tsx                    — загрузка (logo.png), онбординг-роут, main layout
                             PAGE_ORDER: dashboard/bets/analytics/insights/strategy/bankroll/diary/settings/partners (9)
                             Ctrl+1..9 — навигация (Ctrl+9 — Партнёры); Ctrl+N — новая ставка; Esc — закрыть модал
components/
  ErrorBoundary.tsx        — React class boundary, кнопки retry/reload
  ChecklistModal.tsx       — 5 вопросов перед ставкой (PRO)
  ConfirmModal.tsx         — подтверждение деструктивных действий
  Toaster.tsx              — toast уведомления
layouts/
  AppLayout.tsx            — sidebar: logo img, nav 9 пунктов (PRO badge на strategy), FREE_LIMITS прогресс-бар
pages/
  DashboardPage.tsx        — period filter, 6 KPI, W/L strip, heatmap, стратегия-плашка (→ 'strategy')
  BetsPage.tsx             — date-grouped sections, daily P&L, search/filter/sort; статусы refund + cashout
  AddBetModal.tsx          — форма с двумя полями команд (Команда 1 / Команда 2) + 1X2 picker
                             + Kelly calculator + ChecklistModal (PRO)
                             поле "Турнир / Лига" с <datalist> autocomplete
                             clipboard paste для pre-fill; статус cashout
                             event строится как `${team1} vs ${team2}`
  AnalyticsPage.tsx        — 7 срезов (PRO) + "Топ турниры" mini-cards
  BankrollPage.tsx         — equity curve, Kelly calc, транзакции с удалением, сверка с букмекером
  DiaryPage.tsx            — mood tracker, тилт-стата, дневник
  InsightsPage.tsx         — period filter; Лучший/Худший → топ-3 → раскрываемый остаток,
                             отдельно для турниров и команд (PRO);
                             клик по строке/карточке → BetsPage с фильтром (App держит BetsFilter)
  StrategyBuilderPage.tsx  — PRO: progress bar + 10 вопросов + ResultCard + disclaimer
  SettingsPage.tsx         — подписка, тилт-stepper, букмекеры, команды,
                             CSV/Excel/JSON import-export, проверка обновлений
  OnboardingPage.tsx       — 3-шаговый визард (welcome logo → букмекеры → go)
  PartnersPage.tsx         — заглушка «Раздел в разработке», как на мобилке
storage/
  storageService.ts        — SQLite (Tauri) / localStorage (browser) абстракция
store/
  betsStore.ts             — Zustand; load() async, persist() fire-and-forget
  toastStore.ts            — эфемерные toast-уведомления
utils/
  importBets.ts            — импорт CSV/XLSX с алиасами колонок, нормализацией дат, поддержка cashout
  clipboardParser.ts       — parseClipboard(text) → Partial<Bet> (pre-fill AddBetModal)
theme/
  colors.ts                — цветовая система
public/
  logo.png                 — официальный логотип (sidebar, loading screen)
  logo-512.png             — high-res версия
```
