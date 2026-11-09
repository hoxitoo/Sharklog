# SharkLog — ядро: карта файлов

Карта файлов `packages/core/src`: что где лежит и почему устроено так. Перенесена из корневого CLAUDE.md
2026-11-07, чтобы корневой файл (он грузится в каждую сессию и каждому агенту) не вёз её туда,
где работа идёт не в этой папке. **Правила проекта — в корневом `CLAUDE.md`, они действуют и здесь**;
этот файл их не заменяет и не дублирует.

## Структура core (packages/core/src/)

```
types/bet.ts          — Bet.settledAt — когда записан результат (не матч); BetStatus: 'pending'|'won'|'lost'|'refund'|'cashout'
                        BankrollTxType: 'deposit'|'withdrawal'|'adjustment' (у последнего amount ЗНАКОВЫЙ)
                        Bet: + tournament?: string, + closingOdds?: number (для CLV)
                        AppSettings: + generatedStrategy?: GeneratedStrategy, + roundAmounts: boolean, + disableChecklist?: boolean
                        GeneratedStrategy: + rationale?, keyPrinciples?, recommendedApproaches?,
                        recommendedBetTypes?, betTypeRationale?, oddsRationale? (6 rich output fields)
                        StrategyAnswers, + 10 union types
constants/index.ts    — SPORTS, BET_TYPES, STRATEGIES, FREE_LIMITS, ODDS_RANGES
utils/
  stats.ts            — calcDashboard, calcByField, calcByOddsRange, calcByDayOfWeek,
                        calcByHour, isInTilt, calcByTournament, calcByTeam, parseEventTeams, betPnl
                        betPnl(bet) — реализованный P&L одной ставки в копейках (общий хелпер)
                        side1x2(pick, team2) — сторона 1X2 сохранённого исхода для формы правки (обе формы)
                        getPickedTeams(event, pick) — внутренний хелпер: возвращает только команды,
                        на которые поставил игрок (П1/П2/Ф1/Ф2 и прямые имена); используется в calcByTeam
                        betBacksTeam(bet, team, { partial }) — тот же предикат наружу, для
                        фильтра списка ставок. partial ослабляет сравнение до подстроки — для
                        поля, в которое ПЕЧАТАЮТ, а не плитки, по которой тапнули («Ак» должно
                        находить «Ак Барс»). Точная форма остаётся дефолтом: именно она держит
                        длину отфильтрованного списка равной числу на плитке инсайтов
                        bankCash(txs) / currentBank(txs, bets) / pendingExposure(bets) — банк (см. соглашения)
  daily.ts            — calcDailyBreakdown/summarizeDays/toYmd — подневная статистика для дашборда
                        (cumPnl/balance всегда по всей истории; toYmd — локальная дата, не toISOString)
                        DayStats.adjustments — сверки отдельным бакетом, вне «внесено/выведено»
  betsCsv.ts          — buildBetsCSV / importBetsFromCSV / importBetsFromRows / parseAmount
                        один импорт-экспорт на оба приложения: BOM, CRLF, `,`/`;`/таб, алиасы колонок
  analytics.ts        — calcStreaks (лучшая W / худшая L / текущая), calcExtremes (макс выигрыш/проигрыш),
                        calcCLV (closingOdds),
                        calcTimeStats(bets, use12h) (6 4-часовых промежутков для доната + топ-4 часа с P&L),
                        calcMaxDrawdown (пик→дно кумулятивного P&L), calcEdge (WR vs безубыток),
                        RELIABLE_SAMPLE_MIN=100
                        calcPnlBuckets(bets, 'day'|'week'|'month', count) — чистый P&L по периодам
                        (группировка по bet.date, пустые бакеты сохраняются)
                        calcLuck(bets) — сигма-отклонение результата от безубытка (везение vs решения)
                        bankAtBetTime(bets, txs)(ставка | { date, id?, createdAt? } | день) — что было в учёте, когда
                        ставку вносили: всё, датированное не позже её дня, минус записанное после её
                        createdAt (результаты по settledAt, выводы и сверки по моменту ввода;
                        депозиты — всегда); внесённая после конца своего дня — начало дня; новая
                        (без id и createdAt) — «сейчас»; голый день — начало дня. Все ставки разом — дерево Фенвика. Общий для плана, карточки, формы и Келли
                        stampSettlement(prev, next, now) (stats.ts) — settledAt в шаг с результатом; оба стора;
                        legacySettledAt — запасной момент для старых данных (не позже конца дня ставки, не раньше её ввода)
                        betBankShare / calcBankShares — сколько % банка ставка принесла/забрала
                        calcPlanCompliance(bets, txs, limitPct) — доля ставок сверх лимита плана,
                        P&L в лимите / сверх него, топ отклонений
                        calcPlanAdherence(bets, txs, plan, { evaluate }) — счётчики «по плану»:
                        кэф в диапазоне, ставка в лимите (правило calcPlanCompliance), дни сверх
                        ставок в день; inPlanOdds(odds, plan, format) — тот же вопрос для формы
                        ставки; stakeOverPlan(stake, bank, pct) — ставка сверх доли, в копейках
                        calcBetYears(bets, now) — годы из данных + текущий, новые первыми
                        betsInYear(bets, year) — срез по календарному году
  kelly.ts            — kellyFraction, halfKelly, expectedValue, impliedProbability,
                        recommendedStake(bank, odds, p, maxFraction = 0.05, multiplier = 0.5),
                        stepProbability(p, ±1) — шаг «моей оценки» ±5 п.п. в 5–95%
  oddsFormat.ts       — parseOdds / formatOddsAs / rangeFormat / ODDS_FORMATS: шесть форматов кэфов ↔ десятичный
  currency.ts         — CURRENCIES (знаки), currencySymbol, currencyFromUnit, suggestCurrency, BANKROLL_TIERS
  formatters.ts       — formatMoney(kopecks, currency='₽', maxDecimals=2), parseMoneyInput, formatOdds, formatPercent (adds + prefix)
  goals.ts            — calcGoalProgress(goal, bets, txs, now): прогресс, срок, темп, прогноз, ROI, ряд для
                        графика; activeGoals / mainGoal; addDays / daysBetween (календарные дни, без DST)
  teams.ts            — upsertTeams(список, имена, спорт, дисциплина, newId) / cleanTeamNames — список команд обоих сторов
  heatmap.ts          — calcHeatmap(bets, weeks, now) (дни × 7, P&L через betPnl) / heatLevel(день) −3…3 или null
  strategyBuilder.ts  — STRATEGY_QUESTIONS (10 вопросов), buildStrategy(answers),
                        STRATEGY_ODDS_BANDS — диапазоны кэфов и для вопроса, и для плана;
                        strategyPlan(strategy) — числа сохранённого плана (кэфы — из ответов);
                        activeStrategy(settings) — действующая стратегия (выключенная — undefined);
                        strategySince(strategy) — первый день, который план судит (собран или включён заново)
                        strategyTextIds(answers) — КАКИЕ тексты положены профилю (id имени, предложений
                        обоснования, 4 принципов, диапазона, совета по типу ставок); ru/en-таблицы
                        для запекания — RU/EN там же
  migrations.ts       — migrate(raw); v3 округляет кэфы экспрессов до 2 знаков, v4 дополняет время «H:MM» до «HH:MM».
                        JSON-восстановление тоже гонится через migrate(), иначе старый бэкап
                        возвращает уже исправленные баги
```
