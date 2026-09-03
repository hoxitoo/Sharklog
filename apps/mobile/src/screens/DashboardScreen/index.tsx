import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { AppText as Text } from '../../components/AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { calcDashboard, isInTilt, calcDailyBreakdown, summarizeDays, toYmd } from '@sharklog/core';
import type { Bet, DayStats } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors, toneSurface } from '../../theme/colors';
import { tileStyle } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ResponsibleGamblingBanner } from '../../components/ResponsibleGamblingBanner';
import { Coachmark } from '../../components/Coachmark';
import { haptic } from '../../utils/haptics';
import { useDrawer } from '../../components/DrawerContext';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { DailyChart, ChartLegend, SERIES } from './DailyChart';
import { ExpandedDashboard } from './ExpandedDashboard';
import { SIZE, GLYPH } from '../../theme/typography';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type PeriodFilter = '7d' | '30d' | 'all';
const PERIOD_OPTIONS: Array<{ key: PeriodFilter; label: string }> = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];

function WLStrip({ bets }: { bets: Bet[] }) {
  // Sort by recency first — store order isn't guaranteed chronological, so a bare
  // slice(0,7) could show a stale, non-latest set of results.
  const last7 = bets
    .filter((b) => b.status !== 'pending')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7)
    .reverse();
  if (last7.length === 0) return null;

  return (
    <View style={wl.container}>
      <Text style={wl.title}>Последние {last7.length} результатов</Text>
      <View style={wl.row}>
        {last7.map((b, i) => (
          <View
            key={b.id + i}
            style={[
              wl.square,
              b.status === 'won' && wl.squareW,
              b.status === 'lost' && wl.squareL,
              (b.status === 'refund' || b.status === 'cashout') && wl.squareR,
            ]}
          >
            <Text style={[wl.letter, {
              color: b.status === 'won' ? colors.won
                : b.status === 'lost' ? colors.lost
                : colors.refund,
            }]}>
              {b.status === 'won' ? 'W' : b.status === 'lost' ? 'L' : b.status === 'cashout' ? 'C' : 'R'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const wl = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginBottom: 14, padding: 14,
    ...toneSurface('violet'), borderRadius: 18, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  title: { fontSize: SIZE.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 6 },
  square: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  squareW: { backgroundColor: colors.won + '18', borderColor: colors.won + '55' },
  squareL: { backgroundColor: colors.lost + '18', borderColor: colors.lost + '55' },
  squareR: { backgroundColor: colors.refund + '18', borderColor: colors.refund + '55' },
  letter: { fontSize: SIZE.body, fontWeight: '700' },
});

function Heatmap({ bets }: { bets: Bet[] }) {
  const today = new Date();
  const weeks = 12;
  const totalDays = weeks * 7;

  const pnlByDate: Record<string, number> = {};
  const countByDate: Record<string, number> = {};
  for (const bet of bets) {
    if (bet.status === 'pending') continue;
    const profit = bet.status === 'won'
      ? Math.round(bet.stake * (bet.odds - 1))
      : bet.status === 'lost' ? (bet.isFreebet ? 0 : -bet.stake)
      : bet.status === 'cashout' && bet.cashoutAmount != null ? bet.cashoutAmount - bet.stake
      : 0;
    pnlByDate[bet.date] = (pnlByDate[bet.date] ?? 0) + profit;
    countByDate[bet.date] = (countByDate[bet.date] ?? 0) + 1;
  }

  const days: Array<{ dateStr: string; pnl: number; count: number }> = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = toYmd(d); // local date — toISOString shifts the day west of UTC
    days.push({
      dateStr,
      pnl: pnlByDate[dateStr] ?? 0,
      count: countByDate[dateStr] ?? 0,
    });
  }

  const columns: typeof days[] = [];
  for (let w = 0; w < weeks; w++) {
    columns.push(days.slice(w * 7, w * 7 + 7));
  }

  function cellColor(day: { pnl: number; count: number }) {
    if (day.count === 0) return colors.bgElevated;
    if (day.pnl > 0) return colors.won + (day.pnl > 50000 ? 'cc' : day.pnl > 10000 ? '88' : '44');
    if (day.pnl < 0) return colors.lost + (day.pnl < -50000 ? 'cc' : day.pnl < -10000 ? '88' : '44');
    return colors.textMuted + '44';
  }

  const hasAny = Object.keys(countByDate).length > 0;
  if (!hasAny) return null;

  return (
    <View style={hm.container}>
      <Text style={hm.title}>Активность за 12 недель</Text>
      <View style={hm.grid}>
        {columns.map((col, wi) => (
          <View key={wi} style={hm.col}>
            {col.map((day, di) => (
              <View
                key={di}
                style={[hm.cell, { backgroundColor: cellColor(day) }]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={hm.legend}>
        <View style={[hm.legendCell, { backgroundColor: colors.lost + '88' }]} />
        <Text style={hm.legendText}>−</Text>
        <View style={[hm.legendCell, { backgroundColor: colors.bgElevated }]} />
        <Text style={hm.legendText}>0</Text>
        <View style={[hm.legendCell, { backgroundColor: colors.won + '88' }]} />
        <Text style={hm.legendText}>+</Text>
      </View>
    </View>
  );
}

const hm = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginBottom: 14, padding: 14,
    backgroundColor: colors.bgCard, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  title: { fontSize: SIZE.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  grid: { flexDirection: 'row', gap: 3 },
  col: { gap: 3 },
  cell: { width: 16, height: 16, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: SIZE.micro, color: colors.textMuted },
});

// ── Top card: period turnover + current bank ─────────────────────────────────

function TurnoverCard({ turnover, bank, betCount, activeDays, pendingCount, periodLabel, onBankPress }: {
  turnover: number; bank: number; betCount: number; activeDays: number;
  pendingCount: number; periodLabel: string; onBankPress: () => void;
}) {
  const fmt = useFormatMoney();
  return (
    <View style={tc.card}>
      <View style={tc.topRow}>
        <View style={tc.left}>
          <Text style={tc.label}>Оборот · {periodLabel}</Text>
          <Text style={tc.value} numberOfLines={1} adjustsFontSizeToFit>{fmt(turnover)}</Text>
        </View>
        <TouchableOpacity style={tc.bankBtn} onPress={onBankPress} activeOpacity={0.75}>
          <Text style={tc.bankLabel}>Банкролл →</Text>
          <Text style={[tc.bankValue, { color: bank >= 0 ? colors.textPrimary : colors.lost }]} numberOfLines={1} adjustsFontSizeToFit>
            {fmt(bank)}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={tc.metaRow}>
        <Text style={tc.meta}>{betCount} ставок</Text>
        <Text style={tc.metaDot}>·</Text>
        <Text style={tc.meta}>{activeDays} дней со ставками</Text>
        {pendingCount > 0 && (
          <>
            <Text style={tc.metaDot}>·</Text>
            <Text style={[tc.meta, { color: colors.pending }]}>{pendingCount} в ожидании</Text>
          </>
        )}
      </View>
    </View>
  );
}

const tc = StyleSheet.create({
  card: {
    padding: 18, marginHorizontal: 16, marginBottom: 12,
    ...toneSurface('info'), borderRadius: 18, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start' },
  left: { flex: 1, marginRight: 12 },
  label: { fontSize: SIZE.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: SIZE.display, fontWeight: '800', color: colors.textPrimary, marginTop: 4 },
  bankBtn: {
    ...tileStyle, paddingHorizontal: 12, paddingVertical: 10,
    minWidth: 118, alignItems: 'flex-end',
  },
  bankLabel: { fontSize: SIZE.micro, color: colors.textMuted },
  bankValue: { fontSize: SIZE.lead, fontWeight: '700', marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  meta: { fontSize: SIZE.caption, color: colors.textMuted },
  metaDot: { fontSize: SIZE.caption, color: colors.border },
});

// ── Main block: interactive per-day dashboard ────────────────────────────────

function DailyDashboardCard({ days, onExpand }: { days: DayStats[]; onExpand: () => void }) {
  const fmt = useFormatMoney();
  const { goToBets } = useDrawer();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  const summary = useMemo(() => summarizeDays(days), [days]);
  const sel = selected != null ? days[selected] ?? null : null;
  const chartW = width - 64; // card margins (16×2) + padding (16×2)

  return (
    <View style={dd.card}>
      <View style={dd.header}>
        <View style={{ flex: 1 }}>
          <Text style={dd.title}>Активность по дням</Text>
          <Text style={dd.subtitle}>последние {days.length} дней</Text>
        </View>
        <TouchableOpacity style={dd.expandBtn} onPress={onExpand} activeOpacity={0.75}>
          <Text style={dd.expandText}>⤢ Развернуть</Text>
        </TouchableOpacity>
      </View>

      <View style={dd.chartWrap}>
        <DailyChart
          days={days}
          width={chartW}
          height={128}
          toggles={{ pnl: true, balance: false, cash: true }}
          selected={selected}
          onSelect={(i) => { haptic.selection(); setSelected(i === selected ? null : i); }}
          labelEvery={1}
        />
      </View>

      {/* Tapped day detail — the four numbers per day */}
      {sel ? (
        <View style={dd.detail}>
          <Text style={dd.detailDate}>
            {sel.date.split('-').reverse().slice(0, 2).join('.')}
            {sel.betCount > 0 ? ` · ${sel.betCount} ст.` : ' · нет ставок'}
          </Text>
          <View style={dd.detailGrid}>
            <View style={dd.detailCell}>
              <Text style={dd.detailLabel}>Оборот</Text>
              <Text style={dd.detailValue}>{fmt(sel.turnover)}</Text>
            </View>
            <View style={dd.detailCell}>
              <Text style={dd.detailLabel}>Выигрыш</Text>
              <Text style={[dd.detailValue, { color: SERIES.win }]}>{fmt(sel.wonAmount)}</Text>
            </View>
            <View style={dd.detailCell}>
              <Text style={dd.detailLabel}>Проигрыш</Text>
              <Text style={[dd.detailValue, { color: SERIES.loss }]}>{fmt(sel.lostAmount)}</Text>
            </View>
            <View style={dd.detailCell}>
              <Text style={dd.detailLabel}>Профит</Text>
              <Text style={[dd.detailValue, { color: sel.pnl >= 0 ? SERIES.win : SERIES.loss }]}>
                {sel.pnl >= 0 ? '+' : ''}{fmt(sel.pnl)}
              </Text>
            </View>
          </View>
          {sel.betCount > 0 && (
            <TouchableOpacity
              style={dd.detailLink}
              onPress={() => { haptic.selection(); goToBets({ date: sel.date }); }}
              activeOpacity={0.75}
            >
              <Text style={dd.detailLinkText}>Показать ставки за этот день →</Text>
            </TouchableOpacity>
          )}
          {(sel.deposits > 0 || sel.withdrawals > 0 || sel.adjustments !== 0) && (
            <Text style={dd.detailCash}>
              {[
                sel.deposits > 0 ? `Депозит ${fmt(sel.deposits)}` : null,
                sel.withdrawals > 0 ? `Вывод ${fmt(sel.withdrawals)}` : null,
                // Without this the balance steps on a reconciliation day and the
                // detail panel gives no reason why.
                sel.adjustments !== 0
                  ? `Сверка ${sel.adjustments > 0 ? '+' : '−'}${fmt(Math.abs(sel.adjustments))}`
                  : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
      ) : (
        <Text style={dd.hint}>Нажми на день — покажу оборот, выигрыш, проигрыш и профит</Text>
      )}

      <ChartLegend toggles={{ pnl: true, balance: false, cash: true }} />

      {/* Context strip for the visible window */}
      <View style={dd.summaryRow}>
        <View style={dd.sumCell}>
          <Text style={dd.sumLabel}>Профит</Text>
          <Text style={[dd.sumValue, { color: summary.pnl >= 0 ? SERIES.win : SERIES.loss }]}>
            {summary.pnl >= 0 ? '+' : ''}{fmt(summary.pnl)}
          </Text>
        </View>
        <View style={dd.sumCell}>
          <Text style={dd.sumLabel}>Лучший день</Text>
          <Text style={[dd.sumValue, {
            color: !summary.bestDay ? colors.textMuted
              : summary.bestDay.pnl >= 0 ? SERIES.win : SERIES.loss,
          }]}>
            {summary.bestDay
              ? `${summary.bestDay.pnl >= 0 ? '+' : ''}${fmt(summary.bestDay.pnl)}`
              : '—'}
          </Text>
        </View>
        <View style={dd.sumCell}>
          <Text style={dd.sumLabel}>Со ставками</Text>
          <Text style={dd.sumValue}>{summary.activeDays}/{days.length}</Text>
        </View>
      </View>
    </View>
  );
}

const dd = StyleSheet.create({
  card: {
    padding: 16, marginHorizontal: 16, marginBottom: 14,
    ...toneSurface('profit'), borderRadius: 18, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 2 },
  expandBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.purple + '66',
  },
  expandText: { fontSize: SIZE.caption, color: colors.purpleText, fontWeight: '700' },
  chartWrap: { alignItems: 'center' },
  hint: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 12, textAlign: 'center' },
  detail: { ...tileStyle, marginTop: 12 },
  detailDate: { fontSize: SIZE.caption, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  detailGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  detailCell: { flex: 1 },
  detailLabel: { fontSize: SIZE.micro, color: colors.textMuted },
  detailValue: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  detailCash: { fontSize: SIZE.micro, color: colors.textMuted, marginTop: 8 },
  detailLink: {
    marginTop: 10, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    backgroundColor: colors.purpleDim, borderWidth: 1, borderColor: colors.purple + '66',
  },
  detailLinkText: { fontSize: SIZE.caption, color: colors.purpleText, fontWeight: '700' },
  summaryRow: {
    flexDirection: 'row', marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  sumCell: { flex: 1 },
  sumLabel: { fontSize: SIZE.micro, color: colors.textMuted },
  sumValue: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary, marginTop: 3 },
});

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const { bets, settings, bankroll } = useBetsStore();
  const fmt = useFormatMoney();
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tiltDismissed, setTiltDismissed] = useState(false);
  const prevInTilt = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem('@sharklog/tilt_dismiss_date').then((saved) => {
      const today = toYmd(new Date());
      if (saved === today) setTiltDismissed(true);
    });
  }, []);

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = toYmd(cutoff); // local date — toISOString would shift the day
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  // Per-day series drives the main dashboard. Running totals always span the full
  // history, so a 10-day window still shows the true balance.
  const fullDays = useMemo(
    () => calcDailyBreakdown(bets, bankroll.transactions),
    [bets, bankroll.transactions],
  );
  const last10 = useMemo(
    () => calcDailyBreakdown(bets, bankroll.transactions, { days: 10 }),
    [bets, bankroll.transactions],
  );
  const periodDays = useMemo(() => {
    if (period === 'all') return fullDays;
    const n = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (n - 1));
    const from = toYmd(cutoff);
    return fullDays.filter((d) => d.date >= from);
  }, [fullDays, period]);
  const periodSummary = useMemo(() => summarizeDays(periodDays), [periodDays]);
  // Cap the expanded view: one tappable column per day, so years of history would
  // render hundreds of 1px columns and stall the modal.
  const expandedDays = useMemo(() => fullDays.slice(-365), [fullDays]);

  const stats = calcDashboard(filteredBets);
  // Tilt is an all-time discipline signal; compute the streak from the same (all-bets)
  // dataset the banner is gated on, so the displayed count always matches `inTilt`.
  const allTimeStats = period === 'all' ? stats : calcDashboard(bets);
  const inTilt = isInTilt(bets, settings.tiltThreshold);

  useEffect(() => {
    if (inTilt && !prevInTilt.current) {
      haptic.warning();
      // Reset dismiss when a new tilt session starts
      setTiltDismissed(false);
      AsyncStorage.removeItem('@sharklog/tilt_dismiss_date');
    }
    prevInTilt.current = inTilt;
  }, [inTilt]);

  function dismissTilt() {
    haptic.selection();
    const today = toYmd(new Date());
    AsyncStorage.setItem('@sharklog/tilt_dismiss_date', today);
    setTiltDismissed(true);
  }

  // Bank = cash movements (deposits, withdrawals, reconciliations) + all-time P&L,
  // read off the last day of the full series.
  const bankTotal = fullDays.length > 0 ? fullDays[fullDays.length - 1]!.balance : 0;

  // Most-recent 5 settled-or-pending bets, newest first.
  const last5 = [...filteredBets]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <View style={styles.flex}>
      {/* Pinned, like every other drawer screen: the hamburger is the only way
          into the menu, and it must not scroll off the top of the page. */}
      <ScreenHeader
        title="Дашборд"
        subtitle={new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
      />
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {settings.generatedStrategy && (
        <TouchableOpacity
          style={styles.strategyBadge}
          onPress={() => { haptic.selection(); navigation.navigate('StrategyBuilder'); }}
          activeOpacity={0.8}
        >
          <Text style={styles.strategyIcon}>🎯</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.strategyName}>Стратегия: {settings.generatedStrategy.name}</Text>
            <Text style={styles.strategySub}>
              {settings.generatedStrategy.betsPerDay} ст/день · {settings.generatedStrategy.stakePercent}% банка · коэф {settings.generatedStrategy.oddsMin.toFixed(2)}–{settings.generatedStrategy.oddsMax.toFixed(2)}
            </Text>
          </View>
          <Text style={styles.strategyArrow}>→</Text>
        </TouchableOpacity>
      )}

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => { haptic.selection(); setPeriod(p.key); }}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {inTilt && !tiltDismissed && (
        <View style={styles.tiltAlert}>
          <Text style={styles.tiltIcon}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tiltTitle}>Стоп. Ты в тилте.</Text>
            <Text style={styles.tiltSub}>
              {allTimeStats.currentStreak.count} поражений подряд. Закрой приложение и отдохни.
            </Text>
          </View>
          <TouchableOpacity onPress={dismissTilt} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Text style={styles.tiltDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <TurnoverCard
        turnover={periodSummary.turnover}
        bank={bankTotal}
        betCount={periodSummary.betCount}
        activeDays={periodSummary.activeDays}
        pendingCount={stats.pendingCount}
        periodLabel={PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? ''}
        onBankPress={() => { haptic.selection(); navigation.navigate('Bankroll'); }}
      />

      <DailyDashboardCard days={last10} onExpand={() => { haptic.selection(); setExpanded(true); }} />

      <WLStrip bets={filteredBets} />

      {/* Heatmap — collapsible */}
      <TouchableOpacity
        style={styles.heatmapToggle}
        onPress={() => setShowHeatmap((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.heatmapToggleText}>Активность за 12 недель</Text>
        <Text style={styles.heatmapToggleChevron}>{showHeatmap ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {showHeatmap && <Heatmap bets={filteredBets} />}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Последние ставки</Text>
        {last5.length === 0 ? (
          <Text style={styles.emptyText}>Ставок пока нет</Text>
        ) : (
          last5.map((bet) => (
            <TouchableOpacity
              key={bet.id}
              style={styles.recentBet}
              onPress={() => navigation.navigate('AddBet', { betId: bet.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recentEvent} numberOfLines={1}>{bet.event.split(' / ').map(p => p.split('|')[0] ?? p).join(' / ')}</Text>
                <Text style={styles.recentPick}>{bet.pick} · ×{bet.odds}</Text>
              </View>
              <View style={[
                styles.recentStatus,
                { backgroundColor:
                    bet.status === 'won' ? colors.won + '22' :
                    bet.status === 'lost' ? colors.lost + '22' :
                    colors.pending + '22'
                }
              ]}>
                <Text style={{
                  color: bet.status === 'won' ? colors.won : bet.status === 'lost' ? colors.lost : colors.pending,
                  fontSize: SIZE.caption, fontWeight: '600',
                }}>
                  {bet.status === 'won' ? 'W' : bet.status === 'lost' ? 'L' : bet.status === 'refund' ? 'R' : bet.status === 'cashout' ? 'C' : '?'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <ResponsibleGamblingBanner />
    </ScrollView>
    <ExpandedDashboard visible={expanded} days={expandedDays} onClose={() => setExpanded(false)} />
    <Coachmark
      storageKey="@sharklog/tip_dashboard_seen"
      title="Дашборд"
      body="Оборот сверху меняется с периодом (7д / 30д / всё). Нажми на день в графике — увидишь оборот, выигрыш, проигрыш и профит. Кнопка «Развернуть» открывает полную таблицу по дням с фильтрами."
      position="bottom"
    />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },
  strategyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 12, padding: 12,
    backgroundColor: colors.purple + '14', borderRadius: 10,
    borderWidth: 1, borderColor: colors.purple + '44',
  },
  strategyIcon: { fontSize: GLYPH.lg },
  strategyName: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary },
  strategySub: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: 2 },
  strategyArrow: { fontSize: GLYPH.md, color: colors.textMuted },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodBtnActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  periodText: { fontSize: SIZE.caption, fontWeight: '600', color: colors.textSecondary },
  periodTextActive: { color: '#fff' },
  tiltAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    marginTop: 0,
    padding: 14,
    backgroundColor: colors.lost + '18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lost + '55',
  },
  tiltIcon: { fontSize: GLYPH.xl },
  tiltTitle: { fontSize: SIZE.lead, fontWeight: '700', color: colors.lost },
  tiltSub: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: 3 },
  tiltDismiss: { fontSize: SIZE.lead, color: colors.textMuted, paddingLeft: 8 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: SIZE.lead, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: SIZE.body, color: colors.textMuted },
  recentBet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentEvent: { fontSize: SIZE.body, fontWeight: '600', color: colors.textPrimary },
  recentPick: { fontSize: SIZE.caption, color: colors.textSecondary, marginTop: 2 },
  recentStatus: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  heatmapToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heatmapToggleText: { fontSize: SIZE.body, fontWeight: '600', color: colors.textSecondary },
  heatmapToggleChevron: { fontSize: GLYPH.sm, color: colors.textMuted },
});
