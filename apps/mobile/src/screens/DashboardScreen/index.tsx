import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-gifted-charts';
import { calcDashboard, formatPercent, isInTilt } from '@sharklog/core';
import type { Bet } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatCard } from './StatCard';
import { ResponsibleGamblingBanner } from '../../components/ResponsibleGamblingBanner';
import { Coachmark } from '../../components/Coachmark';
import { haptic } from '../../utils/haptics';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useFormatMoney } from '../../utils/useFormatMoney';
import { chartScale, chartHeightForBudget, formatChartYLabel } from '../../utils/chartScale';

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
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
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
  letter: { fontSize: 13, fontWeight: '700' },
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
    const dateStr = d.toISOString().split('T')[0] ?? '';
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
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  grid: { flexDirection: 'row', gap: 3 },
  col: { gap: 3 },
  cell: { width: 16, height: 16, borderRadius: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 10, color: colors.textMuted },
});

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const { bets, settings, bankroll } = useBetsStore();
  const fmt = useFormatMoney();
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [tiltDismissed, setTiltDismissed] = useState(false);
  const prevInTilt = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem('@sharklog/tilt_dismiss_date').then((saved) => {
      const today = new Date().toISOString().split('T')[0] ?? '';
      if (saved === today) setTiltDismissed(true);
    });
  }, []);

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0] ?? '';
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

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
    const today = new Date().toISOString().split('T')[0] ?? '';
    AsyncStorage.setItem('@sharklog/tilt_dismiss_date', today);
    setTiltDismissed(true);
  }

  // Bank total always reflects all-time P&L + transactions
  const allTimePnl = allTimeStats.pnl;
  const bankTotal =
    bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount),
      0,
    ) + allTimePnl;

  // Most-recent 5 settled-or-pending bets, newest first.
  const last5 = [...filteredBets]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <View style={styles.flex}>
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ScreenHeader
        title="Дашборд"
        subtitle={new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
      />

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

      <View style={styles.statsGrid}>
        <StatCard
          label="P&L"
          value={fmt(stats.pnl)}
          sub="чистая прибыль"
          positive={stats.pnl > 0}
          negative={stats.pnl < 0}
          onInfo={() => Alert.alert(
            'P&L — прибыль и убыток',
            'Чистый финансовый результат всех ставок.\n\nПример: поставил 1 000 ₽ × коэф 2.0 → выиграл 1 000 ₽ прибыли. Проиграл ещё 500 ₽ → итого P&L = +500 ₽.\n\nФрибеты учитываются только в части выигрыша — потеря фрибета P&L не уменьшает.',
          )}
        />
        <StatCard
          label="ROI"
          value={formatPercent(stats.roi)}
          sub="возврат инвестиций"
          positive={stats.roi > 0}
          negative={stats.roi < 0}
          onInfo={() => Alert.alert(
            'ROI — возврат инвестиций',
            'ROI = P&L ÷ суммарный оборот × 100%\n\nПример: поставил 10 000 ₽, заработал 1 500 ₽ → ROI = +15%.\n\nROI > 0% — прибыльная игра. Стабильный ROI 5–10% считается отличным результатом в долгосроке.',
          )}
        />
        <StatCard
          label="Винрейт"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.wonBets}W / ${stats.lostBets}L`}
          accent
        />
        <StatCard
          label="Банк"
          value={fmt(bankTotal)}
          sub="текущий баланс"
        />
        <StatCard
          label="Поставлено"
          value={fmt(stats.totalStaked)}
          sub={`ср. кэф ${stats.avgOdds > 0 ? stats.avgOdds.toFixed(2) : '—'}`}
        />
        <StatCard
          label="В ожидании"
          value={String(stats.pendingCount)}
          sub={stats.pendingCount === 0 ? 'открытых ставок нет' : 'ставок не закрыто'}
          {...(stats.pendingCount > 0 ? { accent: true } : {})}
        />
      </View>

      <WLStrip bets={filteredBets} />

      {stats.pnlCurve.length > 1 && (() => {
        const rawVals = stats.pnlCurve.map((p) => p.pnl / 100);
        const scale = chartScale(rawVals);
        const lineColor = stats.pnl >= 0 ? colors.won : colors.lost;
        return (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>P&L кривая</Text>
              <Text style={[styles.pnlChipText, { color: lineColor }]}>
                {stats.pnl >= 0 ? '+' : ''}{fmt(stats.pnlCurve[stats.pnlCurve.length - 1]?.pnl ?? 0)}
              </Text>
            </View>
            <View style={styles.chartCard}>
              <LineChart
                data={rawVals.map((v) => ({ value: v }))}
                width={width - 96}
                height={chartHeightForBudget(180, scale)}
                maxValue={scale.maxValue}
                stepValue={scale.stepValue}
                noOfSections={scale.noOfSections}
                {...(scale.sectionsBelow > 0
                  ? { mostNegativeValue: scale.mostNegativeValue, noOfSectionsBelowXAxis: scale.sectionsBelow }
                  : {})}
                color={lineColor}
                thickness={2}
                hideDataPoints
                areaChart
                startFillColor={lineColor}
                endFillColor={colors.bgCard}
                startOpacity={0.35}
                endOpacity={0}
                backgroundColor={colors.bgCard}
                xAxisColor={colors.border}
                yAxisColor={colors.border + '66'}
                rulesType="solid"
                rulesColor={colors.border + '44'}
                yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
                formatYLabel={formatChartYLabel}
                adjustToWidth
              />
            </View>
          </View>
        );
      })()}

      <View style={styles.streakRow}>
        <View style={[
          styles.streakCard,
          stats.currentStreak.type === 'win' && styles.streakWin,
          stats.currentStreak.type === 'loss' && styles.streakLoss,
        ]}>
          <Text style={styles.streakLabel}>Текущая серия</Text>
          <Text style={styles.streakValue}>
            {stats.currentStreak.type === 'none'
              ? '—'
              : `${stats.currentStreak.count} ${stats.currentStreak.type === 'win' ? '🏆' : '💸'}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.bankCard}
          onPress={() => navigation.navigate('Bankroll')}
          activeOpacity={0.75}
        >
          <Text style={styles.streakLabel}>Банкролл →</Text>
          <Text style={[styles.streakValue, { fontSize: 16 }]}>{fmt(bankTotal)}</Text>
        </TouchableOpacity>
      </View>

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
                  fontSize: 12, fontWeight: '600',
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
    <Coachmark
      storageKey="@sharklog/tip_dashboard_seen"
      title="Дашборд"
      body="Переключай период (7д / 30д / всё). Тепловая карта — под кнопкой ▼. Нажми на любую карточку — получи пояснение."
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
  strategyIcon: { fontSize: 20 },
  strategyName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  strategySub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  strategyArrow: { fontSize: 14, color: colors.textMuted },
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
  periodText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
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
  tiltIcon: { fontSize: 28 },
  tiltTitle: { fontSize: 15, fontWeight: '700', color: colors.lost },
  tiltSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  tiltDismiss: { fontSize: 16, color: colors.textMuted, paddingLeft: 8 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  streakRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  streakCard: {
    flex: 2,
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakWin: { borderColor: colors.won + '66', backgroundColor: colors.won + '11' },
  streakLoss: { borderColor: colors.lost + '66', backgroundColor: colors.lost + '11' },
  streakLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  streakValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  bankCard: {
    flex: 1,
    backgroundColor: colors.purpleDim,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.purple + '44',
  },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  pnlChipText: { fontSize: 14, fontWeight: '700' },
  chartCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    paddingTop: 8,
    paddingBottom: 4,
    paddingLeft: 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  emptyText: { fontSize: 14, color: colors.textMuted },
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
  recentEvent: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  recentPick: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
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
  heatmapToggleText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  heatmapToggleChevron: { fontSize: 10, color: colors.textMuted },
});
