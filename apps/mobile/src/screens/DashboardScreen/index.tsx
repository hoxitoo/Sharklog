import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-gifted-charts';
import { calcDashboard, formatMoney, formatPercent, isInTilt } from '@sharklog/core';
import type { Bet } from '@sharklog/core';
import { useBetsStore } from '../../store/betsStore';
import { colors } from '../../theme/colors';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatCard } from './StatCard';
import { haptic } from '../../utils/haptics';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type PeriodFilter = '7d' | '30d' | 'all';
const PERIOD_OPTIONS: Array<{ key: PeriodFilter; label: string }> = [
  { key: '7d', label: '7 дней' },
  { key: '30d', label: '30 дней' },
  { key: 'all', label: 'Всё время' },
];

function WLStrip({ bets }: { bets: Bet[] }) {
  const last7 = bets.filter((b) => b.status !== 'pending').slice(0, 7).reverse();
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
              b.status === 'refund' && wl.squareR,
            ]}
          >
            <Text style={[wl.letter, {
              color: b.status === 'won' ? colors.won
                : b.status === 'lost' ? colors.lost
                : colors.refund,
            }]}>
              {b.status === 'won' ? 'W' : b.status === 'lost' ? 'L' : 'R'}
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
      : bet.status === 'lost' ? -bet.stake : 0;
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
  const [period, setPeriod] = useState<PeriodFilter>('all');

  const filteredBets = useMemo(() => {
    if (period === 'all') return bets;
    const days = period === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0] ?? '';
    return bets.filter((b) => b.date > cutoffStr);
  }, [bets, period]);

  const stats = calcDashboard(filteredBets);
  const inTilt = isInTilt(bets, settings.tiltThreshold);

  // Bank total always reflects all-time P&L + transactions
  const allTimePnl = period === 'all' ? stats.pnl : calcDashboard(bets).pnl;
  const bankTotal =
    bankroll.transactions.reduce(
      (sum, t) => (t.type === 'deposit' ? sum + t.amount : sum - t.amount),
      0,
    ) + allTimePnl;

  const last5 = filteredBets.slice(0, 5);

  const settledWithPnl = filteredBets
    .filter((b) => b.status === 'won' || b.status === 'lost')
    .map((b) => ({ ...b, pnl: b.status === 'won' ? Math.round(b.stake * b.odds) - b.stake : -b.stake }));
  const bestBet = settledWithPnl.length > 0
    ? settledWithPnl.reduce((a, b) => b.pnl > a.pnl ? b : a)
    : null;
  const worstBet = settledWithPnl.length > 1
    ? settledWithPnl.reduce((a, b) => b.pnl < a.pnl ? b : a)
    : null;

  return (
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

      {inTilt && (
        <View style={styles.tiltAlert}>
          <Text style={styles.tiltIcon}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.tiltTitle}>Стоп. Ты в тилте.</Text>
            <Text style={styles.tiltSub}>
              {stats.currentStreak.count} поражений подряд. Закрой приложение и отдохни.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.statsGrid}>
        <StatCard
          label="P&L"
          value={formatMoney(stats.pnl)}
          sub="чистая прибыль"
          positive={stats.pnl > 0}
          negative={stats.pnl < 0}
        />
        <StatCard
          label="ROI"
          value={formatPercent(stats.roi)}
          sub="возврат инвестиций"
          positive={stats.roi > 0}
          negative={stats.roi < 0}
        />
        <StatCard
          label="Винрейт"
          value={`${stats.winRate.toFixed(1)}%`}
          sub={`${stats.wonBets}W / ${stats.lostBets}L`}
          accent
        />
        <StatCard
          label="Банк"
          value={formatMoney(bankTotal)}
          sub="текущий баланс"
        />
        <StatCard
          label="Поставлено"
          value={formatMoney(stats.totalStaked)}
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
          <Text style={[styles.streakValue, { fontSize: 16 }]}>{formatMoney(bankTotal)}</Text>
        </TouchableOpacity>
      </View>

      <Heatmap bets={filteredBets} />

      {stats.pnlCurve.length > 1 && (() => {
        const rawVals = stats.pnlCurve.map((p) => p.pnl / 100);
        const dataMin = Math.min(...rawVals);
        const dataMax = Math.max(...rawVals);
        const yMax = Math.max(dataMax, 0);
        const yMin = Math.min(dataMin, 0);
        const range = yMax - yMin || 1;
        const chartMax = Math.ceil(yMax + range * 0.12);
        const chartMin = Math.floor(yMin - range * 0.12);
        const lineColor = stats.pnl >= 0 ? colors.won : colors.lost;
        return (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>P&L кривая</Text>
              <Text style={[styles.pnlChipText, { color: lineColor }]}>
                {stats.pnl >= 0 ? '+' : ''}{formatMoney(stats.pnlCurve[stats.pnlCurve.length - 1]?.pnl ?? 0)}
              </Text>
            </View>
            <View style={styles.chartCard}>
              <LineChart
                data={rawVals.map((v) => ({ value: v }))}
                width={width - 72}
                height={120}
                maxValue={chartMax}
                mostNegativeValue={chartMin}
                color={lineColor}
                thickness={2}
                hideDataPoints
                areaChart
                startFillColor={lineColor}
                endFillColor={colors.bgCard}
                startOpacity={0.3}
                endOpacity={0}
                backgroundColor={colors.bgCard}
                xAxisColor={colors.border}
                yAxisColor="transparent"
                rulesType="solid"
                rulesColor={colors.border + '55'}
                noOfSections={3}
                yAxisTextStyle={{ color: colors.textMuted, fontSize: 9 }}
                hideYAxisText
              />
            </View>
          </View>
        );
      })()}

      {(bestBet || worstBet) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Лучшая / Худшая ставка</Text>
          {bestBet && (
            <View style={styles.extremeBet}>
              <View style={{ flex: 1 }}>
                <Text style={styles.extremeLabel}>Лучшая</Text>
                <Text style={styles.recentEvent} numberOfLines={1}>{bestBet.event}</Text>
                <Text style={styles.recentPick}>{bestBet.pick} · ×{bestBet.odds}</Text>
              </View>
              <Text style={[styles.extremePnl, { color: colors.won }]}>+{formatMoney(bestBet.pnl)}</Text>
            </View>
          )}
          {worstBet && (
            <View style={[styles.extremeBet, { marginTop: 6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.extremeLabel}>Худшая</Text>
                <Text style={styles.recentEvent} numberOfLines={1}>{worstBet.event}</Text>
                <Text style={styles.recentPick}>{worstBet.pick} · ×{worstBet.odds}</Text>
              </View>
              <Text style={[styles.extremePnl, { color: colors.lost }]}>{formatMoney(worstBet.pnl)}</Text>
            </View>
          )}
        </View>
      )}

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
                <Text style={styles.recentEvent} numberOfLines={1}>{bet.event}</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  extremeBet: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  extremeLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  extremePnl: { fontSize: 16, fontWeight: '700' },
});
